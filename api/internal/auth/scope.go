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
	OrganizationID uuid.UUID
	IsPlatformAdmin bool
	Approved        bool
}

// OrgFilter is the value to bind into a query's organisation predicate.
//
// It fails closed: an unresolved or unapproved profile yields the nil UUID,
// which matches no row, rather than being allowed to fall through to "see
// everything". That mirrors the sentinel the TypeScript scope used.
func (s Scope) OrgFilter() uuid.UUID {
	if s.IsPlatformAdmin {
		return uuid.Nil
	}
	return s.OrganizationID
}

var (
	ErrNoIdentity   = errors.New("no identity on request")
	ErrNotApproved  = errors.New("account is awaiting approval")
	ErrForbidden    = errors.New("not permitted")
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

func RequirePlatformAdmin(ctx context.Context) (Scope, error) {
	s, err := RequireStaff(ctx)
	if err != nil {
		return Scope{}, err
	}
	if !s.IsPlatformAdmin {
		return Scope{}, ErrForbidden
	}
	return s, nil
}
