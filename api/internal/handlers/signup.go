package handlers

import (
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/UjjwolKayastha/nilami/api/internal/db"
	"github.com/UjjwolKayastha/nilami/api/internal/httpx"
	"github.com/UjjwolKayastha/nilami/api/internal/supabase"
	"github.com/google/uuid"
)

// Signup creates the profile for a new staff account.
//
// Under Supabase a trigger on auth.users did this the moment the account was
// created. That table is in another system now, and the new account cannot sign
// in until it is approved, so it cannot create its own profile either. Instead
// the Next server reports the new account's id right after signUp, and this
// handler reads the account back from Supabase itself — the request supplies
// only an id, never the institution or role, so nothing in it can be forged.
//
// Mounted under /v1/pages/, behind the service token: only our server calls it.
type Signup struct {
	DB   *db.DB
	Auth *supabase.Admin
}

// A signup is provisioned within this long of the account being created. Older,
// unconfirmed accounts are left alone so the endpoint cannot be used to revive
// an abandoned signup.
const signupWindow = time.Hour

func (h Signup) Routes(mux *http.ServeMux) {
	mux.HandleFunc("GET /v1/pages/signup/organizations", h.organizations)
	mux.HandleFunc("POST /v1/pages/signup/profile", h.provision)
}

func (h Signup) organizations(w http.ResponseWriter, r *http.Request) {
	doc, err := h.DB.SignupOrganizations(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not load institutions", err)
		return
	}
	httpx.RawJSON(w, http.StatusOK, doc, "private, no-store")
}

type provisionBody struct {
	UserID string `json:"user_id"`
}

func (h Signup) provision(w http.ResponseWriter, r *http.Request) {
	var body provisionBody
	if err := decode(w, r, &body); err != nil {
		return
	}
	id, err := uuid.Parse(body.UserID)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "user_id is not a uuid", err)
		return
	}
	if !h.Auth.Configured() {
		httpx.Error(w, http.StatusServiceUnavailable,
			"the identity provider key is not configured on this server", nil)
		return
	}

	u, err := h.Auth.GetUser(r.Context(), id)
	switch {
	case errors.Is(err, supabase.ErrNoSuchUser):
		httpx.Error(w, http.StatusNotFound, "no such account", nil)
		return
	case err != nil:
		httpx.Error(w, http.StatusBadGateway, "could not read the account", err)
		return
	}
	if u.EmailConfirmedAt != nil || time.Since(u.CreatedAt) > signupWindow {
		httpx.Error(w, http.StatusConflict, "that account is not a new signup", nil)
		return
	}
	org, err := uuid.Parse(u.Metadata.OrganizationID)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "the account names no institution", nil)
		return
	}

	// ProvisionProfile binds the row to an institution that exists, forces it
	// unapproved and confines the role, so the metadata cannot escalate.
	if err := h.DB.ProvisionProfile(r.Context(), u.ID, u.Email, u.Metadata.FullName, u.Metadata.SignupRole, org); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not create the profile", err)
		return
	}
	slog.Info("signup provisioned", "user", u.ID, "org", org)
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
}
