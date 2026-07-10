import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { signOut } from "@/lib/admin/actions";
import { createClient } from "@/lib/supabase/server";

const nav = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/properties", label: "Properties" },
  { href: "/admin/auctions", label: "Auctions" },
  { href: "/admin/bidders", label: "Bidders" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization:organizations(name)")
    .eq("id", user.id)
    .single();
  const orgLabel =
    (profile?.organization as unknown as { name: string } | null)?.name ??
    "Platform Admin";

  return (
    <div className="min-h-dvh bg-cream">
      <header className="sticky top-0 z-40 border-b border-ink/8 bg-ivory/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-6">
            <Logo />
            <span className="rounded-full bg-evergreen-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-evergreen-700">
              {orgLabel}
            </span>
          </div>
          <nav className="flex items-center gap-1">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-3.5 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-evergreen-50 hover:text-evergreen-800"
              >
                {item.label}
              </Link>
            ))}
            <form action={signOut}>
              <button className="ml-2 rounded-full border border-ink/15 px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:border-danger hover:text-danger">
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-10">{children}</main>
    </div>
  );
}
