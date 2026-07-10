import Link from "next/link";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Logo } from "@/components/Logo";
import { getT } from "@/lib/i18n/server";

export async function Header() {
  const { lang, t } = await getT();
  const nav = [
    { href: "/auctions", label: t.nav.auctions },
    { href: "/how-it-works", label: t.nav.howItWorks },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-ink/8 bg-ivory/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Logo />
        <nav className="flex items-center gap-1 sm:gap-2">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-3.5 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-evergreen-50 hover:text-evergreen-800"
            >
              {item.label}
            </Link>
          ))}
          <LanguageSwitcher lang={lang} />
          <Link
            href="/admin"
            className="ml-1 hidden rounded-full border border-evergreen-800/25 px-4 py-2 text-sm font-medium text-evergreen-800 transition-colors hover:bg-evergreen-800 hover:text-ivory sm:block"
          >
            {t.nav.staffSignIn}
          </Link>
        </nav>
      </div>
    </header>
  );
}
