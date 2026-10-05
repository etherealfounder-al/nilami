// Package auth turns a request into an identity, and an identity into the one
// value every tenant query must carry.
package auth

import (
	"context"
	"errors"

	"github.com/google/uuid"
)

// Scope is what row level security used to express, moved into the application
// and made explicit. It is resolved once per request from the verified token
// and the profiles table, and is the only thing a query trusts — never a path
// parameter, a body field or a header.
type Scope struct {
	UserID uuid.UUID
	// Empty for the platform administrator, who belongs to no institution.
	OrganizationID  uuid.UUID
	IsPlatformAdmin bool
	Approved        bool
	// Set when a platform administrator is viewing the panel as this staff
	// member. It carries the real account's id so the action can be logged
	// against the human who took it, never against the account they borrowed.
	ProxiedBy uuid.UUID
}

// Proxied reports whether this scope came from a view-as, which handlers log and
// which forbids the few actions that must stay with the real account.
func (s Scope) Proxied() bool { return s.ProxiedBy != uuid.Nil }

// Tenant returns the two values every scoped query binds: the institution whose
// rows the caller may touch, and whether the caller is exempt from that check.
//
// It is deliberately a pair rather than one magic uuid. A single sentinel has to
// mean both "the platform administrator, who sees everything" and "nobody, who
// sees nothing", and those are the same value — the nil uuid — so a query that
// reads it the first way hands an unresolved profile the whole database. Making
// the exemption its own boolean means the dangerous case cannot be reached by
// writing a predicate the obvious way.
//
// Only an approved caller should ever get this far; RequireStaff is what
// enforces that, and the pair keeps a mistake there from widening into a leak.
func (s Scope) Tenant() (org uuid.UUID, all bool) {
	return s.OrganizationID, s.IsPlatformAdmin
}

var (
	ErrNoIdentity  = errors.New("no identity on request")
	ErrNotApproved = errors.New("account is awaiting approval")
	ErrForbidden   = errors.New("not permitted")
)

type ctxKey struct{}

func WithScope(ctx context.Context, s Scope) context.Context {
	return context.WithValue(ctx, ctxKey{}, s)
}

// ScopeFrom returns the request's scope. The boolean is false for anonymous
// requests, which are legitimate on the public endpoints.
func ScopeFrom(ctx context.Context) (Scope, bool) {
	s, ok := ctx.Value(ctxKey{}).(Scope)
	return s, ok
}

// RequireStaff is the gate every admin handler calls first.
func RequireStaff(ctx context.Context) (Scope, error) {
	s, ok := ScopeFrom(ctx)
	if !ok {
		return Scope{}, ErrNoIdentity
	}
	if !s.Approved {
		return Scope{}, ErrNotApproved
	}
	return s, nil
}

// RequirePlatformAdmin gates the actions only the platform may take.
//
// A proxied scope never satisfies it. While viewing as institution staff a
// platform admin is deliberately holding reduced authority, and letting the
// platform powers leak through would make view-as a way to act as somebody else
// rather than a way to see what they see.
func RequirePlatformAdmin(ctx context.Context) (Scope, error) {
	s, err := RequireStaff(ctx)
	if err != nil {
		return Scope{}, err
	}
	if !s.IsPlatformAdmin || s.Proxied() {
		return Scope{}, ErrForbidden
	}
	return s, nil
}
