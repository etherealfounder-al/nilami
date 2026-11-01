import { useQueryClient } from "@tanstack/react-query";
import { NavLink, Route, Routes } from "react-router";
import { signOut, type Viewer } from "../lib/session";
import { AuctionEditor } from "./AuctionEditor";
import { Auctions } from "./Auctions";
import { Bidders } from "./Bidders";
import { Institution } from "./Institution";
import { Overview } from "./Overview";
import { Placeholder } from "./Placeholder";
import { Properties } from "./Properties";
import { PropertyEditor } from "./PropertyEditor";
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
    <div class="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr]">
      {/*
        The rail.

        A column rather than a row of tabs: it gives each section a full line
        to name itself, leaves the top of the page for the work, and does not
        start scrolling sideways the moment a seventh section appears.
      */}
      <aside class="bg-seal-950 text-oat/70 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:border-r lg:border-oat/10">
        <div class="flex items-center justify-between gap-4 px-6 pt-7 pb-6 lg:block">
          <div>
            <span aria-hidden="true" class="font-display block text-3xl leading-none text-oat">
              निलामी
            </span>
            <span class="mt-2 block text-[0.625rem] font-semibold tracking-[0.3em] text-brass-500 uppercase">
              {orgLabel}
            </span>
          </div>
          <button
            onClick={async () => {
              await signOut();
              await queryClient.invalidateQueries({ queryKey: ["session"] });
            }}
            class="shrink-0 border-b border-oat/25 pb-0.5 text-xs text-oat/60 transition-colors hover:border-oat hover:text-oat lg:hidden"
          >
            Sign out
          </button>
        </div>

        <nav class="flex gap-1 overflow-x-auto px-4 pb-3 lg:flex-col lg:gap-0 lg:overflow-visible lg:px-3">
          {/* react-router's components carry React's prop types, so NavLink
              takes className; Preact's `class` shorthand is for DOM tags. */}
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }: { isActive: boolean }) =>
                `shrink-0 border-l-2 px-3 py-2.5 text-sm transition-colors lg:px-4 ${
                  isActive
                    ? "border-brass-500 text-oat"
                    : "border-transparent text-oat/50 hover:text-oat/90"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div class="mt-auto hidden px-6 pb-7 lg:block">
          <button
            onClick={async () => {
              await signOut();
              await queryClient.invalidateQueries({ queryKey: ["session"] });
            }}
            class="border-b border-oat/25 pb-0.5 text-xs text-oat/60 transition-colors hover:border-oat hover:text-oat"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main class="mx-auto w-full max-w-6xl px-5 py-10 lg:px-10">
        <Routes>
          <Route index element={<Overview />} />
          <Route path="properties" element={<Properties />} />
          <Route path="properties/new" element={<PropertyEditor mode="new" />} />
          <Route path="properties/:id" element={<PropertyEditor mode="edit" />} />
          <Route path="auctions" element={<Auctions />} />
          <Route path="auctions/new" element={<AuctionEditor mode="new" />} />
          <Route path="auctions/:id" element={<AuctionEditor mode="edit" />} />
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
