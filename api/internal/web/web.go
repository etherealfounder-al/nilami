// Package web serves everything that is not the API: the public pages, which
// this process renders, and the admin app, which it serves as a built bundle.
package web

import (
	"bytes"
	"compress/gzip"
	"embed"
	"encoding/json"
	"fmt"
	"html/template"
	"io/fs"
	"net/http"
	"path"
	"strconv"
	"strings"
)

// dist is filled by copying web/dist here before `go build`. The committed
// .gitkeep keeps this embed valid on a fresh checkout, where the panel answers
// 503 until the frontend has been built.
//
//go:embed all:dist
var distFS embed.FS

// Assets names the files the templates link. Vite hashes them, so the names
// change every build and cannot be written into a template by hand; they are
// read from the manifest it emits.
type Assets struct {
	CSS string
	JS  string
}

type Server struct {
	files     fs.FS
	assets    Assets
	templates map[string]*template.Template
	// gzipped holds each text asset compressed once at start-up. They are
	// immutable — their names carry a content hash — so compressing them per
	// request would spend CPU on every page view to produce the same bytes.
	gzipped map[string][]byte
	// built reports whether the frontend was built into this binary. Without
	// it the API still answers, which keeps the public pages serving while the
	// panel is unavailable rather than taking everything down together.
	built bool
}

// New reads the embedded bundle and the asset names out of its manifest.
func New() (*Server, error) {
	files, err := fs.Sub(distFS, "dist")
	if err != nil {
		return nil, err
	}
	s := &Server{files: files}
	if err := s.parseTemplates(); err != nil {
		return nil, err
	}

	if _, err := fs.Stat(files, "index.html"); err != nil {
		// A fresh checkout, or a build that skipped the frontend.
		return s, nil
	}
	s.built = true

	raw, err := fs.ReadFile(files, ".vite/manifest.json")
	if err != nil {
		return nil, fmt.Errorf("web: the bundle has no manifest: %w", err)
	}
	var manifest map[string]struct {
		File string   `json:"file"`
		CSS  []string `json:"css"`
	}
	if err := json.Unmarshal(raw, &manifest); err != nil {
		return nil, fmt.Errorf("web: manifest: %w", err)
	}
	for _, entry := range manifest {
		if entry.File != "" && strings.HasSuffix(entry.File, ".js") {
			s.assets.JS = "/" + entry.File
			if len(entry.CSS) > 0 {
				s.assets.CSS = "/" + entry.CSS[0]
			}
		}
	}
	if s.assets.CSS == "" || s.assets.JS == "" {
		return nil, fmt.Errorf("web: manifest names no stylesheet or script")
	}
	if err := s.precompress(); err != nil {
		return nil, err
	}
	return s, nil
}

// Assets exposes the hashed names so the page templates can link them.
func (s *Server) Assets() Assets { return s.assets }

// Static serves the built files under /assets/.
//
// Their names carry a content hash, so a name only ever means one body and the
// response can be cached for a year. Anything else under /assets/ is a 404
// rather than a fall-through to the app, so a mistyped asset fails as an asset
// instead of returning HTML with a 200.
func (s *Server) Static() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		name := strings.TrimPrefix(r.URL.Path, "/")
		f, err := s.files.Open(name)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		defer f.Close()
		info, err := f.Stat()
		if err != nil || info.IsDir() {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")

		// Nothing else on the path compresses: Go's file server does not, and
		// the proxy serves this host DNS-only so Cloudflare never sees it.
		// Uncompressed, the stylesheet alone is 29 KB where it could be 6.
		if body, ok := s.gzipped[name]; ok && acceptsGzip(r) {
			w.Header().Set("Content-Encoding", "gzip")
			w.Header().Set("Vary", "Accept-Encoding")
			w.Header().Set("Content-Type", contentType(name))
			w.Header().Set("Content-Length", strconv.Itoa(len(body)))
			_, _ = w.Write(body)
			return
		}

		rs, ok := f.(interface {
			Read([]byte) (int, error)
			Seek(int64, int) (int64, error)
		})
		if !ok {
			http.NotFound(w, r)
			return
		}
		http.ServeContent(w, r, info.Name(), info.ModTime(), rs)
	})
}

// Admin serves the single-page app for every path under /admin.
//
// The router runs in the browser, so every one of those paths has to return
// the same document; letting them 404 would break a refresh on any screen but
// the first. The document itself is never cached — it names the hashed assets,
// and a stale copy would name assets that no longer exist.
func (s *Server) Admin() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !s.built {
			http.Error(w, "the admin app has not been built into this binary", http.StatusServiceUnavailable)
			return
		}
		body, err := fs.ReadFile(s.files, "index.html")
		if err != nil {
			http.Error(w, "the admin app is missing", http.StatusServiceUnavailable)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Robots-Tag", "noindex")
		_, _ = w.Write(body)
	})
}

//go:embed icon.svg
var iconSVG []byte

// Routes registers everything this process serves that is not the API.
//
// The public pages are rendered here rather than fetched from this same
// process over HTTP: the data and the template are both in this binary, so a
// request to ourselves would only add a round trip and a second way to fail.
func (s *Server) Routes(mux *http.ServeMux) {
	mux.Handle("GET /assets/", s.Static())
	mux.HandleFunc("GET /icon.svg", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "image/svg+xml")
		w.Header().Set("Cache-Control", "public, max-age=86400")
		_, _ = w.Write(iconSVG)
	})

	// Every path under the panel returns the same document, because its router
	// runs in the browser.
	mux.Handle("GET /admin", s.Admin())
	mux.Handle("GET /admin/", s.Admin())

	mux.HandleFunc("GET /lang/{lang}", SetLanguage)

	mux.HandleFunc("GET /how-it-works", func(w http.ResponseWriter, r *http.Request) {
		page := s.newPage(r, "How it works · Nilami",
			"How a bank asset auction works on Nilami: finding a notice, the bid security deposit, submitting a sealed bid, and what happens on opening day.")
		s.render(w, r, "how", page)
	})
}

// precompress gzips the text assets once. Fonts and images are already
// compressed formats, so running them through gzip costs memory and saves
// nothing.
func (s *Server) precompress() error {
	s.gzipped = map[string][]byte{}
	return fs.WalkDir(s.files, "assets", func(name string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		switch path.Ext(name) {
		case ".css", ".js", ".svg", ".json":
		default:
			return nil
		}
		raw, err := fs.ReadFile(s.files, name)
		if err != nil {
			return err
		}
		var buf bytes.Buffer
		zw, err := gzip.NewWriterLevel(&buf, gzip.BestCompression)
		if err != nil {
			return err
		}
		if _, err := zw.Write(raw); err != nil {
			return err
		}
		if err := zw.Close(); err != nil {
			return err
		}
		// Only keep it if it actually helps.
		if buf.Len() < len(raw) {
			s.gzipped[name] = buf.Bytes()
		}
		return nil
	})
}

func acceptsGzip(r *http.Request) bool {
	return strings.Contains(r.Header.Get("Accept-Encoding"), "gzip")
}

func contentType(name string) string {
	switch path.Ext(name) {
	case ".css":
		return "text/css; charset=utf-8"
	case ".js":
		return "text/javascript; charset=utf-8"
	case ".svg":
		return "image/svg+xml"
	case ".json":
		return "application/json"
	}
	return "application/octet-stream"
}
