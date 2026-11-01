package web

import (
	"bytes"
	"compress/gzip"
	"embed"
	"fmt"
	"html/template"
	"log/slog"
	"net/http"
)

//go:embed templates/*.html
var tmplFS embed.FS

// pages are parsed once at start-up, each as the layout plus its own content.
// Parsing per request would reread the same bytes on every page view, and a
// template that fails to parse should stop the process rather than surface as
// a 500 to the first reader who finds it.
var pageNames = []string{"home", "auctions", "listing", "how"}

func (s *Server) parseTemplates() error {
	s.templates = map[string]*template.Template{}
	for _, name := range pageNames {
		t, err := template.New("layout").Funcs(tmplFuncs).ParseFS(
			tmplFS, "templates/layout.html", "templates/card.html",
			"templates/"+name+".html")
		if err != nil {
			return fmt.Errorf("web: template %s: %w", name, err)
		}
		s.templates[name] = t
	}
	return nil
}

// render writes a page, buffering it first.
//
// A template that fails half way through has already written a 200 and part of
// a document; buffering means a failure is a clean 500 rather than a truncated
// page that looks like the site is broken.
func (s *Server) render(w http.ResponseWriter, r *http.Request, name string, page Page) {
	t, ok := s.templates[name]
	if !ok {
		slog.Error("no such template", "name", name)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	var buf bytes.Buffer
	if err := t.ExecuteTemplate(&buf, "layout", page); err != nil {
		slog.Error("render", "template", name, "err", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Vary", "Accept-Encoding")

	// Rendered per request, so this cannot be precompressed the way the
	// assets are. Ten kilobytes of markup compresses to about three, which is
	// worth the few hundred microseconds on the connections these readers have.
	if acceptsGzip(r) {
		w.Header().Set("Content-Encoding", "gzip")
		zw := gzip.NewWriter(w)
		defer zw.Close()
		_, _ = zw.Write(buf.Bytes())
		return
	}
	_, _ = w.Write(buf.Bytes())
}
