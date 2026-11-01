package db

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
)

// A null organization_id is this system's definition of a platform
// administrator, so the question these tests ask is whether a stranger filling
// in the public sign-up form can reach one. Writing the insert as a plain
// VALUES would let them; it selects from organizations so that an institution
// which does not exist produces no row at all.

func TestSignupCannotInventAnInstitution(t *testing.T) {
	d := testDB(t)
	seed(t, d)
	ctx := context.Background()

	// Counted as a delta: the fixture already contains one profile with no
	// institution, because that is what the platform administrator is.
	before, beforeAdmins := countProfiles(t, d), countPlatformAdmins(t, d)

	_, err := d.CreateSignup(ctx, "stranger@example.org", "A Stranger", "officer", uuid.New(), "hash")
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("signup with an unknown institution: got %v, want ErrNotFound", err)
	}
	if after := countProfiles(t, d); after != before {
		t.Fatalf("a profile was written anyway: %d rows became %d", before, after)
	}
	if after := countPlatformAdmins(t, d); after != beforeAdmins {
		t.Fatalf("signup created %d profile(s) with no institution, which is a platform administrator",
			after-beforeAdmins)
	}
}

func TestSignupCannotChooseItsOwnRole(t *testing.T) {
	d := testDB(t)
	f := seed(t, d)
	ctx := context.Background()

	for _, attempt := range []string{"admin", "platform_admin", "", "superuser"} {
		email := attempt + "role@example.org"
		id, err := d.CreateSignup(ctx, email, "Role Chancer", attempt, f.orgA, "hash")
		if err != nil {
			t.Fatalf("%q: %v", attempt, err)
		}
		var role string
		var org *uuid.UUID
		var approved bool
		if err := d.Pool.QueryRow(ctx,
			`select role, organization_id, approved from profiles where id = $1`, id).
			Scan(&role, &org, &approved); err != nil {
			t.Fatal(err)
		}
		if role != "officer" {
			t.Errorf("role %q was accepted; want it confined to officer", attempt)
		}
		if org == nil {
			t.Errorf("role %q produced a profile with no institution", attempt)
		}
		if approved {
			t.Errorf("role %q produced an already-approved account", attempt)
		}
	}
}

func TestSignupKeepsARoleItIsAllowed(t *testing.T) {
	d := testDB(t)
	f := seed(t, d)
	ctx := context.Background()

	for _, want := range []string{"officer", "manager", "valuer"} {
		id, err := d.CreateSignup(ctx, want+"@example.org", "Staff", want, f.orgA, "hash")
		if err != nil {
			t.Fatal(err)
		}
		var got string
		if err := d.Pool.QueryRow(ctx, `select role from profiles where id = $1`, id).Scan(&got); err != nil {
			t.Fatal(err)
		}
		if got != want {
			t.Errorf("role %q became %q", want, got)
		}
	}
}

func TestSignupRefusesAnAddressThatAlreadyHasAnAccount(t *testing.T) {
	d := testDB(t)
	f := seed(t, d)
	ctx := context.Background()

	if _, err := d.CreateSignup(ctx, "taken@example.org", "First", "officer", f.orgA, "hash"); err != nil {
		t.Fatal(err)
	}
	// Different capitals, because the index folds case: one address, one account.
	_, err := d.CreateSignup(ctx, "TAKEN@example.org", "Second", "officer", f.orgA, "hash")
	if !errors.Is(err, ErrEmailTaken) {
		t.Fatalf("duplicate address: got %v, want ErrEmailTaken", err)
	}
}

func countPlatformAdmins(t *testing.T, d *DB) int {
	t.Helper()
	var n int
	if err := d.Pool.QueryRow(context.Background(),
		`select count(*) from profiles where organization_id is null`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func countProfiles(t *testing.T, d *DB) int {
	t.Helper()
	var n int
	if err := d.Pool.QueryRow(context.Background(), `select count(*) from profiles`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}
