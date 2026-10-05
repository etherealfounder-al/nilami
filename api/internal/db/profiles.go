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
