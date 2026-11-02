# Working in this repository

One Go binary serves the API, the public pages and the admin app. `api/` is the
Go module, `web/` is the Preact admin app, and the built app is embedded into
the binary. There is no Next.js here any more, and no Supabase.

## Things that pass locally and fail in the build

Each of these has shipped a broken build at least once. They share a cause: the
working tree holds state a clean checkout does not.

- **`web/` installs on its own**, from inside `web/`. It is not part of any
  workspace, and the repository root has no `package.json` at all.
- **Build the image before claiming a change works.** `docker build .` from
  the repository root is the only check that exercises a clean tree. A
  populated `web/node_modules` or a stale `dist/` hides real breakage. Note
  that `docker compose build` from `api/` no longer builds anything: it
  resolves `deploy/Dockerfile.image`, which only pulls what CI published.
- **Tailwind only emits classes it can see.** `web/src/app.css` names two
  sources: this app and `api/internal/web/templates`. Rebuild the CSS after
  changing a template, or the page renders with the right words and no layout.
- **Every commit must build on its own.** Staging `api/internal/web` without
  the `main.go` that calls it compiles here, where both are on disk, and fails
  for anyone who checks out that commit.

## Things that take the site down

- **Do not rename the compose service.** Coolify binds the domain to the
  service name and `SERVICE_FQDN_API_8080` carries it. It is still called `api`
  although it now serves everything.
- **Do not rename the Postgres volume.** `nilami-pgdata` is half of
  `wsnpyyxf9dbsloac0g5opp8d_nilami-pgdata`; a new name is a new, empty database.
- **Do not change Coolify's base directory.** It stays `api/`; the compose file
  points at `deploy/Dockerfile.image` instead.
- **The server does not compile.** It has two cores and also runs Coolify,
  Traefik, Postgres and three other applications. GitHub Actions builds and
  publishes `ghcr.io/etherealfounder-al/nilami` for arm64, and the compose
  file's one-line `FROM` pulls it — the same arrangement as astralco and
  kavre-scrap-yard. Pointing that build back at the root `Dockerfile` would
  return a minute of both cores to every deploy.
- **Add a domain in Coolify only after DNS points at the VPS.** Traefik asks
  Let's Encrypt the moment the router appears, a challenge answered by the old
  host fails, and it is not retried on its own — a redeploy forces it.
- **There is one environment.** This database is the only copy of the data.
  Wrap exploratory writes in `begin; … rollback;`, and read `\d <table>` rather
  than guessing a column name.

## Conventions worth keeping

- Translations live in `api/locales/*.json`, read by the Go server. One test
  asserts every key a template uses exists in both languages; another asserts
  the Go formatter still produces what the old TypeScript one did.
- Public pages ship no JavaScript. That is what makes a forwarded link show a
  title and a photograph, since those crawlers do not run a bundle.
- A signup must never produce a profile with a null `organization_id` — that is
  this system's definition of a platform administrator. The insert selects from
  `organizations`, so a bad institution yields no row rather than a null.
