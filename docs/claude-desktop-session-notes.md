# Nilami — Claude Desktop (Cowork) session notes

Copied 2026-08-18 from the claude.ai Cowork session "Bank auction application plan"
(https://claude.ai/cowork/cse_01SHpwJdHek5F6Hg1Fr2muiu). Local continuation lives in this repo.

## Stack / infrastructure
- Repo: github.com/UjjwolKayastha/nilami (public; local clone ~/Ujjwol/nilami)
- Live: https://nilami-mauve.vercel.app (Vercel, auto-deploys from the repo)
- DB: Supabase project `ocpufyaehwungqqllrqx` — **free tier, auto-pauses after ~1 week idle**;
  when the whole site errors with `ENOTFOUND ...supabase.co`, restore the project (happened 2026-08-05).
  Open offer from the cloud session: a keep-alive scheduled ping (never set up).
- Data model: `organizations` → `properties` (public slug lives here, `is_published`) → `auctions`
  (status: draft | upcoming | open | closed | sold; public queries use `.neq("status","draft")`).
  RLS scopes admin views by org; platform admin sees all.
- Seed data: 8 auctions / 8 properties / 4 institutions / 6 staff / 4 bidders.

## Recent history (from the session tail)
- Jul 12 — Admin Overview became a live dashboard (KPIs, status/type/district charts,
  min-bid by institution). Server-rendered, force-dynamic, org-scoped.
- Jul 12 — Mobile overflow fixed: grid items needed `min-w-0` so truncated titles don't
  widen panels (commit a24819d).
- Aug 5 — Site down: Supabase free-tier auto-pause; project restored, data intact.
- Aug 18 — User asks: `/auctions/banepa-10-ghar` 404s although "added to database".

## Diagnosis of the Aug 18 404 (done locally)
Property `banepa-10-ghar` ("Banepa 10 Ghar", published, org 73131d2f…, created 2026-08-18 09:47 UTC)
exists in `properties`, but **no row in `auctions` references it**. The public detail page resolves
`/auctions/[slug]` via `getAuctionBySlug()` (src/lib/queries.ts:55) which scans **auctions** and matches
`a.property?.slug === slug` → no auction, no page. Fix: create an auction row for that property
(via admin panel → Auctions, or SQL insert) with notice number, deadlines, minimum bid, status ≠ draft.

## Repo notes
- CLAUDE.md points at AGENTS.md: this uses a NEWER Next.js than training data — read
  `node_modules/next/dist/docs/` before writing code.
