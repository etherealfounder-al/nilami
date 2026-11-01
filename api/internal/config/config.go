// Package config reads the process environment once, at boot, and fails loudly
// if anything required is missing. A server that starts with half its
// configuration and dies on the first request is worse than one that never
// starts.
package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Addr        string
	DatabaseURL string

	// The Next.js server presents this credential on the public page reads and
	// the view counter, so a stranger who finds the hostname cannot reach them.
	// The admin routes do not use it: they are called from signed-in browsers
	// too, where a shared secret would not stay secret.
	ServiceToken string

	// Origins allowed to call the admin routes from a browser. Empty means none,
	// which is correct while every call is made by our own server.
	CORSAllowedOrigins string

	// Per-client request budget. The admin routes are reachable from the open
	// internet, so an unauthenticated flood must cost the attacker more than it
	// costs the box.
	RateLimitPerSecond float64
	RateLimitBurst     float64

	// Cloudflare R2, S3-compatible. Uploads are presigned so file bytes never
	// pass through this process or the VPS.
	R2AccountID       string
	R2AccessKeyID     string
	R2AccessKeySecret string
	R2Bucket          string
	R2PublicBaseURL   string

	// Drops the Secure flag from the session cookie. Only a local development
	// server over plain http has any business setting this.
	CookieInsecure bool

	MaxDBConns      int32
	RequestTimeout  time.Duration
	ShutdownTimeout time.Duration
}

func Load() (Config, error) {
	c := Config{
		Addr:               env("ADDR", ":8080"),
		DatabaseURL:        os.Getenv("DATABASE_URL"),
		ServiceToken:       os.Getenv("SERVICE_TOKEN"),
		CORSAllowedOrigins: os.Getenv("CORS_ALLOWED_ORIGINS"),
		RateLimitPerSecond: float64(envInt("RATE_LIMIT_PER_SECOND", 10)),
		RateLimitBurst:     float64(envInt("RATE_LIMIT_BURST", 40)),
		R2AccountID:        os.Getenv("R2_ACCOUNT_ID"),
		R2AccessKeyID:      os.Getenv("R2_ACCESS_KEY_ID"),
		R2AccessKeySecret:  os.Getenv("R2_SECRET_ACCESS_KEY"),
		R2Bucket:           os.Getenv("R2_BUCKET"),
		R2PublicBaseURL:    strings.TrimRight(os.Getenv("R2_PUBLIC_BASE_URL"), "/"),
		CookieInsecure:     os.Getenv("COOKIE_INSECURE") == "1",
		MaxDBConns:         int32(envInt("DB_MAX_CONNS", 8)),
		RequestTimeout:     time.Duration(envInt("REQUEST_TIMEOUT_MS", 10_000)) * time.Millisecond,
		ShutdownTimeout:    time.Duration(envInt("SHUTDOWN_TIMEOUT_MS", 15_000)) * time.Millisecond,
	}
	var missing []string
	for name, value := range map[string]string{
		"DATABASE_URL":  c.DatabaseURL,
		"SERVICE_TOKEN": c.ServiceToken,
	} {
		if value == "" {
			missing = append(missing, name)
		}
	}
	if len(missing) > 0 {
		return c, fmt.Errorf("missing required environment: %s", strings.Join(missing, ", "))
	}
	if len(c.ServiceToken) < 32 {
		return c, fmt.Errorf("SERVICE_TOKEN must be at least 32 characters")
	}
	return c, nil
}

// StorageConfigured reports whether uploads can be issued. The API still serves
// everything else without R2, which keeps local development simple.
func (c Config) StorageConfigured() bool {
	return c.R2AccountID != "" && c.R2AccessKeyID != "" &&
		c.R2AccessKeySecret != "" && c.R2Bucket != ""
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}
