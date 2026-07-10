import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "How it works" };

export default async function HowItWorksPage() {
  const { t } = await getT();
  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-5 pb-24">
        <div className="max-w-2xl py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brass-600">
            {t.how.kicker}
          </p>
          <h1 className="font-display mt-2 text-4xl font-semibold tracking-tight text-evergreen-900 sm:text-5xl">
            {t.how.title}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-ink-soft">
            {t.how.sub}
          </p>
        </div>

        <ol className="relative max-w-3xl space-y-0 border-l border-ink/12 pl-10">
          {t.how.steps.map((s, i) => (
            <li key={s.title} className="relative pb-12">
              <span className="absolute -left-[3.35rem] grid size-10 place-items-center rounded-full border border-brass-500/50 bg-ivory font-display text-sm font-semibold text-brass-600">
                {i + 1}
              </span>
              <h2 className="font-display text-2xl font-semibold text-evergreen-900">
                {s.title}
              </h2>
              <p className="mt-2 leading-relaxed text-ink-soft">{s.body}</p>
            </li>
          ))}
        </ol>

        <section className="mt-8 max-w-3xl">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-evergreen-900">
            {t.how.faqTitle}
          </h2>
          <div className="mt-6 divide-y divide-ink/8 rounded-3xl border border-ink/8 bg-white px-7 shadow-card">
            {t.how.faqs.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-evergreen-900">
                  {f.q}
                  <span className="text-brass-600 transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-16 max-w-3xl rounded-3xl bg-evergreen-900 p-10 text-ivory">
          <h2 className="font-display text-2xl font-semibold">
            {t.how.ctaTitle}
          </h2>
          <p className="mt-2 text-ivory/70">{t.how.ctaSub}</p>
          <Link
            href="/auctions"
            className="mt-6 inline-block rounded-full bg-brass-500 px-7 py-3 text-sm font-semibold text-evergreen-950 transition-colors hover:bg-brass-300"
          >
            {t.how.ctaButton}
          </Link>
        </section>
      </main>
      <Footer />
    </>
  );
}
