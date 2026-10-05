package db

import (
	"context"
	"fmt"
	"io/fs"
	"log/slog"
	"sort"

	"github.com/UjjwolKayastha/nilami/api/migrations"
)

// Migrate applies any migration the database has not seen yet.
//
// Running this at boot rather than as a separate deploy step suits a single
// instance behind Coolify: there is no orchestration to add, and the API can
// never start against a schema older than the code expects. The advisory lock
// makes it safe anyway if two containers ever start together — the second
// waits, then finds nothing to do.
func (d *DB) Migrate(ctx context.Context) error {
	conn, err := d.Pool.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("acquire: %w", err)
	}
	defer conn.Release()

	// An arbitrary but stable key, so only one process migrates at a time.
	const lockKey = 8_472_013
	if _, err := conn.Exec(ctx, `select pg_advisory_lock($1)`, lockKey); err != nil {
		return fmt.Errorf("lock: %w", err)
	}
	defer func() {
		_, _ = conn.Exec(context.WithoutCancel(ctx), `select pg_advisory_unlock($1)`, lockKey)
	}()

	if _, err := conn.Exec(ctx, `
		create table if not exists schema_migrations (
			version    text primary key,
			applied_at timestamptz not null default now()
		)`); err != nil {
		return fmt.Errorf("create schema_migrations: %w", err)
	}

	names, err := fs.Glob(migrations.FS, "*.sql")
	if err != nil {
		return err
	}
	// Lexical order is the apply order, which is why files are numbered.
	sort.Strings(names)

	for _, name := range names {

		var seen bool
		if err := conn.QueryRow(ctx,
			`select exists (select 1 from schema_migrations where version = $1)`, name,
		).Scan(&seen); err != nil {
			return fmt.Errorf("check %s: %w", name, err)
		}
		if seen {
			continue
		}

		body, err := migrations.FS.ReadFile(name)
		if err != nil {
			return fmt.Errorf("read %s: %w", name, err)
		}

		// Each migration is one transaction: it applies whole, or not at all.
		tx, err := conn.Begin(ctx)
		if err != nil {
			return fmt.Errorf("begin %s: %w", name, err)
		}
		if _, err := tx.Exec(ctx, string(body)); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("apply %s: %w", name, err)
		}
		if _, err := tx.Exec(ctx,
			`insert into schema_migrations (version) values ($1)`, name,
		); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("record %s: %w", name, err)
		}
		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf("commit %s: %w", name, err)
		}
		slog.Info("migration applied", "version", name)
	}
	return nil
}
