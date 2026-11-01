package web

import (
	"html/template"
	"net/http"
	"time"

	"github.com/UjjwolKayastha/nilami/api/locales"
)

// LangCookie is where the reader's choice of language is kept. The same name
// the Next app used, so nobody's existing choice is forgotten in the move.
const LangCookie = "lang"

// Page is what every template is given: the chrome, and whatever that page
// needs in Data.
type Page struct {
	Lang        string
	Assets      Assets
	Title       string
	Description string
	// Path the reader is on, for marking the current link and for sending the
	// language switch back where it came from.
	Path     string
	SignedIn bool
	Year     int
	// Canonical and alternate links, which matter because these pages exist to
	// be found.
	Canonical string
	Data      any

	dict *locales.Dict
}

// S reads a plain string: {{.S "nav.auctions"}}.
func (p Page) S(path string) string { return p.dict.Get(path) }

// T fills a format string: {{.T "listing.count" "n" 12}}.
func (p Page) T(path string, args ...any) string { return p.dict.T(path, args...) }

// List reads an array of strings, such as the footer's platform lines.
func (p Page) List(path string) []string { return p.dict.List(path) }

// Items reads an array of objects, such as the steps on how-it-works.
func (p Page) Items(path string) []map[string]string { return p.dict.Items(path) }

// IsNepali reports the current language, for the switcher's active state.
func (p Page) IsNepali() bool { return p.Lang == string(locales.NE) }

// newPage assembles the chrome for one request.
func (s *Server) newPage(r *http.Request, title, description string) Page {
	lang := locales.EN
	if c, err := r.Cookie(LangCookie); err == nil {
		lang = locales.Parse(c.Value)
	}
	_, signedIn := sessionCookie(r)
	return Page{
		Lang:        string(lang),
		Assets:      s.assets,
		Title:       title,
		Description: description,
		Path:        r.URL.Path,
		SignedIn:    signedIn,
		Year:        time.Now().Year(),
		dict:        locales.For(lang),
	}
}

// sessionCookie reports whether the reader is signed in, which only changes a
// label in the header. Its value is never trusted here: the panel asks the API
// who they are, and this process asserts nothing.
func sessionCookie(r *http.Request) (string, bool) {
	c, err := r.Cookie("nilami_session")
	if err != nil || c.Value == "" {
		return "", false
	}
	return c.Value, true
}

// SetLanguage records a reader's choice and sends them back to the page they
// were on.
//
// A link and a redirect rather than a script, so it works before any
// JavaScript has run and on a browser that never runs it. The destination is
// taken as a path only, never a whole URL, so this cannot be pointed at
// another site.
func SetLanguage(w http.ResponseWriter, r *http.Request) {
	lang := locales.Parse(r.PathValue("lang"))
	http.SetCookie(w, &http.Cookie{
		Name:     LangCookie,
		Value:    string(lang),
		Path:     "/",
		MaxAge:   int((365 * 24 * time.Hour).Seconds()),
		HttpOnly: false, // the browser does not read it; neither must a script need to
		SameSite: http.SameSiteLaxMode,
	})
	http.Redirect(w, r, safePath(r.URL.Query().Get("to")), http.StatusSeeOther)
}

// safePath keeps a redirect inside this site. A value starting with two
// slashes is a protocol-relative URL to somewhere else, which is the way this
// is usually abused.
func safePath(p string) string {
	if p == "" || p[0] != '/' || (len(p) > 1 && p[1] == '/') {
		return "/"
	}
	return p
}

// tmplFuncs are the few helpers the templates need that Go does not provide.
var tmplFuncs = template.FuncMap{
	"group": locales.Group,
	// Numbering a list that the template ranges over, since Go's range gives
	// a zero-based index and a reader counts from one.
	"add": func(a, b int) int { return a + b },
}
