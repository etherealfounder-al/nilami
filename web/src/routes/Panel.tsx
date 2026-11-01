import { useQueryClient } from "@tanstack/react-query";
import { NavLink, Route, Routes } from "react-router";
import { signOut, type Viewer } from "../lib/session";
import { Auctions } from "./Auctions";
import { Bidders } from "./Bidders";
import { Institution } from "./Institution";
import { Overview } from "./Overview";
import { Placeholder } from "./Placeholder";
import { Properties } from "./Properties";
import { Staff } from "./Staff";

/**
 * The panel's frame: who is signed in, what they may reach, and the routes
 * inside it.
 *
 * The navigation is derived from the viewer rather than from the URL, and the
 * API scopes every answer to the same account, so a link that is not shown is
 * also not reachable by typing its address.
 */
export function Panel({ viewer }: { viewer: Viewer }) {
  const queryClient = useQueryClient();

  const proxied = viewer.viewing_as;
  const isPlatformAdmin = proxied
    ? proxied.organization_id === null
    : viewer.is_platform_admin;
  const orgLabel = proxied
    ? proxied.organization_name
    : viewer.organizations.find((o) => o.id === viewer.organization_id)?.name ??
      "Platform Admin";

  const nav = [
    { to: "/", label: "Overview", end: true },
    { to: "/properties", label: "Properties" },
    { to: "/auctions", label: "Auctions" },
    { to: "/bidders", label: "Bidders" },
    { to: "/institution", label: "Institution" },
    ...(isPlatformAdmin ? [{ to: "/staff", label: "Staff" }] : []),
  ];

  return (
    <div class="min-h-dvh bg-cream">
      <header class="border-b border-ink/8 bg-evergreen-950">
        <div class="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5">
          <div class="flex items-baseline gap-3">
            <span class="font-display text-xl font-semibold text-ivory">Nilami</span>
            <span class="text-xs uppercase tracking-[0.14em] text-ivory/50">
              {orgLabel}
            </span>
          </div>
          <button
            onClick={async () => {
              await signOut();
              await queryClient.invalidateQueries({ queryKey: ["session"] });
            }}
            class="text-sm font-medium text-ivory/70 transition-colors hover:text-ivory"
          >
            Sign out
          </button>
        </div>
        <nav class="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-5">
          {/* react-router's components carry React's prop types, so NavLink
              takes className; Preact's `class` shorthand is for DOM tags. */}
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }: { isActive: boolean }) =>
                `shrink-0 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-brass-500 text-ivory"
                    : "border-transparent text-ivory/55 hover:text-ivory/85"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main class="mx-auto max-w-7xl px-5 py-8">
        <Routes>
          <Route index element={<Overview />} />
          <Route path="properties" element={<Properties />} />
          <Route path="properties/new" element={<Placeholder title="New property" />} />
          <Route path="properties/:id" element={<Placeholder title="Edit property" />} />
          <Route path="auctions" element={<Auctions />} />
          <Route path="auctions/new" element={<Placeholder title="New auction" />} />
          <Route path="auctions/:id" element={<Placeholder title="Edit auction" />} />
          <Route path="bidders" element={<Bidders />} />
          <Route path="institution" element={<Institution />} />
          {/* Not merely hidden from the navigation: the API scopes every
              answer to the session, so typing the address reaches nothing. */}
          {isPlatformAdmin && <Route path="staff" element={<Staff />} />}
          <Route path="*" element={<Placeholder title="Not found" />} />
        </Routes>
      </main>
    </div>
  );
}
