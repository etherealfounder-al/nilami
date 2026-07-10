import Image from "next/image";
import Link from "next/link";
import { AuctionCard } from "@/components/AuctionCard";
import { Countdown } from "@/components/Countdown";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { nprCompact, typeLabel } from "@/lib/format";
import { orgName } from "@/lib/i18n/dictionaries";
import { getT } from "@/lib/i18n/server";
import { getPublicAuctions } from "@/lib/queries";

export default async function HomePage() {
  const { lang, t } = await getT();
  const auctions = await getPublicAuctions();
  const open = auctions.filter((a) => a.status === "open");
  const featured = open[0];
  const rest = auctions.filter((a) => a.id !== featured?.id).slice(0, 6);
  const totalValue = open.reduce((s, a) => s + a.minimum_bid, 0);
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
              <div className="rise rise-3 flex gap-10 pt-4">
                {[
                  { v: String(open.length), l: t.home.statOpen },
                  { v: nprCompact(totalValue, lang), l: t.home.statValue },
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

            {/* Featured card */}
            {featured && (
              <Link
                href={`/auctions/${featured.property.slug}`}
                className="rise rise-2 group relative block overflow-hidden rounded-3xl border border-ivory/10 bg-ivory/5 shadow-lift backdrop-blur"
              >
                <div className="relative aspect-[4/3]">
                  {featured.property.images?.[0] && (
                    <Image
                      src={featured.property.images[0].url}
                      alt={featured.property.title}
                      fill
                      priority
                      sizes="(max-width: 1024px) 100vw, 40vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-evergreen-950/90 via-evergreen-950/20 to-transparent" />
                  <span className="absolute left-4 top-4 rounded-full bg-brass-500 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-evergreen-950">
                    {t.home.featured}
                  </span>
                  <div className="absolute inset-x-0 bottom-0 space-y-3 p-6">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-brass-300">
                      {typeLabel(featured.property.type, lang)} ·{" "}
                      {orgName(featured.property.organization, lang)}
                    </p>
                    <h2 className="font-display text-2xl font-semibold leading-snug">
                      {featured.property.title}
                    </h2>
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.14em] text-ivory/60">
                          {t.common.minimumBid}
                        </p>
                        <p className="font-display text-3xl font-semibold text-brass-300">
                          {nprCompact(featured.minimum_bid, lang)}{" "}
                          <span className="text-sm font-normal text-ivory/60">
                            {t.common.npr}
                          </span>
                        </p>
                      </div>
                      <Countdown deadline={featured.submission_deadline} lang={lang} />
                    </div>
                  </div>
                </div>
              </Link>
            )}
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
            {rest.map((a, i) => (
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
