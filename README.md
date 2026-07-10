# Nilami — Bank Asset Auction Portal

*Nilami (निलामी) — Nepali for "auction".*

An elegant public portal where a financial institution lists collateral properties being sold to recover loans, plus a secure admin dashboard for the bank's Recovery Department.

## Features

**Public site** — auction listings with filters (type, district, status, search), rich property detail pages with photo gallery, live countdown to the bid-submission deadline, appraised value / minimum bid / bid security figures, terms of sale, and a step-by-step "how bidding works" guide.

**Admin dashboard** (`/admin`) — Supabase-authenticated staff area with portfolio stats, property CRUD, auction lifecycle management (draft → upcoming → open → closed → sold/cancelled), and bidder records with manual bid-security deposit verification.

## Stack

- Next.js 15+ (App Router, TypeScript, Server Actions)
- Tailwind CSS v4 with a custom design-token theme (Fraunces + Inter, evergreen/brass palette)
- Supabase — Postgres with row-level security, Auth, Storage
- Vercel — hosting

## Development

```bash
pnpm install
pnpm dev
```

Environment variables (see `.env.production` — these are public client-side values; the anon key is protected by RLS):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Database

Schema lives in Supabase migrations: `properties`, `auctions`, `property_images`, `bidder_records`, `profiles`, with RLS policies allowing anonymous read of published listings and admin-only writes.

See `PLAN.md` for the full product plan.
