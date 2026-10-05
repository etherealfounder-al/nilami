import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { getAdminAuctions, getAdminProperties } from "@/lib/admin/queries";
import { getViewer } from "@/lib/admin/view-as";
import { adminApi } from "@/lib/api";
import { formatDateTime, nprCompact, typeLabel } from "@/lib/format";
import type { Auction, AuctionStatus, BidderRecord, Property } from "@/lib/types";

export const dynamic = "force-dynamic";

type Bar = { label: string; value: number; color: string };

/** Server-rendered horizontal bar list (no client JS). */
function BarList({
  items,
  fmt,
  empty = "No data yet.",
}: {
  items: Bar[];
  fmt?: (n: number) => string;
  empty?: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-ink-soft">{empty}</p>;
  }
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-3">
      {items.map((i) => (
        <div
          key={i.label}
          className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3 sm:grid-cols-[8rem_1fr_auto]"
        >
          <span className="truncate text-sm text-ink" title={i.label}>
            {i.label}
          </span>
          <span className="block h-2.5 overflow-hidden rounded-full bg-parchment">
            <span
              className={`block h-full rounded-full ${i.color}`}
              style={{ width: `${Math.max(4, (i.value / max) * 100)}%` }}
            />
          </span>
          <span className="min-w-8 text-right text-sm font-semibold tabular-nums text-evergreen-800">
            {fmt ? fmt(i.value) : i.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function tally<T>(rows: T[], key: (r: T) => string | null | undefined) {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = key(r) || "—";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

const STATUS_COLOR: Record<string, string> = {
  open: "bg-evergreen-600",
  upcoming: "bg-brass-500",
  closed: "bg-ink-soft",
  sold: "bg-evergreen-900",
  draft: "bg-parchment",
  cancelled: "bg-danger",
};
const TYPE_COLOR: Record<string, string> = {
  land: "bg-evergreen-600",
  house: "bg-evergreen-800",
  commercial: "bg-brass-500",
  apartment: "bg-brass-600",
};
const STATUS_ORDER = ["open", "upcoming", "closed", "sold", "draft", "cancelled"];

export default async function AdminOverviewPage() {
  // All three lists come from the API already scoped to the caller's
  // institution (or everything, for the platform administrator).
  const [viewer, auctionList, propertyList, bidderList] = await Promise.all([
    getViewer(),
    getAdminAuctions(),
    getAdminProperties(),
    adminApi<unknown[]>("/v1/admin/bidders"),
  ]);
  const auctions = auctionList.map((a) => ({
    ...a,
    property: { ...a.property, organization: { name: a.organization_name } },
  }));
  const properties = propertyList;
  const bidders = bidderList;
  // While proxying, the dashboard is the target's view, as before.
  const isPlatformAdmin = viewer?.viewingAs
    ? viewer.viewingAs.organizationId === null
    : Boolean(viewer?.isPlatformAdmin);

  type ARow = Auction & {
    property: (Pick<Property, "title" | "slug" | "type" | "district"> & {
      organization: { name: string } | null;
    }) | null;
  };
  const aRows = (auctions ?? []) as unknown as ARow[];
  const pRows = (properties ?? []) as Pick<
    Property,
    "id" | "is_published" | "type" | "district"
  >[];
  const bRows = (bidders ?? []) as unknown as (BidderRecord & {
    auction: { notice_number: string; property: { title: string } | null } | null;
  })[];

  const open = aRows.filter((a) => a.status === "open");
  const soldValue = aRows
    .filter((a) => a.status === "sold")
    .reduce((s, a) => s + (a.winning_amount ?? 0), 0);
  const openValue = open.reduce((s, a) => s + (a.minimum_bid ?? 0), 0);
  const pendingDeposits = bRows.filter(
    (b) => b.deposit_status === "pending"
  ).length;

  // Chart data
  const statusTally = tally(aRows, (a) => a.status);
  const statusBars: Bar[] = STATUS_ORDER.filter((s) => statusTally.has(s)).map(
    (s) => ({
      label: s.charAt(0).toUpperCase() + s.slice(1),
      value: statusTally.get(s)!,
      color: STATUS_COLOR[s] ?? "bg-evergreen-600",
    })
  );
  const typeBars: Bar[] = [...tally(pRows, (p) => p.type).entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({
      label: typeLabel(k),
      value: v,
      color: TYPE_COLOR[k] ?? "bg-evergreen-600",
    }));
  const districtBars: Bar[] = [...tally(pRows, (p) => p.district).entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([k, v]) => ({ label: k, value: v, color: "bg-evergreen-600" }));

  const orgValue = new Map<string, number>();
  for (const a of aRows) {
    const name = a.property?.organization?.name || "—";
    orgValue.set(name, (orgValue.get(name) ?? 0) + (a.minimum_bid ?? 0));
  }
  const orgBars: Bar[] = [...orgValue.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ label: k, value: v, color: "bg-brass-500" }));

  const upcomingOpenings = aRows
    .filter((a) => ["open", "closed"].includes(a.status))
    .filter((a) => new Date(a.opening_datetime) > new Date())
    .sort(
      (a, b) =>
        new Date(a.opening_datetime).getTime() -
        new Date(b.opening_datetime).getTime()
    )
    .slice(0, 5);

  const stats = [
    { label: "Open auctions", value: String(open.length) },
    {
      label: "Listed properties",
      value: String(pRows.length),
      sub: `${pRows.filter((p) => p.is_published).length} published`,
    },
    {
      label: "Open bid value",
      value: openValue ? nprCompact(openValue) : "—",
      accent: true,
    },
    { label: "Deposits awaiting review", value: String(pendingDeposits) },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-evergreen-900">
            Overview
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Recovery portfolio at a glance.
          </p>
        </div>
        <Link
          href="/admin/properties/new"
          className="shrink-0 self-start rounded-full bg-evergreen-800 px-5 py-2.5 text-sm font-semibold text-ivory transition-colors hover:bg-evergreen-700 sm:self-auto"
        >
          + New property
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className={`rounded-2xl border p-5 shadow-card ${
              s.accent
                ? "border-transparent bg-evergreen-900"
                : "border-ink/8 bg-ivory"
            }`}
          >
            <p
              className={`text-xs font-medium uppercase tracking-[0.14em] ${
                s.accent ? "text-ivory/60" : "text-ink-soft"
              }`}
            >
              {s.label}
            </p>
            <p
              className={`font-display mt-2 text-3xl font-semibold ${
                s.accent ? "text-brass-300" : "text-evergreen-900"
              }`}
            >
              {s.value}
              {s.sub && (
                <span
                  className={`ml-2 text-xs font-normal ${
                    s.accent ? "text-ivory/55" : "text-ink-soft"
                  }`}
                >
                  {s.sub}
                </span>
              )}
            </p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="min-w-0 rounded-2xl border border-ink/8 bg-ivory p-6 shadow-card">
          <h2 className="mb-5 font-semibold text-evergreen-900">
            Auctions by status
          </h2>
          <BarList items={statusBars} empty="No auctions yet." />
        </section>
        <section className="min-w-0 rounded-2xl border border-ink/8 bg-ivory p-6 shadow-card">
          <h2 className="mb-5 font-semibold text-evergreen-900">
            Listings by type
          </h2>
          <BarList items={typeBars} empty="No properties yet." />
        </section>
        <section className="min-w-0 rounded-2xl border border-ink/8 bg-ivory p-6 shadow-card">
          <h2 className="mb-5 font-semibold text-evergreen-900">
            Listings by district
          </h2>
          <BarList items={districtBars} empty="No properties yet." />
        </section>
      </div>

      {/* Value by institution — platform admin only (org staff see just their own) */}
      {isPlatformAdmin && orgBars.length > 0 && (
        <section className="min-w-0 rounded-2xl border border-ink/8 bg-ivory p-6 shadow-card">
          <h2 className="mb-5 font-semibold text-evergreen-900">
            Minimum-bid value by institution
          </h2>
          <BarList items={orgBars} fmt={(n) => nprCompact(n)} />
        </section>
      )}

      {/* Lists */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="min-w-0 rounded-2xl border border-ink/8 bg-ivory shadow-card">
          <h2 className="border-b border-ink/8 px-6 py-4 font-semibold text-evergreen-900">
            Upcoming bid openings
          </h2>
          <ul className="divide-y divide-ink/8">
            {upcomingOpenings.length === 0 && (
              <li className="px-6 py-8 text-sm text-ink-soft">
                No bid openings scheduled.
              </li>
            )}
            {upcomingOpenings.map((a, idx) => (
              <li
                key={`${a.notice_number}-${idx}`}
                className="flex items-center justify-between gap-4 px-6 py-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {a.property?.title}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {a.notice_number} · opens{" "}
                    {formatDateTime(a.opening_datetime)}
                  </p>
                </div>
                <StatusBadge status={a.status as AuctionStatus} />
              </li>
            ))}
          </ul>
        </section>

        <section className="min-w-0 rounded-2xl border border-ink/8 bg-ivory shadow-card">
          <h2 className="border-b border-ink/8 px-6 py-4 font-semibold text-evergreen-900">
            Recent bidder interest
          </h2>
          <ul className="divide-y divide-ink/8">
            {bRows.length === 0 && (
              <li className="px-6 py-8 text-sm text-ink-soft">
                No bidder records yet.
              </li>
            )}
            {bRows.slice(0, 6).map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between gap-4 px-6 py-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {b.full_name}
                  </p>
                  <p className="truncate text-xs text-ink-soft">
                    {b.auction?.property?.title} · {b.auction?.notice_number}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] ${
                    b.deposit_status === "verified"
                      ? "bg-evergreen-100 text-evergreen-700"
                      : b.deposit_status === "rejected"
                        ? "bg-danger-soft text-danger"
                        : "bg-brass-100 text-brass-600"
                  }`}
                >
                  {b.deposit_status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
