package auth

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/MicahParks/keyfunc/v3"
	"github.com/golang-jwt/jwt/v5"
)

// Verifier checks Supabase access tokens against the project's published
// signing keys.
//
// Supabase signs with asymmetric keys and serves the public half at a JWKS
// endpoint, so this process holds no secret capable of minting a token. The key
// set is fetched once and refreshed in the background, so verification itself
// costs no network call.
type Verifier struct {
	keys     keyfunc.Keyfunc
	issuer   string
	audience string
}

func NewVerifier(ctx context.Context, supabaseURL, issuer, audience string) (*Verifier, error) {
	jwksURL := supabaseURL + "/auth/v1/.well-known/jwks.json"
	k, err := keyfunc.NewDefaultCtx(ctx, []string{jwksURL})
	if err != nil {
		return nil, fmt.Errorf("load jwks from %s: %w", jwksURL, err)
	}
	return &Verifier{keys: k, issuer: issuer, audience: audience}, nil
}

// Claims is the slice of a Supabase token this service cares about. Anything
// else in the token — app metadata, role names — is deliberately ignored:
// authority comes from the profiles row, not from what the token asserts.
type Claims struct {
	Subject string
	Email   string
}

func (v *Verifier) Verify(token string) (Claims, error) {
	parsed, err := jwt.Parse(token, v.keys.Keyfunc,
		jwt.WithIssuer(v.issuer),
		jwt.WithAudience(v.audience),
		jwt.WithExpirationRequired(),
		jwt.WithLeeway(30*time.Second),
		// Pin to asymmetric algorithms. Without this an attacker could present
		// a token signed with "none", or with HMAC using a public key as the
		// secret — the classic JWT confusion attacks.
		jwt.WithValidMethods([]string{"RS256", "ES256"}),
	)
	if err != nil {
		return Claims{}, fmt.Errorf("verify token: %w", err)
	}
	claims, ok := parsed.Claims.(jwt.MapClaims)
	if !ok {
		return Claims{}, fmt.Errorf("unexpected claims type")
	}
	sub, _ := claims["sub"].(string)
	if sub == "" {
		return Claims{}, fmt.Errorf("token has no subject")
	}
	email, _ := claims["email"].(string)
	return Claims{Subject: sub, Email: email}, nil
}

// BearerToken pulls a token out of an Authorization header, tolerating the
// casing variations proxies introduce.
func BearerToken(header string) string {
	const prefix = "bearer "
	if len(header) > len(prefix) && strings.EqualFold(header[:len(prefix)], prefix) {
		return strings.TrimSpace(header[len(prefix):])
	}
	return ""
}
