package web

import (
	"encoding/xml"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// The document has to parse, because a crawler that cannot read it learns
// nothing and says nothing about why.
func TestSitemapIsWellFormedXML(t *testing.T) {
	out := sitemapXML("https://nilami.example", []sitemapEntry{
		{Slug: "house-in-lalitpur", LastMod: time.Date(2026, 11, 2, 10, 30, 0, 0, time.UTC)},
	})
	var doc struct {
		URLs []struct {
			Loc     string `xml:"loc"`
			LastMod string `xml:"lastmod"`
		} `xml:"url"`
	}
	if err := xml.Unmarshal(out, &doc); err != nil {
		t.Fatalf("sitemap does not parse: %v\n%s", err, out)
	}
	if len(doc.URLs) != 4 {
		t.Fatalf("want 3 static addresses and 1 notice, got %d", len(doc.URLs))
	}
	last := doc.URLs[3]
	if last.Loc != "https://nilami.example/auctions/house-in-lalitpur" {
		t.Errorf("notice address: %q", last.Loc)
	}
	if last.LastMod != "2026-11-02T10:30:00Z" {
		t.Errorf("lastmod: %q", last.LastMod)
	}
}

// A lastmod a crawler cannot verify is one it believes. How it works does not
// change when a notice does, so it claims nothing; an empty register leaves
// the other two silent rather than dating them to the zero time.
func TestSitemapOnlyDatesWhatItKnows(t *testing.T) {
	newest := time.Date(2026, 11, 2, 9, 0, 0, 0, time.UTC)
	out := string(sitemapXML("https://nilami.example", []sitemapEntry{
		{Slug: "older", LastMod: time.Date(2026, 10, 1, 9, 0, 0, 0, time.UTC)},
		{Slug: "newest", LastMod: newest},
	}))
	for _, want := range []string{
		"<loc>https://nilami.example/</loc><lastmod>2026-11-02T09:00:00Z</lastmod>",
		"<loc>https://nilami.example/auctions</loc><lastmod>2026-11-02T09:00:00Z</lastmod>",
		"<loc>https://nilami.example/how-it-works</loc></url>",
	} {
		if !strings.Contains(out, want) {
			t.Errorf("missing %q in\n%s", want, out)
		}
	}

	empty := string(sitemapXML("https://nilami.example", nil))
	if strings.Contains(empty, "lastmod") {
		t.Errorf("an empty register dated something:\n%s", empty)
	}
	if !strings.Contains(empty, "<loc>https://nilami.example/how-it-works</loc>") {
		t.Errorf("the static pages went missing when there were no notices:\n%s", empty)
	}
}

// Slugs are generated rather than typed, but they arrive here from the
// database, and an address in an XML document is not where to start trusting
// that. A raw & alone makes the file unparseable.
func TestSitemapEscapesAddresses(t *testing.T) {
	out := sitemapXML("https://nilami.example", []sitemapEntry{
		{Slug: `a&b<c>"d`, LastMod: time.Now()},
	})
	if strings.Contains(string(out), `a&b<c>`) {
		t.Fatalf("an address went in unescaped:\n%s", out)
	}
	var doc struct{}
	if err := xml.Unmarshal(out, &doc); err != nil {
		t.Fatalf("a hostile slug broke the document: %v\n%s", err, out)
	}
}

// robots.txt names the sitemap on the host the request arrived on, because
// this binary answers to more than one during a move.
func TestRobotsPointsAtTheSitemapOnThisHost(t *testing.T) {
	s := &Server{}
	for _, c := range []struct {
		name, proto, want string
	}{
		{"behind a proxy", "https", "Sitemap: https://nilami.example/sitemap.xml"},
		{"direct and plain", "", "Sitemap: http://nilami.example/sitemap.xml"},
	} {
		t.Run(c.name, func(t *testing.T) {
			r := httptest.NewRequest("GET", "http://nilami.example/robots.txt", nil)
			if c.proto != "" {
				r.Header.Set("X-Forwarded-Proto", c.proto)
			}
			w := httptest.NewRecorder()
			s.Robots()(w, r)

			if w.Code != 200 {
				t.Fatalf("status %d", w.Code)
			}
			body := w.Body.String()
			if !strings.Contains(body, c.want) {
				t.Errorf("want %q in\n%s", c.want, body)
			}
			// The panel is a bundle behind a sign-in and the switches are
			// cookie-setting redirects. None is a document.
			for _, path := range []string{"/admin", "/lang/", "/theme/", "/v1/"} {
				if !strings.Contains(body, "Disallow: "+path+"\n") {
					t.Errorf("%s is not disallowed:\n%s", path, body)
				}
			}
		})
	}
}
