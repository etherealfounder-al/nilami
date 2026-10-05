package httpx

import (
	"math"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

// ClientIP is the address a rate limit should be keyed on.
//
// RemoteAddr is useless here: Traefik terminates every connection, so it is
// always the proxy. The forwarded headers are only trustworthy because nothing
// reaches this process except through that proxy — exposing the container port
// would make them attacker-controlled and the limiter trivially evaded.
//
// CF-Connecting-IP is preferred because Cloudflare sets it itself and it holds a
// single address. X-Forwarded-For is a client-to-proxy chain, so the left-most
// entry is the original client.
func ClientIP(r *http.Request) string {
	if ip := strings.TrimSpace(r.Header.Get("CF-Connecting-IP")); ip != "" {
		return ip
	}
	if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
		if first, _, ok := strings.Cut(fwd, ","); ok {
			return strings.TrimSpace(first)
		}
		return strings.TrimSpace(fwd)
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

type bucket struct {
	tokens float64
	last   time.Time
}

// Limiter is a per-client token bucket.
//
// The bucket map is swept rather than left to grow. Without that, every distinct
// source address would hold memory for the lifetime of the process, which turns
// the defence into the vulnerability: an attacker spraying forged addresses
// would exhaust the box instead of being throttled by it.
type Limiter struct {
	mu      sync.Mutex
	buckets map[string]*bucket
	rate    float64 // tokens refilled per second
	burst   float64
	swept   time.Time
}

// NewLimiter allows burst requests immediately, then perSecond sustained.
func NewLimiter(perSecond, burst float64) *Limiter {
	return &Limiter{
		buckets: make(map[string]*bucket),
		rate:    perSecond,
		burst:   burst,
		swept:   time.Now(),
	}
}

// allow reports whether the key may spend a request now, and how long to wait
// if it may not.
func (l *Limiter) allow(key string, now time.Time) (bool, time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()

	if now.Sub(l.swept) > time.Minute {
		for k, b := range l.buckets {
			// A bucket that has refilled completely carries no state worth
			// keeping; recreating it costs one allocation.
			if b.tokens+now.Sub(b.last).Seconds()*l.rate >= l.burst {
				delete(l.buckets, k)
			}
		}
		l.swept = now
	}

	b, ok := l.buckets[key]
	if !ok {
		l.buckets[key] = &bucket{tokens: l.burst - 1, last: now}
		return true, 0
	}

	b.tokens = math.Min(l.burst, b.tokens+now.Sub(b.last).Seconds()*l.rate)
	b.last = now
	if b.tokens < 1 {
		return false, time.Duration((1-b.tokens)/l.rate*float64(time.Second)) + time.Second
	}
	b.tokens--
	return true, 0
}

// Limit refuses a client that is spending faster than the bucket refills.
func (l *Limiter) Limit(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// A preflight is not a request for data and costs nothing to answer.
		// Charging for it would make a browser throttle itself out of a page it
		// is allowed to load.
		if r.Method == http.MethodOptions {
			next.ServeHTTP(w, r)
			return
		}
		if ok, retry := l.allow(ClientIP(r), time.Now()); !ok {
			w.Header().Set("Retry-After", strconv.Itoa(int(retry.Seconds())))
			Error(w, http.StatusTooManyRequests, "too many requests", nil)
			return
		}
		next.ServeHTTP(w, r)
	})
}
