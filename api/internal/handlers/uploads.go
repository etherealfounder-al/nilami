package handlers

import (
	"errors"
	"net/http"
	"time"

	"github.com/UjjwolKayastha/nilami/api/internal/auth"
	"github.com/UjjwolKayastha/nilami/api/internal/httpx"
	"github.com/UjjwolKayastha/nilami/api/internal/storage"
	"github.com/google/uuid"
)

// Uploads issues short-lived permission to write one object to R2.
//
// The bytes never pass through this process or the VPS: the browser PUTs them
// straight to Cloudflare. That keeps a 10 MB photograph off a box with 1 GB of
// memory and out of the request timeout.
type Uploads struct{ Store *storage.Client }

func (h Uploads) Routes(mux *http.ServeMux) {
	mux.HandleFunc("POST /v1/admin/uploads", h.create)
}

// Only formats a browser can display, and only ones R2 will serve inert.
// The extension is derived from this map rather than from a filename, so a
// caller cannot name their way into a key we did not choose.
var allowedTypes = map[string]string{
	"image/jpeg": "jpg",
	"image/png":  "png",
	"image/webp": "webp",
}

// Long enough for a slow connection to finish a large photograph, short enough
// that a leaked URL is worth little.
const uploadWindow = 10 * time.Minute

type uploadRequest struct {
	Kind        string `json:"kind"`
	ContentType string `json:"content_type"`
}

type uploadResponse struct {
	UploadURL string `json:"upload_url"`
	PublicURL string `json:"public_url"`
	Key       string `json:"key"`
	ExpiresIn int    `json:"expires_in"`
}

func (h Uploads) create(w http.ResponseWriter, r *http.Request) {
	if _, ok := staffGate(w, r); !ok {
		return
	}
	var body uploadRequest
	if err := decode(w, r, &body); err != nil {
		return
	}

	ext, ok := allowedTypes[body.ContentType]
	if !ok {
		httpx.Error(w, http.StatusUnsupportedMediaType,
			"only JPEG, PNG and WebP images can be uploaded", nil)
		return
	}

	var prefix string
	switch body.Kind {
	case "property":
		prefix = "properties/"
	case "organization":
		prefix = "organizations/"
	default:
		httpx.Error(w, http.StatusBadRequest, "kind must be property or organization", nil)
		return
	}

	// A fresh name for every upload, never one derived from the record it
	// belongs to.
	//
	// The bucket is served through a caching CDN, so a replacement written to
	// the key it replaces would sit behind the copy already cached — the new
	// logo uploaded, stored, and invisible for as long as the edge keeps the old
	// one. A new key sidesteps the cache entirely, and the old object simply
	// stops being referenced.
	//
	// It also means an upload URL cannot be used to overwrite an existing image:
	// the key did not exist when the URL was signed.
	key := prefix + uuid.NewString() + "." + ext

	url, err := h.Store.PresignPut(key, body.ContentType, uploadWindow, time.Now())
	if err != nil {
		if errors.Is(err, storage.ErrNotConfigured) {
			httpx.Error(w, http.StatusServiceUnavailable,
				"file storage is not configured on this server", nil)
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "could not prepare the upload", err)
		return
	}

	httpx.JSON(w, http.StatusOK, uploadResponse{
		UploadURL: url,
		PublicURL: h.Store.PublicURL(key),
		Key:       key,
		ExpiresIn: int(uploadWindow.Seconds()),
	})
}

// Compile-time proof that the gate above is the shared one; if staffGate's
// signature changes this file stops building rather than silently diverging.
var _ = func(w http.ResponseWriter, r *http.Request) (auth.Scope, bool) { return staffGate(w, r) }
