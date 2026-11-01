package db

import (
	"context"
	"errors"

	"github.com/UjjwolKayastha/nilami/api/internal/auth"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
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

// ErrEmailTaken means the address already has an account. It is distinct from
// a validation error because the sign-up form can act on it: there is nothing
// to correct except using the other address, or signing in.
var ErrEmailTaken = errors.New("email already registered")

// CreateSignup registers a staff account, always unapproved and always bound
// to an institution that exists.
//
// Three guards, and the shape of the statement is one of them. The insert
// selects from organizations rather than taking the id as a value, so an
// institution that does not exist produces no row instead of a profile with a
// null organisation — and a null organisation is precisely the definition of a
// platform administrator. Writing this the obvious way reopens the escalation
// that the Supabase trigger had. The role is confined here, and approved is
// written false rather than taken from the caller.
//
// Under Supabase this was two calls: create the account there, then read it
// back and copy its metadata here. The account lives in this table now, so it
// is one statement that either happens or does not.
func (d *DB) CreateSignup(ctx context.Context, email, fullName, role string, orgID uuid.UUID, passwordHash string) (uuid.UUID, error) {
	switch role {
	case "officer", "manager", "valuer":
	default:
		role = "officer"
	}
	const q = `
		insert into profiles (id, full_name, email, role, organization_id, approved, password_hash)
		select gen_random_uuid(), $1, $2, $3, o.id, false, $4
		  from organizations o
		 where o.id = $5
		returning id`

	var id uuid.UUID
	err := d.Pool.QueryRow(ctx, q, fullName, email, role, passwordHash, orgID).Scan(&id)
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		// No such institution. The caller never learns which ids exist.
		return uuid.Nil, ErrNotFound
	case isUniqueViolation(err):
		return uuid.Nil, ErrEmailTaken
	case err != nil:
		return uuid.Nil, err
	}
	return id, nil
}

// isUniqueViolation reports whether an error is Postgres refusing a duplicate,
// which is how the email index reports an address that already has an account.
func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
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

// CreatePlatformAdmin makes an approved profile that belongs to no
// institution, which is this system's definition of a platform administrator.
//
// Nothing reachable over HTTP may do this. Signup deliberately cannot: it
// binds every new profile to an institution that exists, precisely so that a
// null organisation — total authority — is unreachable from a request. This
// function is the deliberate exception, called only from the command line on
// the server itself, because the alternative is a system with no way back in
// once its last administrator is gone.
func (d *DB) CreatePlatformAdmin(ctx context.Context, email, fullName, passwordHash string) (uuid.UUID, error) {
	const q = `
		insert into profiles (id, full_name, email, role, organization_id, approved, password_hash)
		values (gen_random_uuid(), $1, $2, 'admin', null, true, $3)
		returning id`

	var id uuid.UUID
	err := d.Pool.QueryRow(ctx, q, fullName, email, passwordHash).Scan(&id)
	return id, err
}
