// Package handlers maps HTTP routes onto the page-shaped queries.
//
// Endpoints are named for the page they serve rather than the table they read.
// That is the point of owning the API: the listing page costs one request and
// one query instead of the five a table-per-call interface would need over a
// link between Vercel and a VPS.
package handlers

import (
	"bytes"
	"errors"
	"net/http"

	"github.com/UjjwolKayastha/nilami/api/internal/db"
	"github.com/UjjwolKayastha/nilami/api/internal/httpx"
	"github.com/jackc/pgx/v5"
)

type Public struct{ DB *db.DB }

func (h Public) Routes(mux *http.ServeMux) {
	mux.HandleFunc("GET /v1/pages/home", h.home)
	mux.HandleFunc("GET /v1/pages/listing/{slug}", h.listing)
}

// Public reads are identical for every visitor, so they carry a short shared
// cache. stale-while-revalidate lets Vercel serve instantly and refresh behind
// the request, which matters far more once the database is a continent away.
const publicCache = "public, max-age=30, stale-while-revalidate=300"

func (h Public) home(w http.ResponseWriter, r *http.Request) {
	doc, err := h.DB.HomeSummary(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not load the home page", err)
		return
	}
	httpx.RawJSON(w, http.StatusOK, doc, publicCache)
}

func (h Public) listing(w http.ResponseWriter, r *http.Request) {
	// The slug arrives decoded here: Go's router unescapes path values, unlike
	// Next's dynamic segments, which hand over the raw percent-encoded text.
	slug := r.PathValue("slug")
	if slug == "" {
		httpx.Error(w, http.StatusBadRequest, "missing slug", nil)
		return
	}
	doc, err := h.DB.Listing(r.Context(), slug)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.Error(w, http.StatusNotFound, "no such listing", nil)
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "could not load the listing", err)
		return
	}
	if bytes.Equal(doc, []byte("null")) {
		httpx.Error(w, http.StatusNotFound, "no such listing", nil)
		return
	}
	httpx.RawJSON(w, http.StatusOK, doc, publicCache)
}
