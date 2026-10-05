package httpx

import (
	"context"
	"crypto/subtle"
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
}

type Middleware struct {
	Verifier     *auth.Verifier
	Profiles     ProfileLookup
	ServiceToken string
}

// ServiceGuard keeps the API private. The Next.js server is the only caller, so
// anything without the shared credential is refused before it reaches a handler
// or touches the database.
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

// Identity attaches a Scope when the caller forwarded a user's Supabase token.
//
// The token is verified here rather than trusted from the frontend, so a bug or
// a compromise upstream cannot promote anyone: the frontend can prove it is the
// frontend, but it cannot assert who the user is.
//
// Anonymous requests pass through — the public endpoints need no identity.
func (m Middleware) Identity(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := auth.BearerToken(r.Header.Get("Authorization"))
		if token == "" {
			next.ServeHTTP(w, r)
			return
		}
		claims, err := m.Verifier.Verify(token)
		if err != nil {
			Error(w, http.StatusUnauthorized, "invalid token", err)
			return
		}
		userID, err := uuid.Parse(claims.Subject)
		if err != nil {
			Error(w, http.StatusUnauthorized, "invalid token subject", err)
			return
		}
		scope, err := m.Profiles.ScopeForUser(r.Context(), userID)
		if err != nil {
			if err == pgx.ErrNoRows {
				// Authenticated with Supabase but no profile here yet. The
				// account exists and is simply not provisioned or approved;
				// treat it as signed in but entitled to nothing.
				scope = auth.Scope{UserID: userID}
			} else {
				Error(w, http.StatusInternalServerError, "could not resolve account", err)
				return
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
