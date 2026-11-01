package httpx

import (
	"context"
	"crypto/subtle"
	"errors"
	"log/slog"
	"net/http"
	"runtime/debug"
	"time"

	"github.com/UjjwolKayastha/nilami/api/internal/auth"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// ProfileLookup resolves a verified subject into the authority that actually
// governs the request. The token says who you are; this says what you may see.
type ProfileLookup interface {
	ScopeForUser(ctx context.Context, userID uuid.UUID) (auth.Scope, error)
	ScopeForViewAs(ctx context.Context, caller auth.Scope, targetID uuid.UUID) (auth.Scope, error)
}

// SessionLookup turns the opaque value in a cookie into the account it signs
// in, sliding the expiry forward when it is due.
type SessionLookup interface {
	ValidateSession(ctx context.Context, token string) (userID uuid.UUID, idHash string, renewed time.Time, err error)
}

type Middleware struct {
	Sessions     SessionLookup
	Profiles     ProfileLookup
	ServiceToken string
	Cookies      Cookies
}

// Cookies writes the session cookie. It is its own type so the sign-in handler
// and this middleware cannot disagree about the flags on it.
type Cookies struct {
	// Insecure drops the Secure flag, which only a local development server
	// over plain http has any business doing.
	Insecure bool
}

// SessionToken reads the session out of a request: the cookie first, then an
// Authorization header.
//
// Both are accepted on purpose. Once the frontend is served from this origin
// the cookie is the only path, but while it runs on Vercel it holds its own
// cookie and relays the token in a header, so the two topologies share one
// code path instead of one being written twice.
func SessionToken(r *http.Request) string {
	if c, err := r.Cookie(auth.SessionCookie); err == nil && c.Value != "" {
		return c.Value
	}
	return auth.BearerToken(r.Header.Get("Authorization"))
}

// SetSession writes the session cookie, and with an empty token clears it.
//
// SameSite=Lax rather than Strict: Strict drops the cookie when someone
// arrives from a link in another app, which shows them a login screen they do
// not need. Lax still withholds it from cross-site form posts, which is the
// attack it exists to stop.
func (c Cookies) SetSession(w http.ResponseWriter, token string, expires time.Time) {
	ck := &http.Cookie{
		Name:     auth.SessionCookie,
		Value:    token,
		Path:     "/",
		Expires:  expires,
		HttpOnly: true,
		Secure:   !c.Insecure,
		SameSite: http.SameSiteLaxMode,
	}
	if token == "" {
		ck.MaxAge = -1
	}
	http.SetCookie(w, ck)
}

// ServiceGuard keeps a route private to our own server. It guards the public
// page reads and the view counter, whose only legitimate caller is the Next.js
// server, so anything without the shared credential is refused before it reaches
// a handler or touches the database.
//
// It deliberately does not guard the admin routes: those are reachable from a
// signed-in browser and are gated by the user's token instead. A credential that
// has to ship to a browser is not a secret, so it is not asked for there.
//
// This is a channel credential, not an identity: it says "this request came
// from our frontend", never "this request may read institution X".
func (m Middleware) ServiceGuard(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got := r.Header.Get("X-Service-Token")
		if subtle.ConstantTimeCompare([]byte(got), []byte(m.ServiceToken)) != 1 {
			Error(w, http.StatusUnauthorized, "unauthorized", nil)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// Identity attaches a Scope when the request carries a live session.
//
// The session is resolved here against our own table rather than trusted from
// the frontend, so a bug or a compromise upstream cannot promote anyone: the
// frontend can prove it is the frontend, but it cannot assert who the user is.
//
// Anonymous requests pass through — the public endpoints need no identity.
func (m Middleware) Identity(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := SessionToken(r)
		if token == "" {
			next.ServeHTTP(w, r)
			return
		}
		userID, idHash, renewed, err := m.Sessions.ValidateSession(r.Context(), token)
		switch {
		case errors.Is(err, auth.ErrNoSession):
			// Unknown, expired or revoked are answered alike, and the stale
			// cookie is cleared so the browser stops sending it.
			m.Cookies.SetSession(w, "", time.Time{})
			Error(w, http.StatusUnauthorized, "not signed in", nil)
			return
		case err != nil:
			Error(w, http.StatusInternalServerError, "could not read the session", err)
			return
		}
		// The expiry slides at most once a day; when it moved, the browser
		// needs the new one or the cookie would expire before the row does.
		if !renewed.IsZero() {
			m.Cookies.SetSession(w, token, renewed)
		}
		scope, err := m.Profiles.ScopeForUser(r.Context(), userID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				// A live session whose profile is gone. Treat it as signed in
				// and entitled to nothing rather than as an error: the account
				// was deleted mid-session and the next write will say so.
				scope = auth.Scope{UserID: userID}
			} else {
				Error(w, http.StatusInternalServerError, "could not resolve account", err)
				return
			}
		}
		scope.SessionID = idHash
		if raw := r.Header.Get("X-View-As"); raw != "" {
			target, err := uuid.Parse(raw)
			if err == nil {
				proxied, err := m.Profiles.ScopeForViewAs(r.Context(), scope, target)
				switch {
				case err != nil && err != pgx.ErrNoRows:
					Error(w, http.StatusInternalServerError, "could not resolve view-as", err)
					return
				case err == nil && proxied.Proxied():
					slog.Info("view-as", "admin", scope.UserID, "target", proxied.UserID, "path", r.URL.Path)
					proxied.SessionID = scope.SessionID
					scope = proxied
				}
			}
		}

		next.ServeHTTP(w, r.WithContext(auth.WithScope(r.Context(), scope)))
	})
}

func Recover(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if v := recover(); v != nil {
				slog.Error("panic", "value", v, "path", r.URL.Path, "stack", string(debug.Stack()))
				Error(w, http.StatusInternalServerError, "internal error", nil)
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func Timeout(d time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx, cancel := context.WithTimeout(r.Context(), d)
			defer cancel()
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (s *statusWriter) WriteHeader(code int) {
	s.status = code
	s.ResponseWriter.WriteHeader(code)
}

func Log(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		sw := &statusWriter{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(sw, r)
		slog.Info("request",
			"method", r.Method, "path", r.URL.Path,
			"status", sw.status, "ms", time.Since(start).Milliseconds())
	})
}

// Chain applies middleware so the first listed runs outermost.
func Chain(h http.Handler, mw ...func(http.Handler) http.Handler) http.Handler {
	for i := len(mw) - 1; i >= 0; i-- {
		h = mw[i](h)
	}
	return h
}
