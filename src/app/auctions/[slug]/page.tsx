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
import { orgName } from "@/lib/i18n/dictionaries";
import { getT } from "@/lib/i18n/server";
import { getAuctionBySlug } from "@/lib/queries";

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
  const { lang, t } = await getT();
  const { slug } = await params;
  const auction = await getAuctionBySlug(slug);
  if (!auction) notFound();
  const p = auction.property;
  const org = p.organization;
  const f = t.detail.facts;

  const facts: [string, string][] = [
    [f.type, typeLabel(p.type, lang)],
    [f.offeredBy, orgName(org, lang)],
    [f.location, `${p.municipality}${p.ward ? `–${p.ward}` : ""}, ${p.district}`],
    [f.address, p.address || "—"],
    [f.landArea, areaLabel(p.land_area_aana, p.land_area_sqm, lang)],
    ...(p.building_floors ? [[f.floors, String(p.building_floors)] as [string, string]] : []),
    ...(p.built_year ? [[f.builtYear, String(p.built_year)] as [string, string]] : []),
    ...(p.bedrooms ? [[f.bedrooms, String(p.bedrooms)] as [string, string]] : []),
    ...(p.bathrooms ? [[f.bathrooms, String(p.bathrooms)] as [string, string]] : []),
    ...(p.road_access ? [[f.roadAccess, p.road_access] as [string, string]] : []),
    ...(p.facing ? [[f.facing, p.facing] as [string, string]] : []),
    [f.loanRef, p.loan_ref || "—"],
  ];

  const noticeRows: [string, string][] = [
    [t.detail.noticeNo, auction.notice_number || "—"],
    [t.detail.round, t.detail.roundN(auction.round)],
    [t.detail.published, formatDate(auction.published_date, lang)],
    [t.detail.deadline, formatDateTime(auction.submission_deadline, lang)],
    [t.detail.opening, formatDateTime(auction.opening_datetime, lang)],
    [t.detail.venue, auction.opening_venue || "—"],
  ];

  const contactEmail = org?.contact_email || "recovery@nilami.app";

  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-5 pb-24">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 py-6 text-sm text-ink-soft">
          <Link href="/auctions" className="hover:text-evergreen-800">
            {t.detail.breadcrumb}
          </Link>
          <span aria-hidden>／</span>
          <span className="truncate text-ink">{p.title}</span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr]">
          {/* Left column */}
          <div className="space-y-10">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={auction.status} lang={lang} />
                <span className="text-xs font-medium uppercase tracking-[0.16em] text-ink-soft">
                  {t.detail.notice} {auction.notice_number}
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
              {org && (
                <p className="inline-flex items-center gap-2 rounded-full bg-evergreen-50 px-4 py-1.5 text-sm font-medium text-evergreen-800">
                  <span className="size-1.5 rounded-full bg-brass-500" />
                  {orgName(org, lang)}
                </p>
              )}
            </div>

            <Gallery images={p.images ?? []} title={p.title} />

            <section>
              <h2 className="font-display text-2xl font-semibold text-evergreen-900">
                {t.detail.about}
              </h2>
              <p className="mt-4 leading-relaxed text-ink-soft">
                {p.description}
              </p>
            </section>

            <section className="rounded-3xl border border-ink/8 bg-white p-7 shadow-card">
              <h2 className="font-display text-2xl font-semibold text-evergreen-900">
                {t.detail.details}
              </h2>
              <dl className="mt-4 divide-y divide-ink/8">
                {facts.map(([l, v]) => (
                  <Fact key={l} label={l} value={v} />
                ))}
              </dl>
            </section>

            <section className="rounded-3xl border border-ink/8 bg-white p-7 shadow-card">
              <h2 className="font-display text-2xl font-semibold text-evergreen-900">
                {t.detail.terms}
              </h2>
              <div className="mt-4 space-y-2 text-sm leading-relaxed text-ink-soft">
                {auction.terms.split("\n").map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
              <h3 className="mt-8 font-semibold text-evergreen-900">
                {t.detail.docs}
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
                  {t.common.minimumBid}
                </p>
                <p className="font-display mt-1 text-4xl font-semibold text-brass-300">
                  {nprCompact(auction.minimum_bid, lang)}
                  <span className="ml-2 text-sm font-normal text-ivory/60">
                    {t.common.npr}
                  </span>
                </p>
                <p className="mt-1 text-sm text-ivory/60">
                  {npr(auction.minimum_bid, lang)}
                </p>
                {auction.status === "sold" && auction.winning_amount ? (
                  <p className="mt-4 rounded-xl bg-brass-500/15 p-3 text-sm text-brass-300">
                    {t.detail.soldAt}: {npr(auction.winning_amount, lang)}.{" "}
                    {auction.result_note}
                  </p>
                ) : null}
              </div>
              <div className="space-y-6 p-7">
                {auction.status === "open" && (
                  <div>
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-soft">
                      {t.detail.closesIn}
                    </p>
                    <Countdown deadline={auction.submission_deadline} large lang={lang} />
                  </div>
                )}
                <dl className="divide-y divide-ink/8">
                  <Fact label={t.detail.appraised} value={npr(auction.appraised_value, lang)} />
                  <Fact
                    label={t.detail.security(String(auction.bid_security_pct ?? 10))}
                    value={npr(auction.bid_security_amount, lang)}
                  />
                  {noticeRows.map(([l, v]) => (
                    <Fact key={l} label={l} value={v} />
                  ))}
                </dl>
                <div className="rounded-2xl bg-cream p-5 text-sm leading-relaxed text-ink-soft">
                  <p className="font-semibold text-evergreen-900">
                    {t.detail.howToBid}
                  </p>
                  <p className="mt-1.5">{t.detail.howToBidBody}</p>
                </div>
                <a
                  href={`mailto:${contactEmail}?subject=${encodeURIComponent(
                    `${t.detail.enquiry} — ${t.detail.notice} ${auction.notice_number}`
                  )}`}
                  className="block rounded-full bg-evergreen-800 py-3.5 text-center text-sm font-semibold text-ivory transition-colors hover:bg-evergreen-700"
                >
                  {t.detail.contact}
                </a>
                <p className="text-center text-xs text-ink-soft">
                  {org
                    ? [org.contact_phone, lang === "ne" && org.address_np ? org.address_np : org.address]
                        .filter(Boolean)
                        .join(" · ")
                    : "+977 1 442 0000"}
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
