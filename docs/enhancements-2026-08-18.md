# Enhancement pass — 2026-08-18

> Historical. The `src/` paths below belong to the Next.js app, deleted on
> 2026-11-01 when the site moved to the Go server. Most of this behaviour was
> carried over, but four items were not, and are tracked in the README's
> "Known gaps": the password reveal (1), the cascading location selects (6),
> the ropani-aana-paisa-daam land area field (8), and the institution card on
> listings (15).

Worked from the enhancement checklist kept in Notes ("Sannstha ko information haru
raakham…"). Each point below was audited against the codebase; this pass implements
three of them plus one latent bug found along the way.

## Implemented

### 1. Password fields can be revealed

New `src/components/admin/PasswordInput.tsx` — a drop-in replacement for
`<input type="password">` that toggles between `password` and `text` with an
eye / eye-off button inside the field. Carries `aria-label`, `aria-pressed` and
`type="button"` so it never submits its form, and forwards every input prop.

Applied to:

- `src/app/admin/login/page.tsx` — staff sign-in
- `src/components/admin/SignupForm.tsx` — account request

These were the only two password inputs in the codebase.

### 2. Loading state on every button

New `src/components/admin/SubmitButton.tsx` — uses `useFormStatus` to disable
itself, set `aria-busy`, and render a spinner (plus an optional `pendingLabel`)
while its parent form's server action is in flight.

Wired into all 11 server-action buttons that previously had none:

| Location | Buttons |
| --- | --- |
| `PropertyForm` / `AuctionForm` | Save / Create |
| Admin layout | Sign out (header + pending-approval screen) |
| Properties list | Delete |
| Auctions list | every status transition |
| Bidders | Add record, 3 deposit-status buttons, Delete |
| Staff | Approve, Reject |

Login and signup already had their own `busy` state and were left alone.

### 3. Staff can no longer see other institutions' rows

**Root cause.** The RLS `SELECT` policies on `properties`, `auctions` and
`property_images` are `is_published OR own-org` — deliberately open so the public
site can read anything published. Only the *write* policies were org-scoped, so
those read policies could not narrow the admin panel, and every admin list ran
unfiltered. An officer at one institution saw every other institution's published
properties and auctions.

**Fix.** Scoping is applied in the queries rather than in RLS — tightening the
policies would break public browsing for signed-in staff. New `getAdminScope()`
in `src/lib/admin/org.ts` returns `{ isPlatformAdmin, organizationId }` and fails
closed: a profile that cannot be resolved scopes to a sentinel UUID matching
nothing, rather than falling back to "see everything".

Applied to:

- `admin/properties` (list) and `admin/properties/[id]` (edit)
- `admin/auctions` (list), `admin/auctions/new` and `admin/auctions/[id]`
- the auction picker on `admin/bidders`
- the auction and property queries behind the dashboard KPIs and charts

`bidder_records` needed no change — its RLS policy was already correctly
org-scoped, with no public-read counterpart.

### 4. Crash on unauthenticated admin requests (found during the audit)

Three places dereferenced `user!.id` without checking for a session. Because a
page renders in parallel with its layout, `/admin/staff` threw
`TypeError: Cannot read properties of null (reading 'id')` on every logged-out
request — masked by the layout's redirect, but a real latent crash. All three now
fail closed:

| Site | Now |
| --- | --- |
| `admin/staff/page.tsx` | redirects to `/admin/login` |
| `actions.ts` → `upsertProperty` | throws "You must be signed in to save a property." |
| `org.ts` → `getAdminOrgContext` | returns no institutions |

### 5. Proxy login (view-as) from the admin panel

A platform admin can render the panel exactly as another staff member sees it,
for support and verification. **No session swap** — the admin stays
authenticated as themselves, so no service-role key is introduced. A cookie
records the target and `getAdminScope()` returns that person's institution, so
every admin query, the nav, the org badge and the dashboard charts follow.

New `src/lib/admin/view-as.ts`:

- `getRealViewer()` — the account actually signed in, **ignoring** the cookie.
  This is the security boundary.
- `getViewAsTarget()` — resolves the target, returning `null` for anyone who is
  not a real platform admin and for targets that are not approved.

Both are wrapped in React `cache()` for per-request memoisation, following the
data-access-layer pattern in Next's own `authentication.md`.

`startViewAs` / `stopViewAs` in `actions.ts` refuse non-platform-admins and
unapproved targets, set an `httpOnly` / `sameSite=lax` / `secure` cookie with a
one-hour max-age, and log both start and stop to the runtime log.

UI: a **View as** button on each approved row of `/admin/staff` (your own row
reads "You"), and a banner pinned above the header while proxying — naming the
staff member and their institution, warning that saved changes are still
recorded under the admin's own account, and offering **Exit proxy login**.

**Why a forged cookie is harmless.** The cookie is only honoured when the real
profile is a platform admin. For institution staff it is ignored outright; for a
platform admin it can only *narrow* what they already see. Setting it by hand can
never widen access. While proxying, `/admin/staff` correctly disappears, because
the effective scope is no longer platform admin — the banner is the way back.

**Writes during a proxy session** still execute with the admin's own rights. One
useful consequence: because `getAdminOrgContext()` now locks to the effective
institution, a property created while proxying is filed under the target's
institution rather than left unassigned.

**Not a full audit trail.** Start and stop are written to the runtime log only;
there is no `view_as` audit table. Worth adding if proxy login sees real use.

### 6. Province, district and municipality are now dropdowns

New `src/lib/nepal/administrative-divisions.ts` carries all 7 provinces, 77
districts and 753 local levels (6 metropolitan, 11 sub-metropolitan, 276
municipalities, 460 rural municipalities) with both English and Nepali names,
plus each local level's ward count.

Source: [sagautam5/local-states-nepal](https://github.com/sagautam5/local-states-nepal)
(MIT). Two corrections were applied while generating the file:

- `काेशी प्रदेश` was encoded as ा + े rather than ो.
- The source romanises बुढानिलकण्ठ as "Budhalikantha"; the local body's own site
  (budhanilkanthamun.gov.np) uses **Budhanilkantha**, which is also what the
  properties table already held.

Names are stored exactly as displayed — municipalities keep their category
suffix ("Kathmandu Metropolitan City"), provinces and districts stay bare —
which matches 7 of the 9 values already in the database.

`LocationSelects` cascades province → district → municipality, clearing the
levels below whenever a parent changes. Any value already saved that is not in
the dataset stays selectable, marked "— not in list", so editing an older
property cannot silently blank its location.

The file is 120 KB raw but 15 KB gzipped, and only loads on the two admin
property routes.

### 7. Loan reference removed

Dropped from the property form, the admin list and the public detail page, and
no longer written by `upsertProperty`. The column is left in place (it is
`NOT NULL DEFAULT ''`), so inserts fall back to the default, updates leave any
existing reference untouched, and nothing already recorded is lost.

### 8. Land area accepts ropani-aana-paisa-daam

`src/lib/nepal/land-area.ts` parses either a plain aana figure ("8.5") or
`1-0-0-0` (ropani-aana-paisa-daam, 1 ropani = 16 aana, 1 aana = 4 paisa,
1 paisa = 4 daam), storing the result as decimal aana in the existing column.
The admin field shows what the entry resolves to as it is typed.

Unit tested, including the round trip in both directions. The tests caught a
bug on the way: `"-5"` was read as 5, because the minus sign sent it down the
ropani branch and split into an empty ropani plus 5 aana. Every segment must
now be a plain non-negative number.

### 9. Road access in feet

`road_access` holds one free-text string ("20 ft blacktopped", "Highway
frontage"). Rather than migrate it, the form now edits it as two fields — width
in feet and a description — which `src/lib/nepal/road-access.ts` splits and
rejoins. Verified against all eight values currently in the table, including
"20 Fit", which round-trips to "20 ft".

### 10. Facing is a fixed list

The eight compass points, with any unlisted stored value preserved the same way
as the location dropdowns.

### 11. Appraised value is optional

`required` removed from the auction form, and the public detail page omits the
row when no value was given. No schema change was needed: `upsertAuction`
already coerced a blank entry to 0, which satisfies the column's `NOT NULL`.

### 12. Nepal map on the landing page

The hero's single featured property is replaced by an OpenStreetMap view of
Nepal with one marker per district that has properties, labelled with the
count; clicking a marker opens a popup that links through to that district's
filtered auction list.

Marker positions come from `src/lib/nepal/district-coordinates.ts` — the area
centroid of each district's largest polygon, computed from
[mesaugat/geoJSON-Nepal](https://github.com/mesaugat/geoJSON-Nepal). Thirteen
district names are spelled differently between the two sources; each mapping
was cross-checked against the province the boundary file assigns it to, so the
two Nawalparasi and two Rukum successor districts are not transposed. All 77
matched with no province mismatch.

Adds one dependency, `leaflet` (with `@types/leaflet`), loaded only on the
landing page. Verified in a real browser: 8 district markers with the right
counts, tiles loading, no console errors, and the popup link resolving to
`/auctions?district=…`. A first attempt gave the marker icon a zero size, which
left it with no hit area — fixed by sizing and anchoring the badge properly.

### 13. Pinpoint a property on OpenStreetMap

The migration refused earlier went through on a retry, adding `latitude`,
`longitude` and `video_url` to `properties`.

The property form now carries an OpenStreetMap picker under the location
fields: click the map to drop a pin, drag it to adjust, or clear it. It centres
on the chosen district's centroid until a pin exists, so it never opens
mid-ocean, and follows the district selection while still unset. Coordinates
ride along in hidden `latitude` / `longitude` inputs.

The public detail page shows a read-only map with the pin whenever a property
has one, plus a link out to the same spot on openstreetmap.org. Properties
without a pin render exactly as before.

Both components were driven in a real browser: the viewer renders its marker,
and clicking the picker drops a pin and reports the coordinates back. Linting
caught a ref being mutated during render, which concurrent rendering disallows;
it is assigned in an effect instead.

### 14. Property video

A video URL field on the property form, rendered on the public detail page.
`src/lib/video.ts` resolves YouTube (watch, youtu.be, shorts, embed) and Vimeo
links to their embed players and plays direct `.mp4`/`.webm`/`.ogg`/`.mov`
links inline. Anything else resolves to null and renders nothing, so an
arbitrary URL cannot be dropped into an iframe — `javascript:` URLs and unknown
hosts are rejected. Unit tested across all of those cases.

### 15. Institution card on the listing page

`src/components/InstitutionCard.tsx` in the detail page sidebar: logo, name, a
"Verified Partner" badge driven by the existing `organizations.approved` flag,
then the contact block — head office, address, `tel:` and `mailto:` rows — a
primary action, and a link to every other auction from that institution.

`logo_url` already existed but is null for all five institutions, so the card
falls back to a monogram until one is set. The "Visit Bank Auction" action
needed an outbound URL that did not exist, so `organizations.website` was added;
while it is unset the primary button is a mailto enquiry prefilled with the
notice number, so the card never has a dead primary action.

The card sits under the listing title, replacing the bare institution pill,
rather than in the sticky sidebar. Measured on production, that column renders
1174px tall against 704-886px of usable height once pinned, so anything at its
foot could never be scrolled to — the card was unreachable on desktop. Moving it
into the page flow brings the sidebar to 688-788px, which fits, and a
`max-h`/`overflow-y-auto` guard now keeps it reachable whatever it grows to.

There is still no admin screen for editing an institution, so `logo_url` and
`website` can only be set directly in the database. Worth adding.

### Also

- `src/components/site/Header.tsx` now resolves the session and shows
  **Dashboard** instead of **Staff sign in** when signed in (checklist item
  "Login is showing even when logged in"). Added the `nav.dashboard` key to both
  the English and Nepali dictionaries.

## Verification

- `tsc --noEmit` clean; `next build` succeeds.
- Org scoping checked against the live API: unscoped returns 9 auctions across 4
  institutions, scoped to one institution returns exactly its 2, and the
  fail-closed sentinel returns `[]`.
- All public routes return 200; all 7 admin routes return 307 to login with
  **zero** server errors (previously `/admin/staff` logged a `TypeError` on every
  request).
- The show/hide password toggle was driven in a real browser on both forms: the
  field flips to plain text, the typed value survives, the label swaps, and the
  form does not submit.
- Proxy login, negative path: with a forged `nilami_view_as` cookie and no
  session, every admin route still redirects to login, the public site is
  unaffected, and no server errors are logged.
- **Not yet verified in a browser:** the "Dashboard" header label, the button
  spinners, and the proxy-login happy path (banner, narrowed scope, exit) — all
  sit behind staff auth, and proxy login additionally needs the single platform
  admin account.

## Lint

Three errors and one warning remain, all pre-existing and untouched by this pass:
two `<a>`-instead-of-`<Link>` Cancel links in `AuctionForm` / `PropertyForm`, a
`set-state-in-effect` in `Countdown.tsx`, and an unused `soldValue` on the
dashboard.

## Still outstanding from the checklist

Nothing — every item on the note is implemented.

Already satisfied before this pass: institution contact details on the auction
detail page, and the 10% bid-security auto-fill (computed server-side in
`upsertAuction` when the amount is left blank).

## Noted, not changed

In `upsertProperty` the organisation resolves as
`profile?.organization_id ?? formData.get("organization_id")`. The fallback exists
so platform admins (who have no organisation) can pick one, but it cannot tell
"platform admin" apart from "profile read failed" — so a failed profile fetch
would trust client input for the institution. RLS still blocks the write, so it is
not exploitable today, but the two cases should be split explicitly.

## Shipped alongside

This commit also carries four workstreams developed in parallel in the same
tree, verified together before release:

- Social sharing on the listing page (Facebook, WhatsApp, Viber, X, Telegram,
  LinkedIn, email, copy link) in both languages.
- Per-listing view counters, in their own `property_view_stats` table so that
  counting a view never stamps `updated_at` on the listing, with a read policy
  that mirrors the listing's own visibility.
- Nilami logo map pins replacing the plain markers, shared across the landing,
  listing and picker maps, plus a backfill of map pins for the seeded listings.
- Auction card fixes: location under the title, institution highlighted, and a
  shared status helper so a notice can no longer read "Open for bids" and
  "Deadline passed" at once.

A later round added listing pagination with a page-size control, an image
carousel on the auction cards, and a StatusBadge variant for use over a
photograph, where the pale on-surface grounds washed out.

Two follow-ups those left open: the seeded pins are locality-accurate but four
sit in a different ward than the listing claims, and the durable fix for status
drift is server-side (a job flipping open → closed past the deadline) rather
than display-time correction.
