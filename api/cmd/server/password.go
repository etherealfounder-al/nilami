package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/UjjwolKayastha/nilami/api/internal/auth"
	"github.com/UjjwolKayastha/nilami/api/internal/db"
	"github.com/jackc/pgx/v5"
)

// The shortest password this will set. Long enough that argon2id's cost is
// the attacker's problem rather than the alphabet's.
const minPasswordLength = 12

// setPassword is the way an account's password is set or reset, and the way
// back in when there is no account left to sign in with.
//
// It reads the password from stdin rather than taking it as an argument: an
// argument would sit in the shell's history and in the process list, where
// anyone on the box can read it.
//
//	docker exec -i <container> /server -set-password -email someone@example.org
//
// It reads DATABASE_URL directly instead of going through config.Load, so it
// keeps working in a shell that has nothing else the server would demand.
func setPassword(ctx context.Context, email, fullName string, create bool) error {
	email = strings.TrimSpace(email)
	if email == "" {
		return errors.New("-email is required")
	}

	url := os.Getenv("DATABASE_URL")
	if url == "" {
		return errors.New("DATABASE_URL is not set")
	}

	password, err := readPassword(os.Stdin)
	if err != nil {
		return err
	}

	store, err := db.Open(ctx, url, 2)
	if err != nil {
		return err
	}
	defer store.Close()

	// The schema may be older than this binary when it is run to recover a
	// system that never started, so bring it up first.
	if err := store.Migrate(ctx); err != nil {
		return err
	}

	hash, err := auth.HashPassword(password)
	if err != nil {
		return err
	}

	id, err := store.SetPassword(ctx, email, hash)
	switch {
	case err == nil:
		fmt.Printf("password set for %s (%s); every session of that account was signed out\n", email, id)
		return nil
	case !errors.Is(err, pgx.ErrNoRows):
		return err
	case !create:
		return fmt.Errorf("no account with the email %s; pass -create-admin to make one", email)
	}

	name := strings.TrimSpace(fullName)
	if name == "" {
		name = "Platform administrator"
	}
	id, err = store.CreatePlatformAdmin(ctx, email, name, hash)
	if err != nil {
		return err
	}
	fmt.Printf("created platform administrator %s (%s)\n", email, id)
	return nil
}

// readPassword takes everything on stdin and trims the newline a pipe or a
// heredoc leaves behind. Interior spaces are kept: a passphrase is allowed to
// contain them, and silently altering what someone typed would lock them out.
func readPassword(r io.Reader) (string, error) {
	raw, err := io.ReadAll(io.LimitReader(r, 4096))
	if err != nil {
		return "", err
	}
	password := strings.Trim(string(raw), "\r\n")
	switch {
	case strings.TrimSpace(password) == "":
		return "", errors.New("no password on stdin: pipe one in, e.g. printf %s 'secret' | docker exec -i … ")
	case utf8.RuneCountInString(password) < minPasswordLength:
		return "", fmt.Errorf("password is shorter than %d characters", minPasswordLength)
	}
	return password, nil
}

// passwordContext bounds the command so a wedged database does not hang a
// recovery attempt indefinitely.
func passwordContext() (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), 30*time.Second)
}
