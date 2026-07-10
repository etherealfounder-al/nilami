import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";

export const metadata: Metadata = { title: "How it works" };

const steps = [
  {
    title: "The bank publishes an auction notice",
    body: "When a borrower defaults, the collateral property is appraised by a licensed valuer and an auction notice is published in national newspapers and on this portal. The notice states the minimum bid, the bid-security amount, the submission deadline, and the date, time, and venue of the bid opening.",
  },
  {
    title: "You inspect the property and documents",
    body: "Every listing on this portal carries the property's key details, photographs, and loan reference. We strongly advise visiting the property in person and reviewing the ownership documents (lalpurja), blueprints, and tax clearances at our Recovery Department before deciding to bid. Properties are sold on an “as is, where is” basis.",
  },
  {
    title: "You deposit the bid security",
    body: "Deposit 10% of the amount you intend to quote into the bank's designated account, using the account details stated in the notice. Keep the deposit voucher — it must be enclosed with your bid. Unsuccessful bidders are refunded in full after the bid opening.",
  },
  {
    title: "You submit a sealed bid before the deadline",
    body: "Complete the bank's bid form, enclose your deposit voucher, a copy of your citizenship certificate (or company registration and board resolution for firms), and your PAN certificate. Seal the envelope and deliver it to the office stated in the notice before the deadline. Late bids are not accepted.",
  },
  {
    title: "Bids are opened publicly",
    body: "At the stated date and venue, bids are opened in the presence of the bidders who choose to attend. The highest bid at or above the minimum is provisionally accepted, subject to the bank's approval.",
  },
  {
    title: "The winning bidder completes payment",
    body: "The successful bidder must deposit the remaining amount within 35 days of acceptance. Once payment completes, the bank executes the transfer deed and the property is registered in the buyer's name. Registration fees and applicable taxes are borne as per prevailing law.",
  },
];

const faqs = [
  {
    q: "Can I bid online through this portal?",
    a: "Not yet. This portal publishes notices and property details; bids are submitted in sealed form at the bank as required by the notice. Online sealed bidding is planned for a future release.",
  },
  {
    q: "What happens if the auction fails?",
    a: "If no valid bid meets the minimum, the bank may re-auction the property in a subsequent round, often with a revised minimum bid. Each round appears as a fresh notice on this portal.",
  },
  {
    q: "Is the minimum bid negotiable?",
    a: "No. The minimum bid is fixed by the bank based on the appraised value and outstanding dues, and is stated in the published notice.",
  },
  {
    q: "When is my bid security refunded?",
    a: "Unsuccessful bidders are refunded after the bid opening, typically within 7 working days, to the account named in the bid form.",
  },
  {
    q: "Can the borrower settle before the auction?",
    a: "Yes. If the borrower clears the outstanding dues before the bid opening, the bank may withdraw the auction. Withdrawn notices are marked as cancelled on this portal.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-5 pb-24">
        <div className="max-w-2xl py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brass-600">
            The process
          </p>
          <h1 className="font-display mt-2 text-4xl font-semibold tracking-tight text-evergreen-900 sm:text-5xl">
            How bank auctions work
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-ink-soft">
            When a loan is not repaid, the bank recovers it by auctioning the
            property pledged as collateral — openly, at a published minimum
            price, following a fixed legal process. Here is that process, end
            to end.
          </p>
        </div>

        <ol className="relative max-w-3xl space-y-0 border-l border-ink/12 pl-10">
          {steps.map((s, i) => (
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
            Common questions
          </h2>
          <div className="mt-6 divide-y divide-ink/8 rounded-3xl border border-ink/8 bg-white px-7 shadow-card">
            {faqs.map((f) => (
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
            Ready to look at what&apos;s on offer?
          </h2>
          <p className="mt-2 text-ivory/70">
            New notices are published regularly. Open auctions show a live
            countdown to their submission deadline.
          </p>
          <Link
            href="/auctions"
            className="mt-6 inline-block rounded-full bg-brass-500 px-7 py-3 text-sm font-semibold text-evergreen-950 transition-colors hover:bg-brass-300"
          >
            Browse current auctions
          </Link>
        </section>
      </main>
      <Footer />
    </>
  );
}
