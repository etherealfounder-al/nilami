import Link from "next/link";
import { Logo } from "@/components/Logo";
import { getT } from "@/lib/i18n/server";

export async function Footer() {
  const { t } = await getT();
  return (
    <footer className="bg-evergreen-950 text-ivory/70">
      <div className="mx-auto max-w-6xl px-5 py-14">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm space-y-4">
            <Logo dark />
            <p className="text-sm leading-relaxed">{t.footer.tagline}</p>
          </div>
          <div className="grid grid-cols-2 gap-10 text-sm sm:grid-cols-3">
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brass-300">
                {t.footer.browse}
              </p>
              <ul className="space-y-2">
                <li><Link className="hover:text-ivory" href="/auctions">{t.footer.allAuctions}</Link></li>
                <li><Link className="hover:text-ivory" href="/auctions?status=open">{t.footer.openForBids}</Link></li>
                <li><Link className="hover:text-ivory" href="/how-it-works">{t.footer.howItWorks}</Link></li>
              </ul>
            </div>
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brass-300">
                {t.footer.platform}
              </p>
              <ul className="space-y-2">
                {t.footer.platformLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brass-300">
                {t.footer.noticeTitle}
              </p>
              <p className="leading-relaxed">{t.footer.noticeBody}</p>
            </div>
          </div>
        </div>
        <div className="mt-12 border-t border-ivory/10 pt-6 text-xs text-ivory/40">
          © {new Date().getFullYear()} Nilami. {t.footer.rights}
        </div>
      </div>
    </footer>
  );
}
