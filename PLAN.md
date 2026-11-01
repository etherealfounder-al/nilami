# Nilami — Bank Asset Auction Portal

*Nilami (निलामी) is the Nepali word for "auction." The name is short, memorable, and instantly communicates the product's purpose to its audience.*

## 1. What we're building

A public auction-notice portal for a financial institution that lists **collateral properties being sold to recover loans**. Interested buyers browse elegant, information-rich listings and submit bids offline (at the bank, per the published auction notice). Bank staff manage everything through a secure admin dashboard.

**Scope decisions (confirmed):**

- **Listing only** — the site publishes auction notices and property details; bidding happens offline per the notice terms.
- **Admin-only accounts** — bank staff sign in; the public browses without accounts.
- **Manual deposit tracking** — admins record interested bidders and verify their earnest-money (bid security) deposit proof inside the dashboard.

## 2. Tech stack

Re-architected on 2026-11-01 onto a single Oracle Cloud VPS. The original plan
(Next.js on Vercel, Supabase for data and auth) ran until then; what replaced
it, and why:

| Layer | Choice | Why |
|---|---|---|
| Server | Go 1.26, one binary | Serves the API, the public pages and the admin app from one process. Three runtime dependencies; a 25 MB image. |
| Public pages | Go `html/template` | Rendered server-side with no JavaScript, so a forwarded link previews correctly — the crawlers behind those previews do not run a bundle. |
| Admin app | Preact + Vite, embedded | 40 KB gzipped against React's 98 KB for the same code. Same origin as the API, so the session cookie is first-party and there is no CORS. |
| Styling | Tailwind CSS v4 | One stylesheet, scanned across both the app and the Go templates. |
| Data | Postgres 17 on the same host | Private network, no published port. Migrations embedded in the binary. |
| Auth | argon2id + sessions as rows | No external identity provider. Signing out is a delete, not a wait. |
| Images | Cloudflare R2 | Presigned uploads: photographs go browser → storage, never through the server. |
| Hosting | Oracle free tier, via Coolify | One always-free VM. No per-seat or per-project billing. |

## 3. Data model (Postgres)

- **organizations** — the institutions. A profile with a null `organization_id`
  is the platform administrator; everyone else is scoped to their own.
- **properties** — title, slug, type (land / house / apartment / commercial),
  location (province, district, municipality, ward, address), land area
  (aana/ropani + sqm), building details, road access, built year, loan
  reference (never exposed publicly), description, publication state.
- **auctions** — one per property sale round: notice number, published date,
  bid opening date/time and venue, submission deadline, minimum/appraised
  value, bid security amount (typically 10%), terms, notice PDF, status
  (draft / upcoming / open / closed / sold / cancelled), result. Re-auction
  rounds supported.
- **property_images** — ordered gallery per property, stored in R2.
- **bidder_records** — admin-entered: name, contact, citizenship no., deposit
  amount, proof file, verification status, notes.
- **profiles** — accounts, with `password_hash` and an approval state.
- **sessions** — one row per signed-in session, holding a SHA-256 of the token.

**Security:** not row-level security. The server resolves a scope once per
request from the session and applies it in SQL, so a query cannot forget to
filter. Tenant isolation has its own tests, which run against a real database.

## 4. Pages

**Public**
- `/` — Hero with search, featured auctions, closing-soon strip, stats, how-it-works, trust/process section.
- `/auctions` — Filterable grid (type, district, price range, status) with sort and countdown badges.
- `/auctions/[slug]` — Gallery, key facts panel, minimum bid & bid security, deadline countdown, auction notice details, terms & required documents, location, contact, downloadable notice.
- `/how-it-works` — The offline bidding process explained step by step.

**Admin** (`/admin`, session-protected, served as a single-page app)
- Dashboard — portfolio stats, upcoming bid openings, recent bidder interest.
- Properties — list/create/edit with image upload.
- Auctions — schedule rounds, set values & deadlines, publish/close/mark sold.
- Bidders — record interested bidders, verify deposit proof, notes.
- Institution and staff — branding, contact details, and approving staff requests.

## 5. Design system

The aesthetic target: **a private-bank feel** — calm, authoritative, expensive-looking. Not a noisy classifieds site.

- **Palette:** deep evergreen `#0E3B2E` as the anchor, warm ivory `#FAF7F0` backgrounds, brass/gold `#C2A24B` accents for values and CTAs, ink `#161512` text.
- **Type:** *Fraunces* (serif display) for headlines and prices — gives the editorial, trustworthy tone; *Inter* for UI and body.
- **Texture:** generous whitespace, hairline rules, large numerals for monetary values, subtle grain-free flat surfaces, restrained motion (fade/slide on scroll, live countdowns).
- **Components:** listing cards with status ribbons, countdown chips, spec tables, document checklists, timeline for the auction process.

## 6. Where it stands

Shipped: the public site and the admin dashboard, in English and Nepali;
multi-institution support with a platform administrator above it; accounts and
sessions held in Postgres; and the move to the VPS, which retired Vercel and
Supabase on 2026-11-01.

Deployment is `.github/workflows/deploy.yml` — Go tests, the admin app's
typecheck and build, the image, then Coolify, with the pages and the panel
requested afterwards to prove the deploy carried a working frontend.

## 7. Later (still out of scope)

Online sealed-bid submission, bidder accounts and KYC, a payment gateway for
bid security (Khalti/eSewa), and SMS/email alerts.

Nepali localization and multi-institution white-labeling were on this list and
are now done.
