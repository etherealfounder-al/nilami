package handlers

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/UjjwolKayastha/nilami/api/internal/auth"
	"github.com/UjjwolKayastha/nilami/api/internal/db"
	"github.com/UjjwolKayastha/nilami/api/internal/httpx"
	"github.com/google/uuid"
)

// The panel's writes. Each resolves the caller's scope first and passes it to
// the statement, which applies the same tenant predicate the reads do.

func (h Admin) writeRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /v1/admin/properties", h.saveProperty)
	mux.HandleFunc("PUT /v1/admin/properties/{id}", h.saveProperty)
	mux.HandleFunc("DELETE /v1/admin/properties/{id}", h.deleteProperty)

	mux.HandleFunc("POST /v1/admin/auctions", h.saveAuction)
	mux.HandleFunc("PUT /v1/admin/auctions/{id}", h.saveAuction)
	mux.HandleFunc("PATCH /v1/admin/auctions/{id}/status", h.setAuctionStatus)

	mux.HandleFunc("POST /v1/admin/bidders", h.addBidder)
	mux.HandleFunc("PATCH /v1/admin/bidders/{id}/status", h.setBidderStatus)
	mux.HandleFunc("DELETE /v1/admin/bidders/{id}", h.deleteBidder)
}

// pathID reads an optional {id}; ok is false when one was given but malformed.
func pathID(w http.ResponseWriter, r *http.Request) (*uuid.UUID, bool) {
	raw := r.PathValue("id")
	if raw == "" {
		return nil, true
	}
	id, err := uuid.Parse(raw)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "id is not a uuid", err)
		return nil, false
	}
	return &id, true
}

// writeResult answers a write with the status its error deserves.
func writeResult(w http.ResponseWriter, r *http.Request, s auth.Scope, what string, id uuid.UUID, err error) {
	switch {
	case errors.Is(err, db.ErrNotFound):
		httpx.Error(w, http.StatusNotFound, "not found", nil)
	case errors.Is(err, db.ErrConflict):
		httpx.Error(w, http.StatusConflict, "That slug is already used by another property. Choose a different one.", nil)
	case errors.Is(err, db.ErrValidation):
		httpx.Error(w, http.StatusBadRequest, "Some fields are missing or invalid. Check the form and try again.", nil)
	case err != nil:
		httpx.Error(w, http.StatusInternalServerError, "could not save that", err)
	default:
		attrs := []any{"what", what, "by", s.UserID, "id", id, "method", r.Method}
		if s.Proxied() {
			attrs = append(attrs, "proxied_by", s.ProxiedBy)
		}
		slog.Info("admin write", attrs...)
		httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "id": id})
	}
}

func (h Admin) saveProperty(w http.ResponseWriter, r *http.Request) {
	s, ok := staffGate(w, r)
	if !ok {
		return
	}
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	var in db.PropertyInput
	if err := decode(w, r, &in); err != nil {
		return
	}
	saved, err := h.DB.SaveProperty(r.Context(), s, id, in)
	writeResult(w, r, s, "property", saved, err)
}

func (h Admin) deleteProperty(w http.ResponseWriter, r *http.Request) {
	s, ok := staffGate(w, r)
	if !ok {
		return
	}
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	writeResult(w, r, s, "property delete", *id, h.DB.DeleteProperty(r.Context(), s, *id))
}

func (h Admin) saveAuction(w http.ResponseWriter, r *http.Request) {
	s, ok := staffGate(w, r)
	if !ok {
		return
	}
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	var in db.AuctionInput
	if err := decode(w, r, &in); err != nil {
		return
	}
	saved, err := h.DB.SaveAuction(r.Context(), s, id, in)
	writeResult(w, r, s, "auction", saved, err)
}

type statusBody struct {
	Status string `json:"status"`
}

func (h Admin) setAuctionStatus(w http.ResponseWriter, r *http.Request) {
	s, ok := staffGate(w, r)
	if !ok {
		return
	}
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	var body statusBody
	if err := decode(w, r, &body); err != nil {
		return
	}
	writeResult(w, r, s, "auction status", *id, h.DB.SetAuctionStatus(r.Context(), s, *id, body.Status))
}

func (h Admin) addBidder(w http.ResponseWriter, r *http.Request) {
	s, ok := staffGate(w, r)
	if !ok {
		return
	}
	var in db.BidderInput
	if err := decode(w, r, &in); err != nil {
		return
	}
	id, err := h.DB.AddBidder(r.Context(), s, in)
	writeResult(w, r, s, "bidder", id, err)
}

func (h Admin) setBidderStatus(w http.ResponseWriter, r *http.Request) {
	s, ok := staffGate(w, r)
	if !ok {
		return
	}
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	var body statusBody
	if err := decode(w, r, &body); err != nil {
		return
	}
	writeResult(w, r, s, "bidder status", *id, h.DB.SetBidderStatus(r.Context(), s, *id, body.Status))
}

func (h Admin) deleteBidder(w http.ResponseWriter, r *http.Request) {
	s, ok := staffGate(w, r)
	if !ok {
		return
	}
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	writeResult(w, r, s, "bidder delete", *id, h.DB.DeleteBidder(r.Context(), s, *id))
}
