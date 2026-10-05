import Link from "next/link";
import { AuctionCard } from "@/components/AuctionCard";
import { NepalPropertyMap, type DistrictPoint } from "@/components/NepalPropertyMap";
import { DISTRICT_COORDINATES } from "@/lib/nepal/district-coordinates";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { nprCompact } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { getHomeSummary } from "@/lib/queries";

export default async function HomePage() {
  const { lang, t } = await getT();
  // The whole page in one request: the headline figures, the per-district
  // counts behind the map, and the six cards. The counts are computed in SQL,
  // so the page no longer pulls every auction in order to tally them.
  const { open_count, open_value, districts, featured } = await getHomeSummary();

  // One map marker per district that has properties on offer. Districts with
  // no centroid on file are skipped rather than dropped on the equator.
  const mapPoints: DistrictPoint[] = districts
    .filter(({ district }) => DISTRICT_COORDINATES[district])
    .map(({ district, count }) => ({
      district,
      count,
      lat: DISTRICT_COORDINATES[district][0],
      lng: DISTRICT_COORDINATES[district][1],
      label: t.home.mapCount(count),
    }));
  const nums = ["01", "02", "03", "04"];

  return (
    <>
      <Header />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-evergreen-950 text-ivory">
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.35]"
            style={{
              background:
                "radial-gradient(80rem 40rem at 80% -10%, #1b6a52 0%, transparent 55%), radial-gradient(50rem 30rem at 0% 110%, #14503e 0%, transparent 50%)",
            }}
          />
          <div className="relative mx-auto grid max-w-6xl gap-12 px-5 py-20 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:py-28">
            <div className="space-y-7">
              <p className="rise inline-flex items-center gap-2 rounded-full border border-brass-300/30 bg-brass-300/10 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-brass-300">
                {t.home.badge}
              </p>
              <h1 className="rise rise-1 font-display text-5xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
                {t.home.title1}
                <br />
                <span className="text-brass-300">{t.home.title2}</span>
              </h1>
              <p className="rise rise-2 max-w-xl text-lg leading-relaxed text-ivory/70">
                {t.home.sub}
              </p>
              <div className="rise rise-3 flex flex-wrap items-center gap-4">
                <Link
                  href="/auctions"
                  className="rounded-full bg-brass-500 px-7 py-3.5 text-sm font-semibold text-evergreen-950 shadow-lift transition-all hover:bg-brass-300"
                >
                  {t.home.ctaBrowse}
                </Link>
                <Link
                  href="/how-it-works"
                  className="rounded-full border border-ivory/25 px-7 py-3.5 text-sm font-medium text-ivory transition-colors hover:bg-ivory/10"
                >
                  {t.home.ctaHow}
                </Link>
              </div>
              <div className="rise rise-3 flex flex-wrap gap-x-8 gap-y-5 pt-4 sm:gap-10">
                {[
                  { v: String(open_count), l: t.home.statOpen },
                  { v: nprCompact(open_value, lang), l: t.home.statValue },
                  { v: "10%", l: t.home.statSecurity },
                ].map((s) => (
                  <div key={s.l}>
                    <p className="font-display text-3xl font-semibold text-ivory">
                      {s.v}
                    </p>
                    <p className="mt-1 max-w-32 text-xs leading-snug text-ivory/50">
                      {s.l}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Where the properties are */}
            <div className="rise rise-2">
              <NepalPropertyMap
                points={mapPoints}
                emptyLabel={t.home.mapEmpty}
                viewLabel={t.home.mapView}
              />
              <p className="mt-3 text-center text-xs text-ivory/50">
                {t.home.mapCaption}
              </p>
            </div>
          </div>
        </section>

        {/* Current auctions */}
        <section className="mx-auto max-w-6xl px-5 py-20">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brass-600">
                {t.home.kicker}
              </p>
              <h2 className="font-display mt-2 text-4xl font-semibold tracking-tight text-evergreen-900">
                {t.home.underAuction}
              </h2>
            </div>
            <Link
              href="/auctions"
              className="hidden rounded-full border border-evergreen-800/25 px-5 py-2.5 text-sm font-medium text-evergreen-800 transition-colors hover:bg-evergreen-800 hover:text-ivory sm:block"
            >
              {t.home.viewAll}
            </Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((a, i) => (
              <AuctionCard key={a.id} auction={a} property={a.property} index={i} lang={lang} />
            ))}
          </div>
        </section>

        {/* Process */}
        <section className="border-y border-ink/8 bg-cream">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <div className="mb-12 max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brass-600">
                {t.home.processKicker}
              </p>
              <h2 className="font-display mt-2 text-4xl font-semibold tracking-tight text-evergreen-900">
                {t.home.processTitle}
              </h2>
              <p className="mt-3 leading-relaxed text-ink-soft">
                {t.home.processSub}
              </p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {t.home.steps.map((s, i) => (
                <div
                  key={s.title}
                  className="rounded-2xl border border-ink/8 bg-ivory p-6 shadow-card"
                >
                  <p className="font-display text-3xl font-semibold text-brass-500">
                    {nums[i]}
                  </p>
                  <h3 className="mt-4 font-semibold text-evergreen-900">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                    {s.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Assurance strip */}
        <section className="mx-auto max-w-6xl px-5 py-20">
          <div className="overflow-hidden rounded-3xl bg-evergreen-900 px-8 py-14 text-center text-ivory sm:px-16">
            <h2 className="font-display mx-auto max-w-2xl text-3xl font-semibold leading-snug sm:text-4xl">
              {t.home.assurance1}
              <span className="text-brass-300">{t.home.assurance2}</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl leading-relaxed text-ivory/65">
              {t.home.assuranceSub}
            </p>
            <Link
              href="/auctions"
              className="mt-8 inline-block rounded-full bg-brass-500 px-8 py-3.5 text-sm font-semibold text-evergreen-950 transition-colors hover:bg-brass-300"
            >
              {t.home.assuranceCta}
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
