package db

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/UjjwolKayastha/nilami/api/internal/auth"
)

// Sessions replaced a signed token that this service could only ever verify.
// A row can be revoked, which is the point — so the tests below are about
// revocation holding, not about the happy path alone.

func TestSessionRoundTrip(t *testing.T) {
	d := testDB(t)
	f := seed(t, d)
	ctx := context.Background()

	token, expires, err := d.CreateSession(ctx, f.staffA, "Mozilla/5.0")
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if expires.IsZero() {
		t.Fatal("no expiry returned")
	}

	userID, idHash, renewed, err := d.ValidateSession(ctx, token)
	if err != nil {
		t.Fatalf("validate: %v", err)
	}
	if userID != f.staffA {
		t.Fatalf("signed in as %v, want %v", userID, f.staffA)
	}
	if idHash != auth.HashSessionToken(token) {
		t.Fatal("id hash does not match the token")
	}
	// Freshly created, so the once-a-day renewal must not have fired.
	if !renewed.IsZero() {
		t.Fatal("renewed a session that was seconds old")
	}
}

// The table must hold nothing that would sign anyone in, so that a dump or a
// backup is not a set of live credentials.
func TestSessionStoresOnlyTheHash(t *testing.T) {
	d := testDB(t)
	f := seed(t, d)
	ctx := context.Background()

	token, _, err := d.CreateSession(ctx, f.staffA, "agent")
	if err != nil {
		t.Fatal(err)
	}
	var stored string
	if err := d.Pool.QueryRow(ctx, `select id_hash from sessions where user_id = $1`, f.staffA).Scan(&stored); err != nil {
		t.Fatal(err)
	}
	if stored == token || strings.Contains(stored, token) {
		t.Fatal("the raw token is in the database")
	}
	if stored != auth.HashSessionToken(token) {
		t.Fatal("stored value is not the token's hash")
	}
}

func TestSessionRejectsUnknownAndRevoked(t *testing.T) {
	d := testDB(t)
	f := seed(t, d)
	ctx := context.Background()

	if _, _, _, err := d.ValidateSession(ctx, "not-a-real-token"); !errors.Is(err, auth.ErrNoSession) {
		t.Fatalf("unknown token: got %v, want ErrNoSession", err)
	}
	if _, _, _, err := d.ValidateSession(ctx, ""); !errors.Is(err, auth.ErrNoSession) {
		t.Fatalf("empty token: got %v, want ErrNoSession", err)
	}

	token, _, err := d.CreateSession(ctx, f.staffA, "agent")
	if err != nil {
		t.Fatal(err)
	}
	if err := d.DeleteSession(ctx, auth.HashSessionToken(token)); err != nil {
		t.Fatal(err)
	}
	if _, _, _, err := d.ValidateSession(ctx, token); !errors.Is(err, auth.ErrNoSession) {
		t.Fatalf("revoked token still valid: %v", err)
	}
}

func TestSessionExpires(t *testing.T) {
	d := testDB(t)
	f := seed(t, d)
	ctx := context.Background()

	token, _, err := d.CreateSession(ctx, f.staffA, "agent")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := d.Pool.Exec(ctx,
		`update sessions set expires_at = now() - interval '1 second' where id_hash = $1`,
		auth.HashSessionToken(token)); err != nil {
		t.Fatal(err)
	}
	if _, _, _, err := d.ValidateSession(ctx, token); !errors.Is(err, auth.ErrNoSession) {
		t.Fatalf("expired session still valid: %v", err)
	}
}

// Past the renewal window the expiry slides forward, so someone working daily
// is not signed out mid-week.
func TestSessionSlidesAfterTheRenewalWindow(t *testing.T) {
	d := testDB(t)
	f := seed(t, d)
	ctx := context.Background()

	token, firstExpiry, err := d.CreateSession(ctx, f.staffA, "agent")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := d.Pool.Exec(ctx,
		`update sessions set last_seen = now() - interval '2 days' where id_hash = $1`,
		auth.HashSessionToken(token)); err != nil {
		t.Fatal(err)
	}
	_, _, renewed, err := d.ValidateSession(ctx, token)
	if err != nil {
		t.Fatal(err)
	}
	if renewed.IsZero() {
		t.Fatal("a session last seen two days ago was not renewed")
	}
	if !renewed.After(firstExpiry) {
		t.Fatalf("renewed expiry %v is not later than %v", renewed, firstExpiry)
	}
}

// Changing a password must end every session, or the old credential still
// works through a cookie somebody already holds.
func TestSetPasswordRevokesEverySession(t *testing.T) {
	d := testDB(t)
	f := seed(t, d)
	ctx := context.Background()

	var email string
	if err := d.Pool.QueryRow(ctx, `select email from profiles where id = $1`, f.staffA).Scan(&email); err != nil {
		t.Fatal(err)
	}
	if email == "" {
		t.Skip("the fixture gives this profile no email to sign in with")
	}

	one, _, err := d.CreateSession(ctx, f.staffA, "laptop")
	if err != nil {
		t.Fatal(err)
	}
	two, _, err := d.CreateSession(ctx, f.staffA, "phone")
	if err != nil {
		t.Fatal(err)
	}

	hash, err := auth.HashPassword("a new password")
	if err != nil {
		t.Fatal(err)
	}
	id, err := d.SetPassword(ctx, email, hash)
	if err != nil {
		t.Fatalf("set password: %v", err)
	}
	if id != f.staffA {
		t.Fatalf("set the password on %v, want %v", id, f.staffA)
	}
	for name, tok := range map[string]string{"laptop": one, "phone": two} {
		if _, _, _, err := d.ValidateSession(ctx, tok); !errors.Is(err, auth.ErrNoSession) {
			t.Errorf("%s session survived a password change: %v", name, err)
		}
	}

	creds, err := d.CredentialsByEmail(ctx, strings.ToUpper(email))
	if err != nil {
		t.Fatalf("lookup by differently-cased email: %v", err)
	}
	if creds.UserID != f.staffA {
		t.Fatal("email lookup is case sensitive")
	}
	ok, err := auth.VerifyPassword("a new password", creds.PasswordHash)
	if err != nil || !ok {
		t.Fatalf("new password does not verify: ok=%v err=%v", ok, err)
	}
}

// Deleting the profile must take its sessions with it, so rejecting a signup
// cannot leave a working login attached to no account.
func TestDeletingAProfileRevokesItsSessions(t *testing.T) {
	d := testDB(t)
	f := seed(t, d)
	ctx := context.Background()

	token, _, err := d.CreateSession(ctx, f.staffA, "agent")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := d.Pool.Exec(ctx, `delete from profiles where id = $1`, f.staffA); err != nil {
		t.Fatal(err)
	}
	if _, _, _, err := d.ValidateSession(ctx, token); !errors.Is(err, auth.ErrNoSession) {
		t.Fatalf("session outlived its profile: %v", err)
	}
}
