package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/UjjwolKayastha/nilami/api/internal/auth"
	"github.com/UjjwolKayastha/nilami/api/internal/db"
	"github.com/UjjwolKayastha/nilami/api/internal/httpx"
	"github.com/UjjwolKayastha/nilami/api/internal/supabase"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// Admin serves the panel. Every handler resolves its authority from the verified
// token before it touches anything, and the institution it may act on comes from
// that scope rather than from the request.
type Admin struct {
	DB   *db.DB
	Auth *supabase.Admin
}

func (h Admin) Routes(mux *http.ServeMux) {
	mux.HandleFunc("GET /v1/admin/me", h.scoped(h.DB.Viewer))
	mux.HandleFunc("GET /v1/admin/dashboard", h.scoped(h.DB.Dashboard))
	mux.HandleFunc("GET /v1/admin/properties", h.scoped(h.DB.PropertiesList))
	mux.HandleFunc("GET /v1/admin/auctions", h.scoped(h.DB.AuctionsList))
	mux.HandleFunc("GET /v1/admin/staff", h.scoped(h.DB.Staff))
	mux.HandleFunc("GET /v1/admin/institutions", h.scoped(h.DB.InstitutionOptions))
	mux.HandleFunc("GET /v1/admin/bidders", h.scoped(h.DB.AllBidders))

	mux.HandleFunc("GET /v1/admin/properties/{id}", h.byID(h.DB.PropertyDetail))
	mux.HandleFunc("GET /v1/admin/auctions/{id}", h.byID(h.DB.AuctionDetail))
	mux.HandleFunc("GET /v1/admin/auctions/{id}/bidders", h.byID(h.DB.Bidders))

	mux.HandleFunc("GET /v1/admin/institution", h.institution)
	mux.HandleFunc("PATCH /v1/admin/institution", h.updateBranding)

	mux.HandleFunc("POST /v1/admin/staff/{id}/approve", h.approveStaff)
	mux.HandleFunc("POST /v1/admin/staff/{id}/reject", h.rejectStaff)

	h.writeRoutes(mux)

	// Unauthenticated by design: the signup form submits it before an account
	// exists. Its limits live in the query.
	mux.HandleFunc("POST /v1/organizations/requests", h.requestOrganization)
}

// Admin responses are per-institution and must never be cached by anything in
// front of us. A shared cache here would serve one institution's rows to
// another.
const adminCache = "private, no-store"

// scoped wraps the reads that need nothing but the caller's authority. Passing
// the query in means the gate cannot be omitted from one route by accident.
func (h Admin) scoped(q func(context.Context, auth.Scope) ([]byte, error)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		s, ok := staffGate(w, r)
		if !ok {
			return
		}
		doc, err := q(r.Context(), s)
		writeDoc(w, doc, err, "could not load that")
	}
}

// byID is the same for the reads that address a single row. The id is only ever
// a filter: the scope still decides whether the row is visible, so guessing an
// id belonging to another institution returns 404, not the row.
func (h Admin) byID(q func(context.Context, auth.Scope, string) ([]byte, error)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		s, ok := staffGate(w, r)
		if !ok {
			return
		}
		doc, err := q(r.Context(), s, r.PathValue("id"))
		writeDoc(w, doc, err, "could not load that")
	}
}

// staffGate resolves the scope every admin handler needs, writing the refusal
// itself so no handler has to remember which failure is which.
func staffGate(w http.ResponseWriter, r *http.Request) (auth.Scope, bool) {
	s, err := auth.RequireStaff(r.Context())
	switch {
	case errors.Is(err, auth.ErrNoIdentity):
		httpx.Error(w, http.StatusUnauthorized, "sign in required", nil)
		return s, false
	case errors.Is(err, auth.ErrNotApproved):
		// Distinct from 401 on purpose: the account is real and simply not
		// admitted yet, and the panel shows a different screen for each.
		httpx.Error(w, http.StatusForbidden, "account is awaiting approval", nil)
		return s, false
	case err != nil:
		httpx.Error(w, http.StatusForbidden, "not permitted", nil)
		return s, false
	}
	return s, true
}

func (h Admin) institution(w http.ResponseWriter, r *http.Request) {
	s, ok := staffGate(w, r)
	if !ok {
		return
	}
	doc, err := h.DB.Institution(r.Context(), s, r.URL.Query().Get("org"))
	writeDoc(w, doc, err, "could not load the institution")
}

type brandingBody struct {
	OrganizationID string `json:"organization_id"`
	LogoURL        string `json:"logo_url"`
	Website        string `json:"website"`
	ContactEmail   string `json:"contact_email"`
	ContactPhone   string `json:"contact_phone"`
	Address        string `json:"address"`
	AddressNp      string `json:"address_np"`
}

func (h Admin) updateBranding(w http.ResponseWriter, r *http.Request) {
	s, ok := staffGate(w, r)
	if !ok {
		return
	}
	var body brandingBody
	if err := decode(w, r, &body); err != nil {
		return
	}

	// Staff may only ever edit their own institution, so an absent or foreign id
	// resolves to theirs rather than being refused — the form has no reason to
	// send one, and UpdateBranding rejects a foreign id regardless.
	org := s.OrganizationID
	if s.IsPlatformAdmin || body.OrganizationID != "" {
		parsed, err := uuid.Parse(body.OrganizationID)
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, "organization_id is not a uuid", err)
			return
		}
		org = parsed
	}

	err := h.DB.UpdateBranding(r.Context(), s, org, db.OrganizationBranding{
		LogoURL:      body.LogoURL,
		Website:      body.Website,
		ContactEmail: body.ContactEmail,
		ContactPhone: body.ContactPhone,
		Address:      body.Address,
		AddressNp:    body.AddressNp,
	})
	switch {
	case errors.Is(err, auth.ErrForbidden):
		httpx.Error(w, http.StatusForbidden, "you can only edit your own institution", nil)
	case errors.Is(err, db.ErrNotFound):
		httpx.Error(w, http.StatusNotFound, "no such institution", nil)
	case err != nil:
		httpx.Error(w, http.StatusInternalServerError, "could not save the institution", err)
	default:
		if s.Proxied() {
			slog.Info("branding updated while proxied", "admin", s.ProxiedBy, "as", s.UserID, "org", org)
		}
		httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
	}
}

