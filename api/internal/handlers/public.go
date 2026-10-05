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
	"strconv"

	"github.com/UjjwolKayastha/nilami/api/internal/db"
	"github.com/UjjwolKayastha/nilami/api/internal/httpx"
	"github.com/jackc/pgx/v5"
)

type Public struct{ DB *db.DB }

func (h Public) Routes(mux *http.ServeMux) {
	mux.HandleFunc("GET /v1/pages/home", h.home)
	mux.HandleFunc("GET /v1/pages/listing/{slug}", h.listing)
	mux.HandleFunc("GET /v1/pages/auctions", h.auctions)
	mux.HandleFunc("POST /v1/pages/listing/{slug}/view", h.recordView)
}

// recordView counts one visit.
//
// It stays behind the service token with the rest of the page routes, so the
// counter can only be moved by our own server deciding a real page was
// rendered. Exposed to browsers it would be a number anyone could type into.
func (h Public) recordView(w http.ResponseWriter, r *http.Request) {
	count, err := h.DB.RecordPropertyView(r.Context(), r.PathValue("slug"))
	switch {
	case errors.Is(err, db.ErrNotFound):
		// No published listing carries this slug. Not an error worth logging:
		// it is what a stale link looks like.
		httpx.Error(w, http.StatusNotFound, "not found", nil)
	case err != nil:
		httpx.Error(w, http.StatusInternalServerError, "could not record the view", err)
	default:
		httpx.JSON(w, http.StatusOK, map[string]any{"view_count": count})
	}
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

// Page sizes the API will honour. An arbitrary size from the query string is
// refused rather than clamped silently, so a caller cannot ask for every row.
var pageSizes = map[int]bool{6: true, 12: true, 24: true, 48: true}

func (h Public) auctions(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()

	size, _ := strconv.Atoi(q.Get("size"))
	if !pageSizes[size] {
		size = 12
	}
	page, _ := strconv.Atoi(q.Get("page"))
	if page < 1 {
		page = 1
	}

	doc, err := h.DB.AuctionsIndex(r.Context(), db.AuctionsIndexParams{
		Status:   q.Get("status"),
		Type:     q.Get("type"),
		District: q.Get("district"),
		Org:      q.Get("org"),
		Query:    q.Get("q"),
		Limit:    size,
		Offset:   (page - 1) * size,
	})
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not load auctions", err)
		return
	}
	httpx.RawJSON(w, http.StatusOK, doc, publicCache)
}
