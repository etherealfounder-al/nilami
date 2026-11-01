package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"time"

	"github.com/google/uuid"
)

const (
	// SessionTTL is how long a session survives without use. Each use pushes
	// expiry out again, so someone working daily stays signed in.
	//
	// Shorter than the 90 days astralco uses: this panel publishes bank asset
	// auctions and approves the staff who can edit them, so a forgotten
	// session on a shared machine is worth more to an attacker.
	SessionTTL = 14 * 24 * time.Hour

	// SessionRenewAfter limits the sliding renewal to one write a day rather
	// than one per request.
	SessionRenewAfter = 24 * time.Hour
)

// ErrNoSession means the cookie named no live session: absent, unknown,
// expired or revoked. The four are deliberately indistinguishable to a
// caller, so a probe cannot learn which tokens once existed.
var ErrNoSession = errors.New("no valid session")

// Session is one signed-in browser. ID is the stored hash, which is safe to
// show and to revoke by — the token itself was only ever in the cookie.
type Session struct {
	ID        string    `json:"id"`
	UserID    uuid.UUID `json:"-"`
	CreatedAt time.Time `json:"created_at"`
	ExpiresAt time.Time `json:"expires_at"`
	LastSeen  time.Time `json:"last_seen"`
	UserAgent string    `json:"user_agent"`
}

// NewSessionToken returns the opaque value that goes in the cookie. It is
// random rather than signed: this service can look a session up, so there is
// nothing for a token to assert and no signing key to leak.
func NewSessionToken() (string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(raw), nil
}

// HashSessionToken is what the sessions table stores. A database copy then
// holds nothing that would sign anyone in, and an attacker who reads a backup
// still has to find a preimage.
func HashSessionToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
