import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { signOut } from "@/lib/admin/actions";
import { createClient } from "@/lib/supabase/server";

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
    .select("approved, organization_id, organization:organizations(name)")
    .eq("id", user.id)
    .single();

  // Signed in but not yet approved: show the pending screen only
  if (!profile?.approved) {
    return (
      <main className="grid min-h-dvh place-items-center bg-evergreen-950 px-5">
        <div className="w-full max-w-md space-y-5 rounded-3xl border border-ivory/10 bg-ivory p-8 text-center shadow-lift">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-brass-100 text-2xl">
            ⏳
          </div>
          <h1 className="font-display text-2xl font-semibold text-evergreen-900">
            Account pending approval
          </h1>
          <p className="text-sm leading-relaxed text-ink-soft">
            Your staff account request has been received. The platform
            administrator must approve it before you can access the dashboard.
            Please check back later.
          </p>
          <form action={signOut}>
            <button className="rounded-full border border-ink/15 px-6 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:border-danger hover:text-danger">
              Sign out
            </button>
          </form>
        </div>
      </main>
    );
  }

  const isPlatformAdmin = profile.organization_id === null;
  const orgLabel =
    (profile.organization as unknown as { name: string } | null)?.name ??
    "Platform Admin";

  const nav = [
    { href: "/admin", label: "Overview" },
    { href: "/admin/properties", label: "Properties" },
    { href: "/admin/auctions", label: "Auctions" },
    { href: "/admin/bidders", label: "Bidders" },
    ...(isPlatformAdmin ? [{ href: "/admin/staff", label: "Staff" }] : []),
  ];

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
