// Package db owns the connection pool and the one rule that replaces row level
// security: every query that touches tenant data takes a Scope, and the Scope
// is applied in SQL rather than trusted from the caller.
package db

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type DB struct{ Pool *pgxpool.Pool }

func Open(ctx context.Context, url string, maxConns int32) (*DB, error) {
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		return nil, fmt.Errorf("parse DATABASE_URL: %w", err)
	}
	// The API is the only client and runs beside Postgres, so a small pool is
	// plenty; a large one would just hold idle backends on a 1 GB box.
	cfg.MaxConns = maxConns
	cfg.MinConns = 1
	cfg.MaxConnIdleTime = 5 * time.Minute
	cfg.MaxConnLifetime = time.Hour
	cfg.HealthCheckPeriod = 30 * time.Second

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("connect: %w", err)
	}
	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping: %w", err)
	}
	return &DB{Pool: pool}, nil
}

func (d *DB) Close() { d.Pool.Close() }

// JSON runs a query whose single column is already a JSON document built by
// Postgres, and hands back the raw bytes.
//
// Every page endpoint is shaped this way on purpose. The old design made one
// PostgREST request per table, which over a link from Vercel to a VPS would be
// five to eight round trips for a single page. Composing the document in the
// database means one network hop and one query, and Go does no row mapping at
// all — there is nothing to drift out of sync with the schema.
func (d *DB) JSON(ctx context.Context, sql string, args ...any) ([]byte, error) {
	var out []byte
	if err := d.Pool.QueryRow(ctx, sql, args...).Scan(&out); err != nil {
		return nil, err
	}
	if out == nil {
		out = []byte("null")
	}
	return out, nil
}
