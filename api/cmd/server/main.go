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

	"github.com/UjjwolKayastha/nilami/api/internal/config"
	"github.com/UjjwolKayastha/nilami/api/internal/db"
	"github.com/UjjwolKayastha/nilami/api/internal/handlers"
	"github.com/UjjwolKayastha/nilami/api/internal/httpx"
	"github.com/UjjwolKayastha/nilami/api/internal/storage"
	"github.com/UjjwolKayastha/nilami/api/internal/web"
)

func main() {
	// The image is distroless: no shell, no curl. The binary is therefore its
	// own container health probe, invoked as `server -healthcheck`.
	probe := flag.Bool("healthcheck", false, "probe the local server and exit")
	// Recovery, run on the server itself: the only way to set a password
	// without already holding one. See password.go.
	setPw := flag.Bool("set-password", false, "set an account's password, read from stdin, and exit")
	email := flag.String("email", "", "with -set-password: the account to set a password for")
	fullName := flag.String("name", "", "with -create-admin: the display name for the new account")
	createAdmin := flag.Bool("create-admin", false, "with -set-password: create a platform administrator when the email is unknown")
	flag.Parse()
	if *probe {
		if err := healthcheck(); err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		return
	}
	if *setPw {
		ctx, cancel := passwordContext()
		defer cancel()
		if err := setPassword(ctx, *email, *fullName, *createAdmin); err != nil {
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

	cookies := httpx.Cookies{Insecure: cfg.CookieInsecure}
	mw := httpx.Middleware{Sessions: store, Profiles: store, ServiceToken: cfg.ServiceToken, Cookies: cookies}
	limiter := httpx.NewLimiter(cfg.RateLimitPerSecond, cfg.RateLimitBurst)
	cors := httpx.NewCORS(cfg.CORSAllowedOrigins)

	// The two surfaces are guarded differently, because they are reached
	// differently.
	//
	// Public page reads have exactly one legitimate caller, our own server, so
	// they keep the shared credential and never answer a browser.
	public := http.NewServeMux()
	handlers.Public{DB: store}.Routes(public)
	mux.Handle("/v1/pages/", httpx.Chain(public,
		limiter.Limit,
		mw.ServiceGuard, // prove the request came from our frontend
		mw.Identity,     // then, optionally, prove who the user is
	))

	// Signing up is reachable without any credential — that is what signing up
	// is. It sat behind the shared credential because the Next.js server used
	// to render the form and call these itself; since that server went, the
	// only caller is a browser, and a browser cannot be given the credential
	// without publishing it.
	//
	// Registered on the root mux rather than inside the guarded one: Go's
	// router prefers the more specific pattern, so these two win over the
	// "/v1/pages/" prefix above.
	//
	// What stops this being an open door is not the credential. CreateSignup
	// selects the institution from the organizations table, so an unknown id
	// yields no row rather than a profile with a null organization_id — which
	// is this system's definition of a platform administrator — and every
	// account lands unapproved regardless of what the form asked for.
	signup := http.NewServeMux()
	handlers.Signup{DB: store}.Routes(signup)
	mux.Handle("GET /v1/pages/signup/organizations", httpx.Chain(signup, limiter.Limit))
	mux.Handle("POST /v1/pages/signup", httpx.Chain(signup, limiter.Limit))

	// Admin routes are called by signed-in browsers as well as by our server, so
	// they are gated by the user's token instead. Asking for the shared
	// credential here would mean shipping it to the browser, where it would stop
	// being shared and start being published.
	admin := http.NewServeMux()
	handlers.Admin{DB: store}.Routes(admin)
	handlers.Uploads{Store: storage.New(storage.Config{
		AccountID:     cfg.R2AccountID,
		AccessKeyID:   cfg.R2AccessKeyID,
		SecretKey:     cfg.R2AccessKeySecret,
		Bucket:        cfg.R2Bucket,
		PublicBaseURL: cfg.R2PublicBaseURL,
	})}.Routes(admin)
	mux.Handle("/v1/admin/", httpx.Chain(admin,
		cors.Apply,
		limiter.Limit,
		mw.Identity,
	))
	mux.Handle("/v1/organizations/", httpx.Chain(admin, cors.Apply, limiter.Limit, mw.Identity))

	// Signing in is reachable without any credential — that is the point — so
	// it carries its own budget, counted per account rather than per address
	// and far tighter than the general one.
	signin := http.NewServeMux()
	handlers.Auth{
		DB:       store,
		Cookies:  cookies,
		Attempts: httpx.NewLimiter(1.0/60.0, 5),
	}.Routes(signin)
	mux.Handle("/v1/auth/", httpx.Chain(signin, cors.Apply, limiter.Limit))

	// Everything that is not the API: the public pages this process renders,
	// and the admin app it serves as a built bundle. Registered last so the
	// /v1 and /healthz patterns above are matched first.
	site, err := web.New(store)
	if err != nil {
		return err
	}
	site.Routes(mux)

	srv := &http.Server{
		Addr: cfg.Addr,
		Handler: httpx.Chain(mux,
			httpx.Recover,
			httpx.Log,
			// What a browser may do with what we send back. The same flag
			// that decides whether a cookie is Secure decides whether this
			// claims HTTPS, so a local server never pins a developer's
			// browser to a scheme it is not serving.
			httpx.SecureHeaders(!cfg.CookieInsecure),
			httpx.Timeout(cfg.RequestTimeout),
			// Now that a cookie can authenticate a request, a page on another
			// site could make a browser send it. This refuses unsafe
			// cross-origin browser requests; calls carrying no Origin or
			// Sec-Fetch-Site — our own server's, and curl's — still pass.
			http.NewCrossOriginProtection().Handler,
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
