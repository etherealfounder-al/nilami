import type { Metadata } from "next";
import Link from "next/link";
import { AuctionCard } from "@/components/AuctionCard";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { getDistricts, getPublicAuctions } from "@/lib/queries";

export const metadata: Metadata = { title: "Auctions" };
export const revalidate = 300;

const TYPES = [
  { v: "", l: "All types" },
  { v: "land", l: "Land" },
  { v: "house", l: "House" },
  { v: "apartment", l: "Apartment" },
  { v: "commercial", l: "Commercial" },
];

const STATUSES = [
  { v: "", l: "Any status" },
  { v: "open", l: "Open for bids" },
  { v: "upcoming", l: "Upcoming" },
  { v: "closed", l: "Closed" },
  { v: "sold", l: "Sold" },
];

export default async function AuctionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    type?: string;
    district?: string;
    q?: string;
  }>;
}) {
  const params = await searchParams;
  const [auctions, districts] = await Promise.all([
    getPublicAuctions(params),
    getDistricts(),
  ]);

  const active = Object.entries(params).filter(([, v]) => v);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-5 pb-24">
        <div className="py-12">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brass-600">
            Auction notices
          </p>
          <h1 className="font-display mt-2 text-4xl font-semibold tracking-tight text-evergreen-900 sm:text-5xl">
            All properties
          </h1>
          <p className="mt-3 max-w-xl leading-relaxed text-ink-soft">
            Collateral properties currently offered for sale by the bank.
            Filter by type, district, or auction status.
          </p>
        </div>

        {/* Filters */}
        <form
          method="GET"
          className="mb-10 flex flex-wrap items-center gap-3 rounded-2xl border border-ink/8 bg-white p-4 shadow-card"
        >
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Search title or place…"
            className="h-11 min-w-52 flex-1 rounded-xl border border-ink/12 bg-ivory px-4 text-sm outline-none transition-colors focus:border-evergreen-600"
          />
          <select
            name="type"
            defaultValue={params.type ?? ""}
            className="h-11 rounded-xl border border-ink/12 bg-ivory px-3 text-sm outline-none focus:border-evergreen-600"
          >
            {TYPES.map((t) => (
              <option key={t.v} value={t.v}>
                {t.l}
              </option>
            ))}
          </select>
          <select
            name="district"
            defaultValue={params.district ?? ""}
            className="h-11 rounded-xl border border-ink/12 bg-ivory px-3 text-sm outline-none focus:border-evergreen-600"
          >
            <option value="">All districts</option>
            {districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select
            name="status"
            defaultValue={params.status ?? ""}
            className="h-11 rounded-xl border border-ink/12 bg-ivory px-3 text-sm outline-none focus:border-evergreen-600"
          >
            {STATUSES.map((s) => (
              <option key={s.v} value={s.v}>
                {s.l}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="h-11 rounded-xl bg-evergreen-800 px-6 text-sm font-semibold text-ivory transition-colors hover:bg-evergreen-700"
          >
            Apply
          </button>
          {active.length > 0 && (
            <Link
              href="/auctions"
              className="text-sm font-medium text-ink-soft underline-offset-4 hover:underline"
            >
              Clear
            </Link>
          )}
        </form>

        {auctions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink/15 bg-cream/60 p-16 text-center">
            <p className="font-display text-2xl text-evergreen-900">
              No properties match those filters.
            </p>
            <p className="mt-2 text-ink-soft">
              Try clearing a filter or check back soon — new notices are
              published regularly.
            </p>
          </div>
        ) : (
          <>
            <p className="mb-6 text-sm text-ink-soft">
              {auctions.length} propert{auctions.length === 1 ? "y" : "ies"}
            </p>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {auctions.map((a, i) => (
                <AuctionCard
                  key={a.id}
                  auction={a}
                  property={a.property}
                  index={i}
                />
              ))}
            </div>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
