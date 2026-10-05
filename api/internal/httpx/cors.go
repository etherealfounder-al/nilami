package httpx

import (
	"net/http"
	"strings"
)

// CORS answers browser preflights for the admin routes.
//
// The allowed origins are configured, never reflected. Echoing back whatever
// Origin arrives would let any site on the internet make authenticated
// cross-origin calls on behalf of a signed-in administrator, which is the whole
// thing the same-origin policy exists to stop.
//
// No credentials are allowed, because none are used: the token travels in the
// Authorization header, not a cookie. Allow-Credentials would widen the surface
// to no purpose.
type CORS struct {
	allowed map[string]bool
}

// NewCORS takes the comma-separated origin list from configuration. An empty
// list disables cross-origin access altogether, which is the right default for a
// deployment whose frontend calls the API only from its own server.
func NewCORS(origins string) *CORS {
	c := &CORS{allowed: map[string]bool{}}
	for _, o := range strings.Split(origins, ",") {
		if o = strings.TrimSpace(strings.TrimSuffix(strings.TrimSpace(o), "/")); o != "" {
			c.allowed[o] = true
		}
	}
	return c
}

func (c *CORS) Apply(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" && c.allowed[origin] {
			h := w.Header()
			h.Set("Access-Control-Allow-Origin", origin)
			// The response varies by Origin, so a cache must not serve one
			// site's response to another.
			h.Add("Vary", "Origin")
			h.Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
			h.Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-View-As")
			h.Set("Access-Control-Max-Age", "600")
		}
		if r.Method == http.MethodOptions {
			// Answered whether or not the origin was allowed. A disallowed
			// origin simply gets no permissive headers, and the browser blocks
			// the real request itself.
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
