package web

import (
	"encoding/json"
	"encoding/xml"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"
)

// What a crawler needs that a page cannot tell it: which addresses exist, and
// when each last changed.
//
// These pages are rendered here and ship no JavaScript so that a crawler, and
// the link previews in Viber and WhatsApp, can read them without running a
// bundle. That makes every notice readable. It does not make one findable:
// without a sitemap a crawler reaches a notice only by walking a paginated
// register. A notice is worth indexing in the weeks before its deadline and
// not after, so the delay between publishing one and a crawler learning it
// exists is the whole of what these two files are for.

type sitemapEntry struct {
	Slug    string    `json:"slug"`
	LastMod time.Time `json:"lastmod"`
}

// Robots answers /robots.txt.
//
// Its absence already means "crawl everything", so this exists to say the two
// things a crawler cannot work out alone. Where the sitemap is. And which
// paths are not documents: /lang/ and /theme/ each answer with a redirect
// that sets a cookie, which tells a reader nothing and is a trap to a
// crawler, while the panel is a bundle behind a sign-in. The panel is already
// served with X-Robots-Tag: noindex; this is what stops it being fetched at
// all. /assets/ stays open deliberately — a crawler that cannot read the
// stylesheet cannot judge the layout it produces.
func (s *Server) Robots() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.Header().Set("Cache-Control", "public, max-age=86400")
		_, _ = io.WriteString(w, "User-agent: *\n"+
			"Allow: /\n"+
			"Disallow: /admin\n"+
			"Disallow: /lang/\n"+
			"Disallow: /theme/\n"+
			"Disallow: /v1/\n"+
			"\n"+
			"Sitemap: "+s.origin(r)+"/sitemap.xml\n")
	}
}

// Sitemap answers /sitemap.xml.
func (s *Server) Sitemap() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		raw, err := s.db.Sitemap(r.Context())
		if err != nil {
			slog.Error("sitemap", "err", err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		var entries []sitemapEntry
		if err := json.Unmarshal(raw, &entries); err != nil {
			slog.Error("sitemap", "err", err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/xml; charset=utf-8")
		// An hour: long enough that a crawler rereading it costs a query
		// rather than a habit, short enough that a notice published this
		// morning is in the file this afternoon.
		w.Header().Set("Cache-Control", "public, max-age=3600")
		_, _ = w.Write(sitemapXML(s.origin(r), entries))
	}
}

// sitemapXML builds the document. Kept apart from the request so it can be
// tested without a database, and so the escaping has one home.
func sitemapXML(origin string, entries []sitemapEntry) []byte {
	var b strings.Builder
	b.WriteString(xml.Header)
	b.WriteString(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` + "\n")

	// The home page and the register both show the notices, so they change
	// whenever any notice does and carry the newest of their timestamps. How
	// it works does not change with the data, and gets none: a lastmod that
	// is not true is worse than no lastmod, because a crawler believes it.
	var newest time.Time
	for _, e := range entries {
		if e.LastMod.After(newest) {
			newest = e.LastMod
		}
	}
	writeURL(&b, origin+"/", newest)
	writeURL(&b, origin+"/auctions", newest)
	writeURL(&b, origin+"/how-it-works", time.Time{})

	// Closed and sold notices stay in: the page still answers 200, still
	// reads as the record of a completed auction, and dropping it would
	// retract an address people may have been sent.
	for _, e := range entries {
		writeURL(&b, origin+"/auctions/"+e.Slug, e.LastMod)
	}

	b.WriteString("</urlset>\n")
	return []byte(b.String())
}

func writeURL(b *strings.Builder, loc string, mod time.Time) {
	b.WriteString("  <url><loc>")
	// A slug is generated, not typed, but it reaches here from the database
	// and an address is not the place to start trusting that.
	_ = xml.EscapeText(b, []byte(loc))
	b.WriteString("</loc>")
	if !mod.IsZero() {
		b.WriteString("<lastmod>")
		b.WriteString(mod.UTC().Format(time.RFC3339))
		b.WriteString("</lastmod>")
	}
	b.WriteString("</url>\n")
}
