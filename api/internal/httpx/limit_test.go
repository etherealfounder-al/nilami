package httpx

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestClientIPPrefersTheProxyHeaders(t *testing.T) {
	cases := []struct {
		name, cf, xff, remote, want string
	}{
		{"cloudflare wins", "1.1.1.1", "2.2.2.2, 3.3.3.3", "10.0.0.1:5", "1.1.1.1"},
		{"left-most of the chain is the client", "", "2.2.2.2, 3.3.3.3", "10.0.0.1:5", "2.2.2.2"},
		{"single forwarded value", "", "2.2.2.2", "10.0.0.1:5", "2.2.2.2"},
		{"falls back to the socket", "", "", "10.0.0.1:5", "10.0.0.1"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			r := httptest.NewRequest("GET", "/", nil)
			r.RemoteAddr = c.remote
			if c.cf != "" {
				r.Header.Set("CF-Connecting-IP", c.cf)
			}
			if c.xff != "" {
				r.Header.Set("X-Forwarded-For", c.xff)
			}
			if got := ClientIP(r); got != c.want {
				t.Fatalf("got %q want %q", got, c.want)
			}
		})
	}
}

func TestLimiterSpendsBurstThenRefuses(t *testing.T) {
	l := NewLimiter(1, 3)
	now := time.Now()
	for i := 0; i < 3; i++ {
		if ok, _ := l.allow("a", now); !ok {
			t.Fatalf("burst request %d was refused", i)
		}
	}
	ok, retry := l.allow("a", now)
	if ok {
		t.Fatal("a fourth request inside the burst was allowed")
	}
	if retry <= 0 {
		t.Fatal("no Retry-After was suggested")
	}

	// A different client has its own budget.
	if ok, _ := l.allow("b", now); !ok {
		t.Fatal("one client's spending throttled another")
	}
	// And the bucket refills with time.
	if ok, _ := l.allow("a", now.Add(2*time.Second)); !ok {
		t.Fatal("the bucket did not refill")
	}
}

// Without eviction the map grows once per source address, which turns the
// defence into the denial of service it was meant to prevent.
func TestLimiterEvictsIdleBuckets(t *testing.T) {
	l := NewLimiter(100, 100)
	now := time.Now()
	for i := 0; i < 500; i++ {
		l.allow(string(rune(i)), now)
	}
	if len(l.buckets) != 500 {
		t.Fatalf("expected 500 buckets, got %d", len(l.buckets))
	}
	// Well past a full refill, and past the sweep interval.
	l.allow("trigger", now.Add(2*time.Minute))
	if len(l.buckets) > 1 {
		t.Fatalf("idle buckets were not swept: %d remain", len(l.buckets))
	}
}

func TestLimiterDoesNotChargeForPreflight(t *testing.T) {
	l := NewLimiter(1, 1)
	h := l.Limit(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	for i := 0; i < 20; i++ {
		rec := httptest.NewRecorder()
		r := httptest.NewRequest(http.MethodOptions, "/v1/admin/staff", nil)
		r.RemoteAddr = "9.9.9.9:1"
		h.ServeHTTP(rec, r)
		if rec.Code == http.StatusTooManyRequests {
			t.Fatal("a browser was throttled out of its own preflight")
		}
	}
}

func TestCORSOnlyAnswersConfiguredOrigins(t *testing.T) {
	c := NewCORS("https://nilami-seven.vercel.app, http://localhost:3000/")
	h := c.Apply(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))

	call := func(origin, method string) *httptest.ResponseRecorder {
		rec := httptest.NewRecorder()
		r := httptest.NewRequest(method, "/v1/admin/staff", nil)
		if origin != "" {
			r.Header.Set("Origin", origin)
		}
		h.ServeHTTP(rec, r)
		return rec
	}

	ok := call("https://nilami-seven.vercel.app", http.MethodGet)
	if ok.Header().Get("Access-Control-Allow-Origin") != "https://nilami-seven.vercel.app" {
		t.Fatal("a configured origin was not allowed")
	}
	if ok.Header().Get("Vary") != "Origin" {
		t.Fatal("Vary: Origin missing, so a cache could cross-serve the response")
	}
	// The trailing slash in configuration must not matter.
	if call("http://localhost:3000", http.MethodGet).Header().Get("Access-Control-Allow-Origin") == "" {
		t.Fatal("trailing slash in configuration broke the match")
	}
	// Anything else gets no permissive headers, reflected or otherwise.
	bad := call("https://evil.test", http.MethodGet)
	if bad.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatal("an unconfigured origin was reflected back")
	}
	// Credentials are never granted: the token is a header, not a cookie.
	if ok.Header().Get("Access-Control-Allow-Credentials") != "" {
		t.Fatal("credentials were allowed")
	}
	if call("https://nilami-seven.vercel.app", http.MethodOptions).Code != http.StatusNoContent {
		t.Fatal("preflight was not answered")
	}
}

func TestCORSEmptyConfigurationAllowsNobody(t *testing.T) {
	c := NewCORS("")
	h := c.Apply(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	rec := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/v1/admin/staff", nil)
	r.Header.Set("Origin", "https://nilami-seven.vercel.app")
	h.ServeHTTP(rec, r)
	if rec.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatal("an empty allow-list still permitted an origin")
	}
}
