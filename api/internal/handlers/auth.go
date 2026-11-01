package handlers

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/UjjwolKayastha/nilami/api/internal/auth"
	"github.com/UjjwolKayastha/nilami/api/internal/db"
	"github.com/UjjwolKayastha/nilami/api/internal/httpx"
	"github.com/jackc/pgx/v5"
)

// Auth signs people in and out.
//
// It replaces a hosted identity provider that this service could only ask
// about. Owning it means approval and rejection are one transaction instead of
// two systems that can disagree, and that a paused free-tier project can no
// longer lock every account out.
type Auth struct {
	DB      *db.DB
	Cookies httpx.Cookies
	// Attempts throttles sign-in per account rather than per address. The
	// address is useless for this: while the frontend runs on Vercel every
	// attempt arrives from one machine, so an address bucket would throttle
	// every user together and still leave one account free to guess at.
	Attempts *httpx.Limiter
}

func (h Auth) Routes(mux *http.ServeMux) {
	mux.HandleFunc("POST /v1/auth/login", h.login)
	mux.HandleFunc("POST /v1/auth/logout", h.logout)
}

type loginBody struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// A valid argon2id hash of a value nobody will type, verified against when no
// account matches so that a missing account costs the same time as a wrong
// password. Without it, the response time answers "does this address have an
// account here?" for anyone willing to measure.
const absentAccountHash = `$argon2id$v=19$m=65536,t=3,p=2$fnFYStLK6BP2xrwI1hCr3A$apt1QhoqR4jxR9bMsJk+4FcAUeyeOAikxi1fUGh0Ck4`

func (h Auth) login(w http.ResponseWriter, r *http.Request) {
	var body loginBody
	if err := decode(w, r, &body); err != nil {
		return
	}
	email := strings.TrimSpace(body.Email)
	if email == "" || body.Password == "" {
		httpx.Error(w, http.StatusBadRequest, "email and password are required", nil)
		return
	}

	if ok, retry := h.Attempts.Allow("login:" + strings.ToLower(email)); !ok {
		w.Header().Set("Retry-After", strconv.Itoa(int(retry.Seconds())))
		httpx.Error(w, http.StatusTooManyRequests, "too many sign-in attempts for this account", nil)
		return
	}

	creds, err := h.DB.CredentialsByEmail(r.Context(), email)
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		// Spend the same work as a real verification, then refuse.
		_, _ = auth.VerifyPassword(body.Password, absentAccountHash)
		httpx.Error(w, http.StatusUnauthorized, "invalid email or password", nil)
		return
	case err != nil:
		httpx.Error(w, http.StatusInternalServerError, "could not read the account", err)
		return
	}

	// An account with no password cannot sign in. No password is not the same
	// as any password, and it is what a profile created before this existed
	// looks like.
	stored := creds.PasswordHash
	if stored == "" {
		stored = absentAccountHash
	}
	ok, err := auth.VerifyPassword(body.Password, stored)
	if err != nil || !ok || creds.PasswordHash == "" {
		httpx.Error(w, http.StatusUnauthorized, "invalid email or password", nil)
		return
	}

	// Checked only after the password, so this answer is reachable only by
	// someone who already holds the credentials for the account.
	if !creds.Approved {
		httpx.Error(w, http.StatusForbidden, "this account has not been approved yet", nil)
		return
	}

	token, expires, err := h.DB.CreateSession(r.Context(), creds.UserID, r.UserAgent())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not start a session", err)
		return
	}
	h.Cookies.SetSession(w, token, expires)
	slog.Info("signed in", "user", creds.UserID)

	// The token is in the body as well as the cookie because the frontend
	// still runs on another origin, where our cookie cannot reach it: it holds
	// its own and sends this back in a header. Once both are served from one
	// origin the cookie is enough and this field can go.
	httpx.JSON(w, http.StatusOK, map[string]any{
		"token":      token,
		"expires_at": expires.UTC().Format(time.RFC3339),
	})
}

// logout revokes the session this request arrived with, and only that one, so
// signing out of a shared machine does not sign the person out of their phone.
func (h Auth) logout(w http.ResponseWriter, r *http.Request) {
	if token := httpx.SessionToken(r); token != "" {
		if err := h.DB.DeleteSession(r.Context(), auth.HashSessionToken(token)); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "could not sign out", err)
			return
		}
	}
	// Cleared unconditionally: a request with no live session still wants the
	// stale cookie gone.
	h.Cookies.SetSession(w, "", time.Time{})
	w.WriteHeader(http.StatusNoContent)
}
