import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { signOut, stopViewAs } from "@/lib/admin/actions";
import { getViewAsTarget, getViewer } from "@/lib/admin/view-as";
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

  // The profile lives in the API's database. /v1/admin/me answers only for an
  // approved account, so no viewer means the account is still pending.
  const viewer = await getViewer();

  // Signed in but not yet approved: show the pending screen only
  if (!viewer) {
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
            <SubmitButton
              pendingLabel="Signing out…"
              className="rounded-full border border-ink/15 px-6 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:border-danger hover:text-danger"
            >
              Sign out
            </SubmitButton>
          </form>
        </div>
      </main>
    );
  }

  // A platform admin proxying into someone sees the panel as that person:
  // their institution, their nav, their scope. The real session is unchanged.
  const viewAs = await getViewAsTarget();
  const isPlatformAdmin = viewAs
    ? viewAs.organizationId === null
    : viewer.isPlatformAdmin;
  const orgLabel = viewAs
    ? viewAs.organizationName
    : viewer.organizations.find((o) => o.id === viewer.organizationId)?.name ??
      "Platform Admin";

  const nav = [
    { href: "/admin", label: "Overview" },
    { href: "/admin/properties", label: "Properties" },
    { href: "/admin/auctions", label: "Auctions" },
    { href: "/admin/bidders", label: "Bidders" },
    { href: "/admin/institution", label: "Institution" },
    ...(isPlatformAdmin ? [{ href: "/admin/staff", label: "Staff" }] : []),
  ];

  return (
    <div className="min-h-dvh bg-cream">
      {viewAs && (
        <div className="sticky top-0 z-50 border-b border-brass-500/40 bg-brass-100">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-sm text-brass-600">
              <span aria-hidden>&#9888;</span>{" "}
              <span className="font-semibold">Proxy login</span> — viewing the
              panel as{" "}
              <span className="font-semibold">{viewAs.fullName}</span> (
              {viewAs.organizationName}). Changes you save are still recorded
              under your own account.
            </p>
            <form action={stopViewAs} className="shrink-0">
              <SubmitButton
                pendingLabel="Exiting…"
                className="rounded-full bg-brass-600 px-4 py-1.5 text-xs font-semibold text-ivory transition-colors hover:bg-brass-500"
              >
                Exit proxy login
              </SubmitButton>
            </form>
          </div>
        </div>
      )}
      <header className="sticky top-0 z-40 border-b border-ink/8 bg-ivory/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-3 sm:gap-6">
            <Logo />
            <span className="hidden max-w-40 truncate rounded-full bg-evergreen-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-evergreen-700 sm:inline-block sm:max-w-none">
              {orgLabel}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <nav className="hidden items-center gap-1 md:flex">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-full px-3.5 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-evergreen-50 hover:text-evergreen-800"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <form action={signOut}>
              <SubmitButton
                pendingLabel="Signing out…"
                className="rounded-full border border-ink/15 px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:border-danger hover:text-danger"
              >
                Sign out
              </SubmitButton>
            </form>
          </div>
        </div>
        {/* Scrollable nav strip for phones and small tablets */}
        <nav className="flex items-center gap-1 overflow-x-auto border-t border-ink/8 px-3 py-2 md:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:bg-evergreen-50 hover:text-evergreen-800"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-5 sm:py-10">{children}</main>
    </div>
  );
}
