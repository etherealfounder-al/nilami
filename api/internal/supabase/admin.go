// Package supabase talks to the one part of Supabase this API still depends on:
// the auth server that owns accounts and passwords.
package supabase

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
)

// ErrNotConfigured is returned when an operation needs the service role key and
// it was not supplied. The API still runs without it — the public pages and
// every read work — so this is reported at the one request that needs it rather
// than by refusing to boot.
var ErrNotConfigured = errors.New("supabase service role key is not configured")

// Admin performs the account operations that used to happen inside a
// SECURITY DEFINER function, back when auth.users sat in the same database as
// the application tables. Moving the data to our own Postgres split those
// writes across two systems, so approving or rejecting someone is now two calls
// that can each fail, instead of one transaction that cannot.
//
// The service role key bypasses every check Supabase has. It is held here, on
// the server, and must never be handed to a browser.
type Admin struct {
	baseURL string
	key     string
	client  *http.Client
}

func NewAdmin(supabaseURL, serviceRoleKey string) *Admin {
	return &Admin{
		baseURL: strings.TrimSuffix(supabaseURL, "/"),
		key:     serviceRoleKey,
		client:  &http.Client{Timeout: 10 * time.Second},
	}
}

func (a *Admin) Configured() bool { return a.key != "" }

func (a *Admin) do(ctx context.Context, method string, userID uuid.UUID, body string) error {
	if !a.Configured() {
		return ErrNotConfigured
	}
	url := fmt.Sprintf("%s/auth/v1/admin/users/%s", a.baseURL, userID)

	var reader io.Reader
	if body != "" {
		reader = strings.NewReader(body)
	}
	req, err := http.NewRequestWithContext(ctx, method, url, reader)
	if err != nil {
		return err
	}
	req.Header.Set("apikey", a.key)
	req.Header.Set("Authorization", "Bearer "+a.key)
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := a.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		// Capped: the body is an error document, and an upstream failure should
		// not be able to write an unbounded string into our logs.
		detail, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return fmt.Errorf("supabase admin %s returned %d: %s", method, resp.StatusCode, strings.TrimSpace(string(detail)))
	}
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 1<<16))
	return nil
}

// ConfirmEmail marks an account usable, which is what approval meant in the
// original function. Without it an approved staff member still cannot sign in.
func (a *Admin) ConfirmEmail(ctx context.Context, userID uuid.UUID) error {
	return a.do(ctx, http.MethodPut, userID, `{"email_confirm":true}`)
}

// DeleteUser removes the account itself. Deleting the profile alone would leave
// a working login attached to no institution.
func (a *Admin) DeleteUser(ctx context.Context, userID uuid.UUID) error {
	return a.do(ctx, http.MethodDelete, userID, "")
}
