package db

import (
	"context"

	"github.com/UjjwolKayastha/nilami/api/internal/auth"
	"github.com/google/uuid"
)

// ScopeForUser is the single place authority is decided.
//
// A platform administrator is a profile with no institution — the same rule the
// database used to encode as is_platform_admin(). Keeping the definition in one
// function means there is one thing to audit rather than a policy per table.
func (d *DB) ScopeForUser(ctx context.Context, userID uuid.UUID) (auth.Scope, error) {
	const q = `
		select p.organization_id, p.approved
		  from profiles p
		 where p.id = $1`

	var org *uuid.UUID
	var approved bool
	if err := d.Pool.QueryRow(ctx, q, userID).Scan(&org, &approved); err != nil {
		return auth.Scope{}, err
	}
	s := auth.Scope{UserID: userID, Approved: approved}
	if org == nil {
		s.IsPlatformAdmin = true
	} else {
		s.OrganizationID = *org
	}
	return s, nil
}

// ProvisionProfile creates the row for a Supabase account that has authenticated
// but has no profile yet, always unapproved and always bound to a real
// institution.
//
// This replaces the database trigger that used to copy organization_id and role
// straight out of signup metadata. That trigger was the privilege escalation:
// omitting the institution produced a profile with a null organisation, which
// is precisely the definition of a platform administrator. Here the institution
// is checked against the table, and the role can never be chosen by the caller.
func (d *DB) ProvisionProfile(ctx context.Context, userID uuid.UUID, email, fullName, role string, orgID uuid.UUID) error {
	switch role {
	case "officer", "manager", "valuer":
	default:
		role = "officer"
	}
	const q = `
		insert into profiles (id, full_name, email, role, organization_id, approved)
		select $1, $2, $3, $4, o.id, false
		  from organizations o
		 where o.id = $5
		on conflict (id) do nothing`
	tag, err := d.Pool.Exec(ctx, q, userID, fullName, email, role, orgID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		// Either the profile already existed, or the institution does not. The
		// caller re-reads the scope either way, so this stays silent rather
		// than guessing which.
		return nil
	}
	return nil
}

// ScopeForViewAs resolves the scope a platform administrator sees while viewing
// the panel as one of their staff.
//
// The security property is the one the cookie version had, moved intact: the
// request is only ever honoured for a real, approved platform administrator, so
// sending the header can never widen anyone's access. For institution staff it
// is ignored outright, and for a platform admin it can only ever narrow what
// they already see. The caller's own authority is read from the verified token,
// never from the header — the header names a target, it does not assert a right.
//
// An unapproved or unknown target yields the caller's own scope unchanged rather
// than an error, because a stale target id should drop the panel back to the
// administrator's own view, not break it.
func (d *DB) ScopeForViewAs(ctx context.Context, caller auth.Scope, targetID uuid.UUID) (auth.Scope, error) {
	if !caller.IsPlatformAdmin || !caller.Approved || targetID == uuid.Nil || targetID == caller.UserID {
		return caller, nil
	}

	const q = `
		select p.organization_id, p.approved
		  from profiles p
		 where p.id = $1`

	var org *uuid.UUID
	var approved bool
	if err := d.Pool.QueryRow(ctx, q, targetID).Scan(&org, &approved); err != nil {
		return caller, err
	}
	if !approved {
		return caller, nil
	}

	target := auth.Scope{
		UserID:    targetID,
		Approved:  true,
		ProxiedBy: caller.UserID,
	}
	if org == nil {
		target.IsPlatformAdmin = true
	} else {
		target.OrganizationID = *org
	}
	return target, nil
}

// SignupOrganizations is the institution picker on the public signup form:
// approved institutions only, so an unreviewed request cannot be used to
// advertise a name to every later visitor.
func (d *DB) SignupOrganizations(ctx context.Context) ([]byte, error) {
	return d.JSON(ctx, `
		select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name) order by name), '[]'::jsonb)
		  from organizations where approved`)
}

// Credentials is what a login attempt needs: who the email belongs to, the
// hash to verify against, and whether the account has been approved.
type Credentials struct {
	UserID       uuid.UUID
	PasswordHash string
	Approved     bool
}

// CredentialsByEmail looks an account up for sign-in.
//
// Matched on lower(email) against the unique index, so the same address in
// different capitals is the same account rather than a second one. A missing
// row and a blank password are both left for the caller to handle alike: the
// difference between "no such account" and "never given a password" is useful
// to an attacker enumerating addresses and to nobody else.
func (d *DB) CredentialsByEmail(ctx context.Context, email string) (Credentials, error) {
	const q = `
		select p.id, p.password_hash, p.approved
		  from profiles p
		 where lower(p.email) = lower($1) and p.email <> ''`

	var c Credentials
	if err := d.Pool.QueryRow(ctx, q, email).Scan(&c.UserID, &c.PasswordHash, &c.Approved); err != nil {
		return Credentials{}, err
	}
	return c, nil
}

// SetPassword replaces an account's password and reports which account it was.
//
// Every session of that account is deleted in the same transaction. A password
// change that left sessions alive would not actually revoke anything, which is
// the whole reason someone changes one.
func (d *DB) SetPassword(ctx context.Context, email, passwordHash string) (uuid.UUID, error) {
	tx, err := d.Pool.Begin(ctx)
	if err != nil {
		return uuid.Nil, err
	}
	defer tx.Rollback(ctx)

	const q = `
		update profiles set password_hash = $2
		 where lower(email) = lower($1) and email <> ''
		returning id`

	var id uuid.UUID
	if err := tx.QueryRow(ctx, q, email, passwordHash).Scan(&id); err != nil {
		return uuid.Nil, err
	}
	if _, err := tx.Exec(ctx, `delete from sessions where user_id = $1`, id); err != nil {
		return uuid.Nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return uuid.Nil, err
	}
	return id, nil
}
