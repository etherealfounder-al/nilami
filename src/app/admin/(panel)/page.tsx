import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDateTime, nprCompact } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Auction, AuctionStatus, BidderRecord, Property } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const supabase = await createClient();
  const [{ data: auctions }, { data: properties }, { data: bidders }] =
    await Promise.all([
      supabase.from("auctions").select("*, property:properties(title, slug)"),
      supabase.from("properties").select("id, is_published"),
      supabase
        .from("bidder_records")
        .select("*, auction:auctions(notice_number, property:properties(title))")
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

  const rows = (auctions ?? []) as (Auction & {
    property: Pick<Property, "title" | "slug">;
  })[];
  const open = rows.filter((a) => a.status === "open");
  const upcomingOpenings = rows
    .filter((a) => ["open", "closed"].includes(a.status))
    .filter((a) => new Date(a.opening_datetime) > new Date())
    .sort(
      (a, b) =>
        new Date(a.opening_datetime).getTime() -
        new Date(b.opening_datetime).getTime()
    )
    .slice(0, 5);
  const soldValue = rows
    .filter((a) => a.status === "sold")
    .reduce((s, a) => s + (a.winning_amount ?? 0), 0);
  const pendingDeposits = (bidders ?? []).filter(
    (b) => b.deposit_status === "pending"
  ).length;

  const stats = [
    { label: "Open auctions", value: String(open.length) },
    {
      label: "Listed properties",
      value: String(properties?.length ?? 0),
      sub: `${properties?.filter((p) => p.is_published).length ?? 0} published`,
    },
    {
      label: "Recovered (sold)",
      value: soldValue ? nprCompact(soldValue) : "—",
      sub: "NPR",
    },
    {
      label: "Deposits awaiting review",
      value: String(pendingDeposits),
    },
  ];

  return (
    <div className="space-y-10">
      <div className="flex items-end justify-between">
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
          className="rounded-full bg-evergreen-800 px-5 py-2.5 text-sm font-semibold text-ivory transition-colors hover:bg-evergreen-700"
        >
          + New property
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-ink/8 bg-ivory p-5 shadow-card"
          >
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-soft">
              {s.label}
            </p>
            <p className="font-display mt-2 text-3xl font-semibold text-evergreen-900">
              {s.value}
              {s.sub && (
                <span className="ml-2 text-xs font-normal text-ink-soft">
                  {s.sub}
                </span>
              )}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-ink/8 bg-ivory shadow-card">
          <h2 className="border-b border-ink/8 px-6 py-4 font-semibold text-evergreen-900">
            Upcoming bid openings
          </h2>
          <ul className="divide-y divide-ink/8">
            {upcomingOpenings.length === 0 && (
              <li className="px-6 py-8 text-sm text-ink-soft">
                No bid openings scheduled.
              </li>
            )}
            {upcomingOpenings.map((a) => (
              <li
                key={a.id}
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

        <section className="rounded-2xl border border-ink/8 bg-ivory shadow-card">
          <h2 className="border-b border-ink/8 px-6 py-4 font-semibold text-evergreen-900">
            Recent bidder interest
          </h2>
          <ul className="divide-y divide-ink/8">
            {(bidders ?? []).length === 0 && (
              <li className="px-6 py-8 text-sm text-ink-soft">
                No bidder records yet.
              </li>
            )}
            {((bidders ?? []) as (BidderRecord & {
              auction: { notice_number: string; property: { title: string } };
            })[]).map((b) => (
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
