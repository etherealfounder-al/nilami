import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Countdown } from "@/components/Countdown";
import { Gallery } from "@/components/Gallery";
import { StatusBadge } from "@/components/StatusBadge";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import {
  areaLabel,
  formatDate,
  formatDateTime,
  npr,
  nprCompact,
  typeLabel,
} from "@/lib/format";
import { getAuctionBySlug } from "@/lib/queries";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const auction = await getAuctionBySlug(slug);
  return { title: auction?.property.title ?? "Property" };
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-3">
      <dt className="shrink-0 text-sm text-ink-soft">{label}</dt>
      <dd className="text-right text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}

export default async function AuctionDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const auction = await getAuctionBySlug(slug);
  if (!auction) notFound();
  const p = auction.property;

  const facts: [string, string][] = [
    ["Property type", typeLabel(p.type)],
    ["Location", `${p.municipality}${p.ward ? `–${p.ward}` : ""}, ${p.district}`],
    ["Address", p.address || "—"],
    ["Land area", areaLabel(p.land_area_aana, p.land_area_sqm)],
    ...(p.building_floors ? [["Floors", String(p.building_floors)] as [string, string]] : []),
    ...(p.built_year ? [["Built year", String(p.built_year)] as [string, string]] : []),
    ...(p.bedrooms ? [["Bedrooms", String(p.bedrooms)] as [string, string]] : []),
    ...(p.bathrooms ? [["Bathrooms", String(p.bathrooms)] as [string, string]] : []),
    ...(p.road_access ? [["Road access", p.road_access] as [string, string]] : []),
    ...(p.facing ? [["Facing", p.facing] as [string, string]] : []),
    ["Loan reference", p.loan_ref || "—"],
  ];

  const noticeRows: [string, string][] = [
    ["Notice number", auction.notice_number || "—"],
    ["Auction round", `Round ${auction.round}`],
    ["Notice published", formatDate(auction.published_date)],
    ["Bid submission deadline", formatDateTime(auction.submission_deadline)],
    ["Bid opening", formatDateTime(auction.opening_datetime)],
    ["Opening venue", auction.opening_venue || "—"],
  ];

  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-5 pb-24">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 py-6 text-sm text-ink-soft">
          <Link href="/auctions" className="hover:text-evergreen-800">
            Auctions
          </Link>
          <span aria-hidden>／</span>
          <span className="truncate text-ink">{p.title}</span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr]">
          {/* Left column */}
          <div className="space-y-10">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={auction.status} />
                <span className="text-xs font-medium uppercase tracking-[0.16em] text-ink-soft">
                  Notice {auction.notice_number}
                </span>
              </div>
              <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-evergreen-900 sm:text-5xl">
                {p.title}
              </h1>
              <p className="text-ink-soft">
                {p.address && `${p.address} · `}
                {p.municipality}
                {p.ward ? `–${p.ward}` : ""}, {p.district}, {p.province}
              </p>
            </div>

            <Gallery images={p.images ?? []} title={p.title} />

            <section>
              <h2 className="font-display text-2xl font-semibold text-evergreen-900">
                About this property
              </h2>
              <p className="mt-4 leading-relaxed text-ink-soft">
                {p.description}
              </p>
            </section>

            <section className="rounded-3xl border border-ink/8 bg-white p-7 shadow-card">
              <h2 className="font-display text-2xl font-semibold text-evergreen-900">
                Property details
              </h2>
              <dl className="mt-4 divide-y divide-ink/8">
                {facts.map(([l, v]) => (
                  <Fact key={l} label={l} value={v} />
                ))}
              </dl>
            </section>

            <section className="rounded-3xl border border-ink/8 bg-white p-7 shadow-card">
              <h2 className="font-display text-2xl font-semibold text-evergreen-900">
                Terms of sale
              </h2>
              <div className="mt-4 space-y-2 text-sm leading-relaxed text-ink-soft">
                {auction.terms.split("\n").map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
              <h3 className="mt-8 font-semibold text-evergreen-900">
                Documents required with your bid
              </h3>
              <div className="mt-3 space-y-1.5 text-sm leading-relaxed text-ink-soft">
                {auction.required_documents.split("\n").map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </section>
          </div>

          {/* Right column — sticky bid panel */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="overflow-hidden rounded-3xl border border-ink/8 bg-white shadow-lift">
              <div className="bg-evergreen-900 p-7 text-ivory">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-ivory/60">
                  Minimum bid
                </p>
                <p className="font-display mt-1 text-4xl font-semibold text-brass-300">
                  {nprCompact(auction.minimum_bid)}
                  <span className="ml-2 text-sm font-normal text-ivory/60">
                    NPR
                  </span>
                </p>
                <p className="mt-1 text-sm text-ivory/60">
                  {npr(auction.minimum_bid)}
                </p>
                {auction.status === "sold" && auction.winning_amount ? (
                  <p className="mt-4 rounded-xl bg-brass-500/15 p-3 text-sm text-brass-300">
                    Sold at {npr(auction.winning_amount)}.{" "}
                    {auction.result_note}
                  </p>
                ) : null}
              </div>
              <div className="space-y-6 p-7">
                {auction.status === "open" && (
                  <div>
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-soft">
                      Submission closes in
                    </p>
                    <Countdown deadline={auction.submission_deadline} large />
                  </div>
                )}
                <dl className="divide-y divide-ink/8">
                  <Fact
                    label="Appraised value"
                    value={npr(auction.appraised_value)}
                  />
                  <Fact
                    label={`Bid security (${auction.bid_security_pct ?? 10}%)`}
                    value={npr(auction.bid_security_amount)}
                  />
                  {noticeRows.map(([l, v]) => (
                    <Fact key={l} label={l} value={v} />
                  ))}
                </dl>
                <div className="rounded-2xl bg-cream p-5 text-sm leading-relaxed text-ink-soft">
                  <p className="font-semibold text-evergreen-900">
                    How to bid
                  </p>
                  <p className="mt-1.5">
                    Bids are submitted in sealed form at the Recovery
                    Department with your bid-security voucher — this portal
                    does not accept online bids.
                  </p>
                </div>
                <a
                  href={`mailto:recovery@nilami.app?subject=${encodeURIComponent(
                    `Enquiry — Notice ${auction.notice_number}`
                  )}`}
                  className="block rounded-full bg-evergreen-800 py-3.5 text-center text-sm font-semibold text-ivory transition-colors hover:bg-evergreen-700"
                >
                  Contact the Recovery Department
                </a>
                <p className="text-center text-xs text-ink-soft">
                  +977 1 442 0000 · Sun–Fri 10:00–17:00
                </p>
              </div>
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}
