# Nilami — Bank Asset Auction Portal

*Nilami (निलामी) is the Nepali word for "auction." The name is short, memorable, and instantly communicates the product's purpose to its audience.*

## 1. What we're building

A public auction-notice portal for a financial institution that lists **collateral properties being sold to recover loans**. Interested buyers browse elegant, information-rich listings and submit bids offline (at the bank, per the published auction notice). Bank staff manage everything through a secure admin dashboard.

**Scope decisions (confirmed):**

- **Listing only** — the site publishes auction notices and property details; bidding happens offline per the notice terms.
- **Admin-only accounts** — bank staff sign in; the public browses without accounts.
- **Manual deposit tracking** — admins record interested bidders and verify their earnest-money (bid security) deposit proof inside the dashboard.

## 2. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router, TypeScript) | SSR for SEO-friendly public listings, server actions for admin mutations |
| Styling | Tailwind CSS v4 | Fast, consistent design-token-driven styling |
| Backend | Supabase | Postgres + Auth (admin login) + Storage (property photos, notice PDFs) with RLS |
| Hosting | Vercel | Zero-config Next.js deployment, preview URLs |
| Source | GitHub | Version control, future CI/CD |

## 3. Data model (Postgres via Supabase)

- **properties** — title, slug, type (land / house / apartment / commercial), location (province, district, municipality, ward, address), land area (aana/ropani + sqm), building details, borrower/loan reference (masked), description, status.
- **auctions** — one per property sale round: notice number, published date, bid opening date/time & venue, submission deadline, minimum/appraised value, bid security amount (typically 10%), terms, notice PDF, status (upcoming / open / closed / sold / cancelled), result (winning amount) — re-auction rounds supported.
- **property_images** — ordered gallery images per property (Supabase Storage).
- **bidder_records** — admin-entered: bidder name, contact, citizenship no., deposit amount, deposit proof file, verification status, notes.
- **profiles** — admin users (linked to Supabase Auth), display name, role.

**Security:** RLS on everything. Public (anon) can `SELECT` published properties/auctions/images only. All writes and bidder records require an authenticated admin.

## 4. Pages

**Public**
- `/` — Hero with search, featured auctions, closing-soon strip, stats, how-it-works, trust/process section.
- `/auctions` — Filterable grid (type, district, price range, status) with sort and countdown badges.
- `/auctions/[slug]` — Gallery, key facts panel, minimum bid & bid security, deadline countdown, auction notice details, terms & required documents, location, contact, downloadable notice.
- `/how-it-works` — The offline bidding process explained step by step.

**Admin** (`/admin`, Supabase Auth protected)
- Dashboard — portfolio stats, upcoming bid openings, recent bidder interest.
- Properties — list/create/edit with image upload.
- Auctions — schedule rounds, set values & deadlines, publish/close/mark sold.
- Bidders — record interested bidders, verify deposit proof, notes.

## 5. Design system

The aesthetic target: **a private-bank feel** — calm, authoritative, expensive-looking. Not a noisy classifieds site.

- **Palette:** deep evergreen `#0E3B2E` as the anchor, warm ivory `#FAF7F0` backgrounds, brass/gold `#C2A24B` accents for values and CTAs, ink `#161512` text.
- **Type:** *Fraunces* (serif display) for headlines and prices — gives the editorial, trustworthy tone; *Inter* for UI and body.
- **Texture:** generous whitespace, hairline rules, large numerals for monetary values, subtle grain-free flat surfaces, restrained motion (fade/slide on scroll, live countdowns).
- **Components:** listing cards with status ribbons, countdown chips, spec tables, document checklists, timeline for the auction process.

## 6. Build order

1. Scaffold Next.js + Tailwind + fonts + design tokens
2. Supabase project → migrations → storage → seed demo data → admin user
3. Public site (home → listings → detail)
4. Admin dashboard (auth → CRUD → bidders)
5. GitHub repo + push
6. Vercel deploy with env vars
7. End-to-end verification pass

## 7. Later (out of scope for v1)

Online sealed-bid submission, bidder accounts & KYC, payment gateway for bid security (Khalti/eSewa), SMS/email alerts, Nepali localization, multi-branch/multi-institution white-labeling.
