import Link from "next/link";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Logo } from "@/components/Logo";
import { MobileMenu } from "@/components/site/MobileMenu";
import { getT } from "@/lib/i18n/server";
import { sessionToken } from "@/lib/auth/session";

export async function Header() {
  const { lang, t } = await getT();
  // Only the label changes, so the cookie's presence is enough and costs no
  // request. A stale cookie shows "dashboard" and the panel then sends them to
  // sign in, which is a better trade than an API call on every public page.
  const signedIn = (await sessionToken()) !== null;
  const nav = [
    { href: "/auctions", label: t.nav.auctions },
    { href: "/how-it-works", label: t.nav.howItWorks },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-ink/8 bg-ivory/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:px-5">
        <Logo />
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* The links themselves only fit from sm up; below that they move
              into the menu, which keeps the sign-in reachable on a phone. */}
          <nav className="hidden items-center gap-0.5 sm:flex sm:gap-2">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-full px-2.5 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-evergreen-50 hover:text-evergreen-800 sm:px-3.5"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <LanguageSwitcher lang={lang} />
          <Link
            href="/admin"
            className="ml-1 hidden rounded-full border border-evergreen-800/25 px-4 py-2 text-sm font-medium text-evergreen-800 transition-colors hover:bg-evergreen-800 hover:text-ivory sm:block"
          >
            {signedIn ? t.nav.dashboard : t.nav.staffSignIn}
          </Link>
          <MobileMenu
            links={nav}
            cta={{
              href: "/admin",
              label: signedIn ? t.nav.dashboard : t.nav.staffSignIn,
            }}
            label={t.nav.menu}
          />
        </div>
      </div>
    </header>
  );
}
