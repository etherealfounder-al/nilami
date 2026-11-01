# Nilami — Bank Asset Auction Portal

*Nilami (निलामी) — Nepali for "auction".*

An elegant public portal where a financial institution lists collateral properties being sold to recover loans, plus a secure admin dashboard for the bank's Recovery Department.

## Features

**Public site** — auction listings with filters (type, district, status, search), rich property detail pages with photo gallery, live countdown to the bid-submission deadline, appraised value / minimum bid / bid security figures, terms of sale, and a step-by-step "how bidding works" guide.

**Admin dashboard** (`/admin`) — staff area with portfolio stats, property CRUD, auction lifecycle management (draft → upcoming → open → closed → sold/cancelled), bidder records with manual bid-security deposit verification, and proxy login so a platform administrator can see the panel as an institution's staff see it.

## Architecture

One binary, one process. It serves the public pages, the admin app and the
API, with Postgres beside it:

| Piece | Where | What it holds |
| --- | --- | --- |
| Go server | Oracle VPS, via Coolify | The API, the public pages, and the admin app embedded in the binary. |
| Postgres 17 | Same host, private network | All application data, including accounts and sessions. |
| Cloudflare R2 | `cdn.ujjwolkayastha.com.np` | Uploaded images. |

The public pages are rendered from `html/template` and ship no JavaScript —
which is what lets a forwarded link show a title and a photograph, since the
crawlers behind those previews do not run a bundle. The admin panel is a Preact
single-page app, 40 KB gzipped, served from the same origin so its session
cookie is first-party and there is no CORS to configure.

Endpoints are named for the page they serve (`/v1/pages/home`), not the table
they read, so a page costs one query rather than several round trips.

Authorisation is not row-level security. The server resolves a scope once per
request and applies it in SQL, so a query cannot forget to filter. See
`api/internal/auth/scope.go`.

Accounts live in Postgres: argon2id passwords, and sessions as rows rather than
signed tokens, so signing out is a delete rather than a wait.

## Stack

- Go 1.26 — three runtime dependencies, a 25 MB image including the frontend
- Postgres 17, migrations embedded in the binary and applied at boot
- Preact + Vite + react-router + TanStack Query for the admin app
- Tailwind CSS v4, one stylesheet built from `web/src/theme.css` and scanned
  across both the app and the Go templates (Fraunces + Inter, evergreen/brass)

## Development

Two halves. The admin app:

```bash
cd web
pnpm install --frozen-lockfile --ignore-scripts
pnpm dev                 # proxies /v1 to the server on :8099
```

The server, which needs only a database and a token:

```bash
cd api
docker run -d --name nilami-pg -e POSTGRES_PASSWORD=test -e POSTGRES_DB=nilami \
  -p 55433:5432 postgres:17-alpine

export DATABASE_URL="postgres://postgres:test@localhost:55433/nilami?sslmode=disable" \
       SERVICE_TOKEN="0123456789abcdef0123456789abcdef-dev" \
       COOKIE_INSECURE=1 ADDR=":8099"

printf %s 'a-long-enough-password' | go run ./cmd/server \
  -set-password -email you@example.org -create-admin
go run ./cmd/server
```

See `.env.example` for the rest of the surface.

```bash
go test ./... -count=1    # add TEST_DATABASE_URL for the tenant-isolation tests
```

Those database tests skip silently without `TEST_DATABASE_URL`, so set it —
they are the ones that prove an institution cannot read another's rows.

To serve the admin app from the binary as production does, build it first:

```bash
cd web && pnpm build
cp -r dist/. ../api/internal/web/dist/
```

Screenshots of the panel need `scripts/screenshot.mjs`: headless Chrome cannot
click past a login, and the session cookie is httpOnly, so it drives Chrome
over the DevTools Protocol and sets the cookie directly.

## Database access

Postgres publishes no port. It is reachable only by the API over Docker's private network, so every route in goes through SSH.

**One-off queries:**

```bash
ssh oci-coolify "sudo docker exec -i \$(sudo docker ps --format '{{.Names}}' | grep '^postgres-') \
  psql -U nilami -d nilami -c 'select count(*) from properties'"
```

**A GUI client** — open the tunnel, leave it running:

```bash
ssh -N nilami-db     # forwards localhost:55432
psql "postgres://nilami@localhost:55432/nilami"
```

**Adminer in the browser:**

```bash
ssh -f -N nilami-db
docker run -d --name nilami-adminer -p 8081:8080 \
  -e ADMINER_DEFAULT_DRIVER=pgsql \
  -e ADMINER_DEFAULT_SERVER='host.docker.internal:55432' \
  -e ADMINER_DEFAULT_DB=nilami \
  --add-host=host.docker.internal:host-gateway \
  adminer:latest
```

Then <http://localhost:8081>, username and database `nilami`.

`ADMINER_DEFAULT_DRIVER=pgsql` is not optional. Without it Adminer defaults to MySQL, hides the System dropdown when a default server is set, and fails with an error that says nothing about the driver.

The container reaches your machine through `host.docker.internal`, not `localhost` — inside a container, `localhost` is the container.

Afterwards: `docker start nilami-adminer` is enough; the container persists.

The password is `SERVICE_PASSWORD_POSTGRES`, held by Coolify (your app → Environment Variables) and deliberately not in this repository. To put it on the clipboard without displaying it:

```bash
ssh oci-coolify "sudo docker inspect \$(sudo docker ps --format '{{.Names}}' | grep '^postgres-') \
  --format '{{range .Config.Env}}{{println .}}{{end}}' | grep ^POSTGRES_PASSWORD= | cut -d= -f2-" \
  | tr -d '\n' | pbcopy
```

**There is one environment.** No staging, and this database is the only copy of the data. Wrap anything that writes:

```sql
begin;
update ...;
select ...;   -- check it did what you meant
rollback;     -- or commit
```

## Schema and data

The schema lives in `api/migrations/`, embedded in the binary and applied at boot under an advisory lock, so a fresh database provisions itself and a redeploy is a no-op.

`scripts/data-fingerprint.sql` hashes every table column by column. Run it on two databases and compare seven strings — counts alone cannot tell you a copy is faithful, because the same number of rows can hold different values.

## Deployment

`main` deploys through `.github/workflows/deploy.yml`: the Go tests, the admin
app's typecheck and build, then the image, then Coolify. The deploy waits for
Coolify to finish and then requests the pages and the panel as well as
`/healthz` — the health endpoint answers before the embedded frontend is
reachable, so on its own it cannot tell a working deploy from a binary built
without one.

The image is built on every push, not only on `main`. A Dockerfile that fails
is worth knowing about before production finds out.

The build context is the repository root, because the image needs the admin
app's source and the templates Tailwind scans, neither of which is inside
`api/`. Coolify's base directory stays `api/` and the compose file raises the
context instead — changing that setting detaches the domain from the service.

See `PLAN.md` for the product plan.
