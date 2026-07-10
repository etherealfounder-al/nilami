import Link from "next/link";
import { Logo } from "@/components/Logo";

export function Footer() {
  return (
    <footer className="bg-evergreen-950 text-ivory/70">
      <div className="mx-auto max-w-6xl px-5 py-14">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm space-y-4">
            <Logo dark />
            <p className="text-sm leading-relaxed">
              The official portal for collateral properties offered for sale by
              the bank under prevailing recovery laws. All sales are conducted
              through published auction notices.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-10 text-sm sm:grid-cols-3">
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brass-300">
                Browse
              </p>
              <ul className="space-y-2">
                <li><Link className="hover:text-ivory" href="/auctions">All auctions</Link></li>
                <li><Link className="hover:text-ivory" href="/auctions?status=open">Open for bids</Link></li>
                <li><Link className="hover:text-ivory" href="/how-it-works">How it works</Link></li>
              </ul>
            </div>
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brass-300">
                Recovery Department
              </p>
              <ul className="space-y-2">
                <li>Durbarmarg, Kathmandu</li>
                <li>Sun–Fri, 10:00–17:00</li>
                <li>+977 1 442 0000</li>
                <li>recovery@nilami.app</li>
              </ul>
            </div>
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brass-300">
                Notice
              </p>
              <p className="leading-relaxed">
                Properties are sold on an &ldquo;as is, where is&rdquo; basis.
                Bidders must inspect properties and verify documents before
                bidding.
              </p>
            </div>
          </div>
        </div>
        <div className="mt-12 border-t border-ivory/10 pt-6 text-xs text-ivory/40">
          © {new Date().getFullYear()} Nilami. A demonstration auction portal.
        </div>
      </div>
    </footer>
  );
}
