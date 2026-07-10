import type { Metadata } from "next";
import Link from "next/link";
import { AuctionCard } from "@/components/AuctionCard";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { orgName } from "@/lib/i18n/dictionaries";
import { getT } from "@/lib/i18n/server";
import { getDistricts, getOrganizations, getPublicAuctions } from "@/lib/queries";

export const metadata: Metadata = { title: "Auctions" };

export default async function AuctionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    type?: string;
    district?: string;
    org?: string;
    q?: string;
  }>;
}) {
  const { lang, t } = await getT();
  const params = await searchParams;
  const [auctions, districts, orgs] = await Promise.all([
    getPublicAuctions(params),
    getDistricts(),
    getOrganizations(),
  ]);

  const TYPES = [
    { v: "", l: t.listing.allTypes },
    { v: "land", l: t.common.types.land },
    { v: "house", l: t.common.types.house },
    { v: "apartment", l: t.common.types.apartment },
    { v: "commercial", l: t.common.types.commercial },
  ];
  const STATUSES = [
    { v: "", l: t.listing.anyStatus },
    { v: "open", l: t.common.statuses.open },
    { v: "upcoming", l: t.common.statuses.upcoming },
    { v: "closed", l: t.common.statuses.closed },
    { v: "sold", l: t.common.statuses.sold },
  ];

  const active = Object.entries(params).filter(([, v]) => v);
  const selectCls =
    "h-11 rounded-xl border border-ink/12 bg-ivory px-3 text-sm outline-none focus:border-evergreen-600";

  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-5 pb-24">
        <div className="py-12">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brass-600">
            {t.listing.kicker}
          </p>
          <h1 className="font-display mt-2 text-4xl font-semibold tracking-tight text-evergreen-900 sm:text-5xl">
            {t.listing.title}
          </h1>
          <p className="mt-3 max-w-xl leading-relaxed text-ink-soft">
            {t.listing.sub}
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
            placeholder={t.listing.searchPlaceholder}
            className="h-11 min-w-52 flex-1 rounded-xl border border-ink/12 bg-ivory px-4 text-sm outline-none transition-colors focus:border-evergreen-600"
          />
          <select name="type" defaultValue={params.type ?? ""} className={selectCls}>
            {TYPES.map((o) => (
              <option key={o.v} value={o.v}>{o.l}</option>
            ))}
          </select>
          <select name="district" defaultValue={params.district ?? ""} className={selectCls}>
            <option value="">{t.listing.allDistricts}</option>
            {districts.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select name="org" defaultValue={params.org ?? ""} className={selectCls}>
            <option value="">{t.listing.allOrgs}</option>
            {orgs.map((o) => (
              <option key={o.slug} value={o.slug}>{orgName(o, lang)}</option>
            ))}
          </select>
          <select name="status" defaultValue={params.status ?? ""} className={selectCls}>
            {STATUSES.map((o) => (
              <option key={o.v} value={o.v}>{o.l}</option>
            ))}
          </select>
          <button
            type="submit"
            className="h-11 rounded-xl bg-evergreen-800 px-6 text-sm font-semibold text-ivory transition-colors hover:bg-evergreen-700"
          >
            {t.listing.apply}
          </button>
          {active.length > 0 && (
            <Link
              href="/auctions"
              className="text-sm font-medium text-ink-soft underline-offset-4 hover:underline"
            >
              {t.listing.clear}
            </Link>
          )}
        </form>

        {auctions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink/15 bg-cream/60 p-16 text-center">
            <p className="font-display text-2xl text-evergreen-900">
              {t.listing.emptyTitle}
            </p>
            <p className="mt-2 text-ink-soft">{t.listing.emptySub}</p>
          </div>
        ) : (
          <>
            <p className="mb-6 text-sm text-ink-soft">
              {t.listing.count(auctions.length)}
            </p>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {auctions.map((a, i) => (
                <AuctionCard
                  key={a.id}
                  auction={a}
                  property={a.property}
                  index={i}
                  lang={lang}
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