func (h Admin) approveStaff(w http.ResponseWriter, r *http.Request) {
	s, target, ok := h.staffTarget(w, r)
	if !ok {
		return
	}
	if err := h.DB.ApproveStaff(r.Context(), s, target); err != nil {
		if errors.Is(err, db.ErrNotFound) {
			httpx.Error(w, http.StatusNotFound, "no such account", nil)
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "could not approve the account", err)
		return
	}

	// Approval is only real once Supabase lets them in. Reported as a partial
	// success rather than a failure: the profile is approved, and retrying the
	// same request finishes the job.
	if err := h.Auth.ConfirmEmail(r.Context(), target); err != nil {
		slog.Error("approved but not confirmed in supabase", "target", target, "error", err)
		httpx.JSON(w, http.StatusAccepted, map[string]any{
			"ok":      true,
			"warning": "Approved here, but the account could not be confirmed with the identity provider. They cannot sign in until this is retried.",
		})
		return
	}
	slog.Info("staff approved", "by", s.UserID, "target", target)
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h Admin) rejectStaff(w http.ResponseWriter, r *http.Request) {
	s, target, ok := h.staffTarget(w, r)
	if !ok {
		return
	}

	// The account goes first. If the second step fails the leftover is a profile
	// nobody can authenticate as, which the panel can clear; the other order
	// would leave a working login instead.
	if err := h.Auth.DeleteUser(r.Context(), target); err != nil {
		httpx.Error(w, http.StatusBadGateway, "could not remove the account from the identity provider", err)
		return
	}
	if err := h.DB.RejectStaff(r.Context(), s, target); err != nil {
		switch {
		case errors.Is(err, db.ErrSelfReject):
			httpx.Error(w, http.StatusBadRequest, "cannot reject your own account", nil)
		case errors.Is(err, db.ErrNotFound):
			httpx.Error(w, http.StatusNotFound, "no such account", nil)
		default:
			httpx.Error(w, http.StatusInternalServerError, "could not reject the account", err)
		}
		return
	}
	slog.Info("staff rejected", "by", s.UserID, "target", target)
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
}

// staffTarget gates the two account operations: platform administrators only,
// never while proxied, and the key must be configured or the write would only
// half happen.
func (h Admin) staffTarget(w http.ResponseWriter, r *http.Request) (auth.Scope, uuid.UUID, bool) {
	s, err := auth.RequirePlatformAdmin(r.Context())
	if err != nil {
		if errors.Is(err, auth.ErrNoIdentity) {
			httpx.Error(w, http.StatusUnauthorized, "sign in required", nil)
		} else {
			httpx.Error(w, http.StatusForbidden, "only the platform administrator can do that", nil)
		}
		return s, uuid.Nil, false
	}
	if !h.Auth.Configured() {
		httpx.Error(w, http.StatusServiceUnavailable,
			"the identity provider key is not configured on this server", nil)
		return s, uuid.Nil, false
	}
	target, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "id is not a uuid", err)
		return s, uuid.Nil, false
	}
	return s, target, true
}

type orgRequestBody struct {
	Name         string `json:"name"`
	NameNp       string `json:"name_np"`
	ContactEmail string `json:"contact_email"`
	ContactPhone string `json:"contact_phone"`
	Address      string `json:"address"`
}

func (h Admin) requestOrganization(w http.ResponseWriter, r *http.Request) {
	var body orgRequestBody
	if err := decode(w, r, &body); err != nil {
		return
	}
	id, err := h.DB.RequestOrganization(r.Context(),
		body.Name, body.NameNp, body.ContactEmail, body.ContactPhone, body.Address)
	switch {
	case errors.Is(err, db.ErrValidation):
		httpx.Error(w, http.StatusBadRequest,
			"Check the institution name and contact email, or try again later.", nil)
	case err != nil:
		httpx.Error(w, http.StatusInternalServerError, "could not register the institution", err)
	default:
		httpx.JSON(w, http.StatusCreated, map[string]any{"id": id})
	}
}

// decode reads a JSON body, capped so a large upload cannot be used to exhaust
// memory, and rejecting unknown fields so a renamed form input fails loudly
// instead of being silently ignored.
func decode(w http.ResponseWriter, r *http.Request, v any) error {
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64<<10))
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		httpx.Error(w, http.StatusBadRequest, "could not read the request body", err)
		return err
	}
	return nil
}

// writeDoc sends a query's JSON document, turning the empty result into a 404.
func writeDoc(w http.ResponseWriter, doc []byte, err error, message string) {
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		httpx.Error(w, http.StatusNotFound, "not found", nil)
	case err != nil:
		httpx.Error(w, http.StatusInternalServerError, message, err)
	default:
		httpx.RawJSON(w, http.StatusOK, doc, adminCache)
	}
}
