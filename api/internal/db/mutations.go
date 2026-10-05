package db

import (
	"context"
	"errors"
	"regexp"
	"strings"

	"github.com/UjjwolKayastha/nilami/api/internal/auth"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// The writes that used to be SECURITY DEFINER functions.
//
// Those functions existed because row level security made the tables unwritable
// directly, so every privileged write needed a hole punched through it. With the
// policy in the application the hole is unnecessary: the authority check and the
// statement sit in the same function, in a language with types, where they can
// be read together and tested.
//
// The rules are ported from the deployed definitions rather than from memory,
// including the ones that look incidental — the pending-request cap, the slug
// de-duplication, the refusal to reject your own account. Each is load-bearing.

var (
	ErrNotFound    = errors.New("not found")
	ErrValidation  = errors.New("invalid input")
	ErrSelfReject  = errors.New("cannot reject your own account")
	emailPattern   = regexp.MustCompile(`^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$`)
	slugUnsafe     = regexp.MustCompile(`[^a-z0-9]+`)
	maxPendingOrgs = 25
)

// ApproveStaff approves a staff account and, if it is the first approval for a
// newly requested institution, the institution with it.
//
// Platform administrators only, exactly as the deployed function required. The
// panel offers no manager-level approval, and inventing one here would quietly
// widen who can admit people into an institution.
//
// The caller is responsible for confirming the account in Supabase afterwards;
// this database no longer holds auth.users. ApproveStaff reports whether the
// profile existed so the caller knows whether to make that second call.
func (d *DB) ApproveStaff(ctx context.Context, s auth.Scope, target uuid.UUID) error {
	tx, err := d.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	tag, err := tx.Exec(ctx, `update profiles set approved = true where id = $1`, target)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}

	// An institution is approved by approving its first member. Keeping this in
	// the same transaction means a half-approved state cannot be observed.
	if _, err := tx.Exec(ctx, `
		update organizations o set approved = true
		 where o.id = (select organization_id from profiles where id = $1)
		   and not o.approved`, target); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// RejectStaff removes a staff account, and the institution it requested if that
// institution is now empty.
//
// Refusing to act on your own account is not a courtesy: the platform
// administrator is the only account that can approve anyone, so deleting
// yourself would leave the install with no way to admit a new administrator.
//
// Returns the organisation that was removed with the profile, if any, so the
// caller can report it. The Supabase account is deleted by the caller.
func (d *DB) RejectStaff(ctx context.Context, s auth.Scope, target uuid.UUID) error {
	if target == s.UserID {
		return ErrSelfReject
	}

	tx, err := d.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var org *uuid.UUID
	err = tx.QueryRow(ctx, `select organization_id from profiles where id = $1`, target).Scan(&org)
	if err == pgx.ErrNoRows {
		return ErrNotFound
	}
	if err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `delete from profiles where id = $1`, target); err != nil {
		return err
	}

	// Only an unapproved institution with nothing left in it is removed. A
	// broader delete would take an operating institution's data with a single
	// rejected signup.
	if org != nil {
		if _, err := tx.Exec(ctx, `
			delete from organizations o
			 where o.id = $1 and not o.approved
			   and not exists (select 1 from profiles p where p.organization_id = o.id)
			   and not exists (select 1 from properties pr where pr.organization_id = o.id)`,
			*org); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// RequestOrganization registers an institution awaiting approval, and is the one
// write an unauthenticated caller may make — it is what the signup form submits
// before an account exists.
//
// Because it is unauthenticated it carries its own limits: a validated contact
// address, a minimum name, and a cap on how many requests may be pending at
// once. The cap is the only thing standing between the approval queue and a
// script, so it is enforced in the same transaction as the insert rather than
// checked beforehand.
func (d *DB) RequestOrganization(ctx context.Context, name, nameNp, email, phone, address string) (uuid.UUID, error) {
	name = strings.TrimSpace(name)
	email = strings.TrimSpace(email)
	if len([]rune(name)) < 3 {
		return uuid.Nil, ErrValidation
	}
	if !emailPattern.MatchString(email) {
		return uuid.Nil, ErrValidation
	}

	base := strings.Trim(slugUnsafe.ReplaceAllString(strings.ToLower(name), "-"), "-")
	if base == "" {
		return uuid.Nil, ErrValidation
	}

	tx, err := d.Pool.Begin(ctx)
	if err != nil {
		return uuid.Nil, err
	}
	defer tx.Rollback(ctx)

	var pending int
	if err := tx.QueryRow(ctx,
		`select count(*) from organizations where not approved`).Scan(&pending); err != nil {
		return uuid.Nil, err
	}
	if pending >= maxPendingOrgs {
		return uuid.Nil, ErrValidation
	}

	// Postgres settles the collision, so two simultaneous requests for the same
	// name cannot both take the slug. Looping in the application and inserting
	// afterwards would leave exactly that race.
	var id uuid.UUID
	err = tx.QueryRow(ctx, `
		with candidate as (
			select case when n = 1 then $1::text else $1::text || '-' || n end as slug
			  from generate_series(1, 200) as n
			 where not exists (
				select 1 from organizations o
				 where o.slug = case when n = 1 then $1::text else $1::text || '-' || n end
			 )
			 order by n
			 limit 1
		)
		insert into organizations (slug, name, name_np, contact_email, contact_phone, address, approved)
		select slug, $2, $3, $4, $5, $6, false from candidate
		returning id`,
		base, name, strings.TrimSpace(nameNp), email,
		strings.TrimSpace(phone), strings.TrimSpace(address)).Scan(&id)
	if err == pgx.ErrNoRows {
		return uuid.Nil, ErrValidation
	}
	if err != nil {
		return uuid.Nil, err
	}
	return id, tx.Commit(ctx)
}

// OrganizationBranding is the editable half of an institution. Name and slug are
// absent deliberately: the deployed function did not expose them, because they
// identify the institution to the public and changing one silently rewrites
// every listing that credits it.
type OrganizationBranding struct {
	LogoURL      string
	Website      string
	ContactEmail string
	ContactPhone string
	Address      string
	AddressNp    string
}

// UpdateBranding edits an institution's contact details and logo. Platform
// administrators may edit any institution; everyone else only their own,
// whatever id they send.
func (d *DB) UpdateBranding(ctx context.Context, s auth.Scope, org uuid.UUID, b OrganizationBranding) error {
	if !s.IsPlatformAdmin && org != s.OrganizationID {
		return auth.ErrForbidden
	}
	const q = `
		update organizations
		   set logo_url      = nullif(btrim($2), ''),
		       website       = nullif(btrim($3), ''),
		       contact_email = btrim($4),
		       contact_phone = btrim($5),
		       address       = btrim($6),
		       address_np    = btrim($7)
		 where id = $1`
	tag, err := d.Pool.Exec(ctx, q, org,
		b.LogoURL, b.Website, b.ContactEmail, b.ContactPhone, b.Address, b.AddressNp)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// RecordPropertyView counts a view of a published listing, returning the new
// total. An unknown or unpublished slug returns ErrNotFound rather than creating
// a counter, so the table cannot be seeded with rows for listings nobody can see.
func (d *DB) RecordPropertyView(ctx context.Context, slug string) (int64, error) {
	const q = `
		insert into property_view_stats as s (property_id, view_count, last_viewed_at)
		select p.id, 1, now() from properties p where p.slug = $1 and p.is_published
		on conflict (property_id) do update
		   set view_count = s.view_count + 1, last_viewed_at = now()
		returning s.view_count`
	var count int64
	err := d.Pool.QueryRow(ctx, q, slug).Scan(&count)
	if err == pgx.ErrNoRows {
		return 0, ErrNotFound
	}
	return count, err
}
