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

	// Supabase remains the identity provider. The API verifies its tokens
	// against the project's public keys and never holds a signing secret.
	SupabaseURL string
	JWTIssuer   string
	JWTAudience string

	// The Next.js server is the only client. It presents this credential so a
	// stranger who finds the hostname cannot read the API.
	ServiceToken string

	// Cloudflare R2, S3-compatible. Uploads are presigned so file bytes never
	// pass through this process or the VPS.
	R2AccountID       string
	R2AccessKeyID     string
	R2AccessKeySecret string
	R2Bucket          string
	R2PublicBaseURL   string

	MaxDBConns      int32
	RequestTimeout  time.Duration
	ShutdownTimeout time.Duration
}

func Load() (Config, error) {
	c := Config{
		Addr:              env("ADDR", ":8080"),
		DatabaseURL:       os.Getenv("DATABASE_URL"),
		SupabaseURL:       strings.TrimRight(os.Getenv("SUPABASE_URL"), "/"),
		JWTAudience:       env("JWT_AUDIENCE", "authenticated"),
		ServiceToken:      os.Getenv("SERVICE_TOKEN"),
		R2AccountID:       os.Getenv("R2_ACCOUNT_ID"),
		R2AccessKeyID:     os.Getenv("R2_ACCESS_KEY_ID"),
		R2AccessKeySecret: os.Getenv("R2_SECRET_ACCESS_KEY"),
		R2Bucket:          os.Getenv("R2_BUCKET"),
		R2PublicBaseURL:   strings.TrimRight(os.Getenv("R2_PUBLIC_BASE_URL"), "/"),
		MaxDBConns:        int32(envInt("DB_MAX_CONNS", 8)),
		RequestTimeout:    time.Duration(envInt("REQUEST_TIMEOUT_MS", 10_000)) * time.Millisecond,
		ShutdownTimeout:   time.Duration(envInt("SHUTDOWN_TIMEOUT_MS", 15_000)) * time.Millisecond,
	}
	c.JWTIssuer = c.SupabaseURL + "/auth/v1"

	var missing []string
	for name, value := range map[string]string{
		"DATABASE_URL":  c.DatabaseURL,
		"SUPABASE_URL":  c.SupabaseURL,
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
