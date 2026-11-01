package handlers

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/UjjwolKayastha/nilami/api/internal/auth"
	"github.com/UjjwolKayastha/nilami/api/internal/db"
	"github.com/UjjwolKayastha/nilami/api/internal/httpx"
	"github.com/google/uuid"
)

// Signup registers a staff account and leaves it waiting for approval.
//
// It used to be two systems: Supabase created the account, then this service
// read it back through the admin API and copied the metadata into a profile.
// Either half could fail on its own, so the states in between — an account
// with no profile, a profile for an account that was never created — had to be
// detected and swept. Both the account and the profile are one row here now,
// so there is one statement that either happens or does not, and those states
// cannot occur.
type Signup struct {
	DB *db.DB
}

func (h Signup) Routes(mux *http.ServeMux) {
	mux.HandleFunc("GET /v1/pages/signup/organizations", h.organizations)
	mux.HandleFunc("POST /v1/pages/signup", h.register)
}

func (h Signup) organizations(w http.ResponseWriter, r *http.Request) {
	doc, err := h.DB.SignupOrganizations(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not load institutions", err)
		return
	}
	httpx.RawJSON(w, http.StatusOK, doc, "private, no-store")
}

type signupBody struct {
	Email          string `json:"email"`
	Password       string `json:"password"`
	FullName       string `json:"full_name"`
	OrganizationID string `json:"organization_id"`
	Role           string `json:"role"`
}

func (h Signup) register(w http.ResponseWriter, r *http.Request) {
	var body signupBody
	if err := decode(w, r, &body); err != nil {
		return
	}

	email := strings.TrimSpace(body.Email)
	fullName := strings.TrimSpace(body.FullName)
	switch {
	case email == "" || !strings.Contains(email, "@"):
		httpx.Error(w, http.StatusBadRequest, "a valid email address is required", nil)
		return
	case fullName == "":
		httpx.Error(w, http.StatusBadRequest, "your name is required", nil)
		return
	case utf8.RuneCountInString(body.Password) < auth.MinPasswordLength:
		httpx.Error(w, http.StatusBadRequest,
			"the password is too short; use at least "+strconv.Itoa(auth.MinPasswordLength)+" characters", nil)
		return
	}

	org, err := uuid.Parse(strings.TrimSpace(body.OrganizationID))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "choose an institution", nil)
		return
	}

	hash, err := auth.HashPassword(body.Password)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not register the account", err)
		return
	}

	// The role travels from the form and is confined by the database layer, as
	// is the institution; approved is written false there rather than taken
	// from here. Nothing in this body can widen what the account may do.
	id, err := h.DB.CreateSignup(r.Context(), email, fullName, body.Role, org, hash)
	switch {
	case errors.Is(err, db.ErrEmailTaken):
		httpx.Error(w, http.StatusConflict, "that email address already has an account", nil)
		return
	case errors.Is(err, db.ErrNotFound):
		httpx.Error(w, http.StatusBadRequest, "that institution does not exist", nil)
		return
	case err != nil:
		httpx.Error(w, http.StatusInternalServerError, "could not register the account", err)
		return
	}

	slog.Info("signup registered", "user", id, "org", org)
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
}
