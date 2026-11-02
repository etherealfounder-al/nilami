package web

import (
	"html/template"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/UjjwolKayastha/nilami/api/locales"
)

// LangCookie is where the reader's choice of language is kept. The same name
// the Next app used, so nobody's existing choice is forgotten in the move.
const LangCookie = "lang"

// ThemeCookie is where a reader's choice of ground is kept.
//
// Held server-side for the same reason the language is: the page is rendered
// with the choice already applied, so there is no moment where the wrong
// theme is painted and then corrected — which is exactly what a script-based
// toggle cannot avoid without blocking the render.
const ThemeCookie = "theme"

// Themes a reader may choose. The empty value is the third option and the
// default: follow whatever the device asks for.
const (
	ThemeAuto  = ""
	ThemeLight = "light"
	ThemeDark  = "dark"
)

func parseTheme(v string) string {
	switch v {
	case ThemeLight, ThemeDark:
		return v
	default:
		return ThemeAuto
	}
}

// SetTheme records the choice and sends the reader back where they were.
//
// Same shape as SetLanguage: a link and a redirect, so it works with no
// JavaScript at all. "auto" clears the cookie and hands the decision back to
// the operating system.
func SetTheme(w http.ResponseWriter, r *http.Request) {
	theme := parseTheme(r.PathValue("theme"))
	c := &http.Cookie{
		Name:     ThemeCookie,
		Value:    theme,
		Path:     "/",
		MaxAge:   int((365 * 24 * time.Hour).Seconds()),
		HttpOnly: false,
		SameSite: http.SameSiteLaxMode,
	}
	if theme == ThemeAuto {
		c.Value = ""
		c.MaxAge = -1
	}
	http.SetCookie(w, c)
	http.Redirect(w, r, safePath(r.URL.Query().Get("to")), http.StatusSeeOther)
}

// Page is what every template is given: the chrome, and whatever that page
// needs in Data.
type Page struct {
	Lang string
	// Theme is "light", "dark", or empty for "follow the device".
	Theme       string
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
	theme := ThemeAuto
	if c, err := r.Cookie(ThemeCookie); err == nil {
		theme = parseTheme(c.Value)
	}
	_, signedIn := sessionCookie(r)
	return Page{
		Lang:        string(lang),
		Theme:       theme,
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

// safePath keeps a redirect inside this site.
//
// Checking the first two bytes is not enough, which is how this got through:
// a browser treats a backslash in the authority position as a slash, so
// "/\\evil.example" is fetched as "//evil.example" and the reader leaves the
// site. Parsing says what a browser will actually do with the value — anything
// carrying a scheme or a host is off-site, whichever way it was spelled.
//
// Control characters are refused as well. They have no business in a path, and
// a newline in a value that reaches a Location header is how a response gets
// split.
func safePath(p string) string {
	if p == "" || p[0] != '/' {
		return "/"
	}
	// Both slashes, before parsing: url.Parse reads "//host/path" as a host
	// but leaves "/\\host" alone, and a browser treats them alike.
	if len(p) > 1 && (p[1] == '/' || p[1] == '\\') {
		return "/"
	}
	for _, r := range p {
		if r < 0x20 || r == 0x7f {
			return "/"
		}
	}
	u, err := url.Parse(p)
	if err != nil || u.Scheme != "" || u.Host != "" {
		return "/"
	}
	return p
}

// tmplFuncs are the few helpers the templates need that Go does not provide.
var tmplFuncs = template.FuncMap{
	// Templates pass whatever the struct field happens to be, so this takes
	// the numeric kinds rather than one of them.
	"group": func(v any) string {
		switch n := v.(type) {
		case int:
			return locales.Group(int64(n))
		case int64:
			return locales.Group(n)
		case float64:
			return locales.Group(int64(n))
		}
		return ""
	},
	// Numbering a list that the template ranges over, since Go's range gives
	// a zero-based index and a reader counts from one.
	"add": func(a, b int) int { return a + b },
	// The rows-per-page choices, so the template offers exactly the sizes the
	// parser will accept rather than a list that can drift from it.
	"pageSizes": func() []int { return PageSizes },
	// Escape a value for use inside a query string. A share link carries this
	// page's own address as a parameter, and an unescaped "&" in it would
	// truncate the link at the first query separator.
	"urlquery": url.QueryEscape,
	"subf":     func(a, b float64) float64 { return a - b },
	"divf":     func(a, b float64) float64 { return a / b },
	// A bounding box around a point, for the map embed. Degrees rather than
	// metres: at Nepal's latitude these are roughly 1.2 km across, which
	// frames a plot with its surrounding streets.
	// Six decimals is about a tenth of a metre, well past what a plot
	// boundary is known to, and it keeps binary-float noise such as
	// 27.689500000000002 out of the address.
	"sub":   func(a, b float64) string { return strconv.FormatFloat(a-b, 'f', 6, 64) },
	"add_f": func(a, b float64) string { return strconv.FormatFloat(a+b, 'f', 6, 64) },
	// Scales a radius inside the map plate, so the marker and its halo are
	// drawn from one number rather than two that can drift apart.
	"mulf": func(a, b float64) float64 { return a * b },
	// Templates cannot follow a pointer, and several money fields are
	// nullable because a notice has no winning amount until it is sold.
	"deref": func(f *float64) float64 {
		if f == nil {
			return 0
		}
		return *f
	},
	"itoa": strconv.Itoa,
	"pad2": func(n int) string {
		if n < 10 {
			return "0" + strconv.Itoa(n)
		}
		return strconv.Itoa(n)
	},
	"list": func(items ...string) []string { return items },
	// The card partial needs both the page's chrome and one auction, and a
	// template can pass only one value.
	"card": func(p Page, c Card) map[string]any {
		return map[string]any{"Page": p, "Card": c}
	},
	"seq": func(from, to int) []int {
		if to < from {
			return nil
		}
		out := make([]int, 0, to-from+1)
		for i := from; i <= to; i++ {
			out = append(out, i)
		}
		return out
	},
}
