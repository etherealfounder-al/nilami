# Nilami — Bank Asset Auction Portal

*Nilami (निलामी) — Nepali for "auction".*

An elegant public portal where a financial institution lists collateral properties being sold to recover loans, plus a secure admin dashboard for the bank's Recovery Department.

## Features

**Public site** — auction listings with filters (type, district, status, search), rich property detail pages with photo gallery, live countdown to the bid-submission deadline, appraised value / minimum bid / bid security figures, terms of sale, and a step-by-step "how bidding works" guide.

**Admin dashboard** (`/admin`) — staff area with portfolio stats, property CRUD, auction lifecycle management (draft → upcoming → open → closed → sold/cancelled), bidder records with manual bid-security deposit verification, and proxy login so a platform administrator can see the panel as an institution's staff see it.

## Architecture

Three pieces, each doing one job:

| Piece | Where | What it holds |
| --- | --- | --- |
| Next.js frontend | Vercel | Pages. Fetches server-side; the browser never holds API credentials. |
| Go API + Postgres | Oracle VPS, via Coolify | All application data. |
| Cloudflare R2 | `cdn.ujjwolkayastha.com.np` | Uploaded images. |
| Supabase | — | **Authentication only.** No application data. |

Endpoints are named for the page they serve (`/v1/pages/home`), not the table they read, so a page costs one request and one query rather than several round trips to a database on another continent.

Authorisation is not row-level security. The API resolves a scope once per request from the verified token and applies it in SQL, so a query cannot forget to filter. See `api/internal/auth/scope.go`.

## Stack

- Next.js 16 (App Router, TypeScript, Server Actions), React 19
- Tailwind CSS v4 with a custom design-token theme (Fraunces + Inter, evergreen/brass palette)
- Go 1.26 — four runtime dependencies, an 11 MB binary in a distroless image
- Postgres 17, migrations embedded in the binary and applied at boot
- Supabase Auth (ES256 tokens, verified against its JWKS)

## Development

```bash
pnpm install
pnpm dev
```

Environment variables — see `.env.example`. The split matters:

```
NEXT_PUBLIC_SUPABASE_URL=...        # public: ships in the browser bundle
NEXT_PUBLIC_SUPABASE_ANON_KEY=...   # public: only authenticates, authorises nothing
API_BASE_URL=...                    # server-only
API_SERVICE_TOKEN=...               # server-only — never prefix with NEXT_PUBLIC_
```

`API_SERVICE_TOKEN` must match `SERVICE_TOKEN` on the VPS. It proves a request came from our own server; it is not an identity and grants no access to anyone's data.

To run the API locally:

```bash
cd api
DATABASE_URL=postgres://... SUPABASE_URL=https://... SERVICE_TOKEN=<32+ chars> go run ./cmd/server
go test ./... -count=1          # add TEST_DATABASE_URL to run the tenant-isolation tests
```

The database tests skip silently without `TEST_DATABASE_URL`, so set it — they are the ones that prove an institution cannot read another's rows.

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

**There is one environment.** No staging, and since the Supabase copy was dropped this database is the only copy of the data. Wrap anything that writes:

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

`main` deploys through `.github/workflows/deploy.yml`: the API to Coolify first, waited on and health-checked, then the frontend to Vercel. Vercel's own production deploys are disabled in `vercel.json`, so a frontend that needs a new API field cannot go live before the API that serves it.

See `PLAN.md` for the full product plan and `AGENTS.md` for the Next.js version note.
