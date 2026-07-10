import Link from "next/link";
import { Logo } from "@/components/Logo";

const nav = [
  { href: "/auctions", label: "Auctions" },
  { href: "/how-it-works", label: "How it works" },
];

export function Header() {
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
          <Link
            href="/admin"
            className="ml-2 rounded-full border border-evergreen-800/25 px-4 py-2 text-sm font-medium text-evergreen-800 transition-colors hover:bg-evergreen-800 hover:text-ivory"
          >
            Staff sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}
