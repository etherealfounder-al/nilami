package db

import (
	"context"
	"errors"
	"time"

	"github.com/UjjwolKayastha/nilami/api/internal/auth"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// CreateSession signs an account in and returns the raw token for the cookie
// together with the session's expiry. Only the token's hash is stored.
//
// Login is rare, so it is a good moment to sweep expired rows; doing it here
// keeps the table small without a scheduled job to forget about.
func (d *DB) CreateSession(ctx context.Context, userID uuid.UUID, userAgent string) (string, time.Time, error) {
	token, err := auth.NewSessionToken()
	if err != nil {
		return "", time.Time{}, err
	}
	expires := time.Now().Add(auth.SessionTTL)

	tx, err := d.Pool.Begin(ctx)
	if err != nil {
		return "", time.Time{}, err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `delete from sessions where expires_at < now()`); err != nil {
		return "", time.Time{}, err
	}
	const q = `
		insert into sessions (id_hash, user_id, expires_at, user_agent)
		values ($1, $2, $3, $4)`
	if _, err := tx.Exec(ctx, q, auth.HashSessionToken(token), userID, expires, truncate(userAgent, 300)); err != nil {
		return "", time.Time{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return "", time.Time{}, err
	}
	return token, expires, nil
}

// ValidateSession resolves a cookie value to the account it signs in, and at
// most once a day slides the expiry forward. renewed carries the new expiry
// when it moved, so the caller can refresh the cookie, and is zero otherwise.
//
// The read happens on every authenticated request and the write once a day,
// which is the point: making it one statement that always wrote would turn
// every page view into a disk write on a two-core box.
func (d *DB) ValidateSession(ctx context.Context, token string) (userID uuid.UUID, idHash string, renewed time.Time, err error) {
	if token == "" {
		return uuid.Nil, "", time.Time{}, auth.ErrNoSession
	}
	idHash = auth.HashSessionToken(token)

	var expiresAt, lastSeen time.Time
	const q = `select user_id, expires_at, last_seen from sessions where id_hash = $1`
	switch err := d.Pool.QueryRow(ctx, q, idHash).Scan(&userID, &expiresAt, &lastSeen); {
	case errors.Is(err, pgx.ErrNoRows):
		return uuid.Nil, "", time.Time{}, auth.ErrNoSession
	case err != nil:
		return uuid.Nil, "", time.Time{}, err
	}

	now := time.Now()
	if !now.Before(expiresAt) {
		return uuid.Nil, "", time.Time{}, auth.ErrNoSession
	}
	if now.Sub(lastSeen) < auth.SessionRenewAfter {
		return userID, idHash, time.Time{}, nil
	}

	expires := now.Add(auth.SessionTTL)
	const upd = `update sessions set expires_at = $2, last_seen = now() where id_hash = $1`
	if _, err := d.Pool.Exec(ctx, upd, idHash, expires); err != nil {
		return uuid.Nil, "", time.Time{}, err
	}
	return userID, idHash, expires, nil
}

// DeleteSession signs one browser out. Deleting by hash means the caller never
// has to hold the token to revoke it.
func (d *DB) DeleteSession(ctx context.Context, idHash string) error {
	_, err := d.Pool.Exec(ctx, `delete from sessions where id_hash = $1`, idHash)
	return err
}

// DeleteSessionsForUser signs every browser out, which is what changing a
// password or rejecting an account has to do: leaving a live session behind
// would mean the old credential still works.
func (d *DB) DeleteSessionsForUser(ctx context.Context, userID uuid.UUID) error {
	_, err := d.Pool.Exec(ctx, `delete from sessions where user_id = $1`, userID)
	return err
}

func truncate(s string, n int) string {
	if len(s) > n {
		return s[:n]
	}
	return s
}
