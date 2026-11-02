package httpx

import (
	"net/http"
	"strings"
)

// SecureHeaders sets the response headers a browser uses to constrain what a
// page may do, which nothing was setting: a request for a public notice came
// back with a content type and little else.
//
// Two policies, because the two halves of this binary have opposite needs. The
// public pages run no JavaScript of their own and carry no inline styles, so
// they can forbid script outright — a promise the markup already keeps, now
// enforced by the browser rather than by our good intentions. The panel is a
// bundle and needs to load one.
//
// What both get: no MIME sniffing, no referrer beyond the origin, and no
// framing by another site.
func SecureHeaders(secure bool) func(http.Handler) http.Handler {
	const commonFrame = "frame-ancestors 'none'; base-uri 'none'; form-action 'self'"

	// The public notice embeds a walkthrough and a map, which are the only
	// third parties any public page is allowed to frame. Images come from
	// anywhere over https because an institution's logo and photographs live
	// in a bucket whose hostname is configuration, not code.
	public := strings.Join([]string{
		"default-src 'none'",
		"img-src 'self' https: data:",
		"style-src 'self'",
		"font-src 'self'",
		"frame-src https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://www.openstreetmap.org",
		"script-src 'none'",
		commonFrame,
	}, "; ")

	// The panel loads its own bundle and stylesheet, talks to this same
	// origin, and draws map tiles. Leaflet builds markers from markup with
	// style attributes on it, which is why inline style is allowed here and
	// nowhere else.
	panel := strings.Join([]string{
		"default-src 'self'",
		"img-src 'self' https: data: blob:",
		"style-src 'self' 'unsafe-inline'",
		"font-src 'self'",
		"connect-src 'self'",
		"frame-src 'none'",
		commonFrame,
	}, "; ")

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			h := w.Header()
			h.Set("X-Content-Type-Options", "nosniff")
			h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
			h.Set("X-Frame-Options", "DENY")

			// Only over TLS, and only in the deployment that has it: sending
			// this from a local http server would pin a developer's browser
			// to https for localhost.
			if secure {
				h.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
			}

			// The API answers programs, not pages, and a JSON body renders
			// nothing; a content policy on it would only be noise.
			if !strings.HasPrefix(r.URL.Path, "/v1/") {
				if strings.HasPrefix(r.URL.Path, "/admin") || strings.HasPrefix(r.URL.Path, "/assets/") {
					h.Set("Content-Security-Policy", panel)
				} else {
					h.Set("Content-Security-Policy", public)
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}
