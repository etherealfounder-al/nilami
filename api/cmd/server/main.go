// Command server is the Nilami API: one process, one database, no framework.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/UjjwolKayastha/nilami/api/internal/auth"
	"github.com/UjjwolKayastha/nilami/api/internal/config"
	"github.com/UjjwolKayastha/nilami/api/internal/db"
	"github.com/UjjwolKayastha/nilami/api/internal/handlers"
	"github.com/UjjwolKayastha/nilami/api/internal/httpx"
)

func main() {
	// The image is distroless: no shell, no curl. The binary is therefore its
	// own container health probe, invoked as `server -healthcheck`.
	probe := flag.Bool("healthcheck", false, "probe the local server and exit")
	flag.Parse()
	if *probe {
		if err := healthcheck(); err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		return
	}

	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})))

	if err := run(); err != nil {
		slog.Error("fatal", "err", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	store, err := db.Open(ctx, cfg.DatabaseURL, cfg.MaxDBConns)
	if err != nil {
		return err
	}
	defer store.Close()

	// Applied before the server accepts traffic, so the API can never serve a
	// request against a schema older than the code expects.
	if err := store.Migrate(ctx); err != nil {
		return err
	}

	verifier, err := auth.NewVerifier(ctx, cfg.SupabaseURL, cfg.JWTIssuer, cfg.JWTAudience)
	if err != nil {
		return err
	}

	mux := http.NewServeMux()
	// Liveness sits outside the service guard so the container runtime and the
	// reverse proxy can probe it without holding a credential.
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		if err := store.Pool.Ping(r.Context()); err != nil {
			httpx.Error(w, http.StatusServiceUnavailable, "database unavailable", err)
			return
		}
		httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	api := http.NewServeMux()
	handlers.Public{DB: store}.Routes(api)

	mw := httpx.Middleware{Verifier: verifier, Profiles: store, ServiceToken: cfg.ServiceToken}
	mux.Handle("/v1/", httpx.Chain(api,
		mw.ServiceGuard, // prove the request came from our frontend
		mw.Identity,     // then, optionally, prove who the user is
	))

	srv := &http.Server{
		Addr: cfg.Addr,
		Handler: httpx.Chain(mux,
			httpx.Recover,
			httpx.Log,
			httpx.Timeout(cfg.RequestTimeout),
		),
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       90 * time.Second,
	}

	go func() {
		slog.Info("listening", "addr", cfg.Addr, "storage", cfg.StorageConfigured())
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("server stopped", "err", err)
			stop()
		}
	}()

	<-ctx.Done()
	slog.Info("shutting down")
	shutCtx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
	defer cancel()
	return srv.Shutdown(shutCtx)
}

func healthcheck() error {
	addr := os.Getenv("ADDR")
	if addr == "" {
		addr = ":8080"
	}
	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get("http://127.0.0.1" + addr + "/healthz")
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("healthz returned %d", resp.StatusCode)
	}
	return nil
}
