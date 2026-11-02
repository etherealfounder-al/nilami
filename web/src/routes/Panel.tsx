import { useQueryClient } from "@tanstack/react-query";
import { NavLink, Route, Routes } from "react-router";
import { signOut, type Viewer } from "../lib/session";
import { setViewAsTarget } from "../lib/api";
import { Mark } from "../components/ui";
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
      <aside class="bg-deep text-on-deep/70 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:border-r lg:border-on-deep/10">
        <div class="flex items-center justify-between gap-4 px-6 pt-7 pb-6 lg:block">
          <div class="flex items-center gap-3">
            <span class="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-on-accent">
              <Mark class="size-6" />
            </span>
            <span class="min-w-0">
              <span aria-hidden="true" class="display block text-2xl leading-none text-on-deep">
                निलामी
              </span>
              <span class="mt-1 block truncate text-[0.625rem] font-semibold tracking-[0.24em] text-accent uppercase">
                {orgLabel}
              </span>
            </span>
          </div>
          <button
            onClick={async () => {
              await signOut();
              await queryClient.invalidateQueries({ queryKey: ["session"] });
            }}
            class="shrink-0 border-b border-on-deep/25 pb-0.5 text-xs text-on-deep/60 transition-colors hover:border-on-deep hover:text-on-deep lg:hidden"
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
                    ? "border-accent text-on-deep"
                    : "border-transparent text-on-deep/50 hover:text-on-deep/90"
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
            class="border-b border-on-deep/25 pb-0.5 text-xs text-on-deep/60 transition-colors hover:border-on-deep hover:text-on-deep"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div class="min-w-0">
        {/* The way back.

            Viewing as someone narrows every answer the server gives, so a
            proxied administrator sees a panel that is quietly missing things
            and has nothing on screen saying why. This says whose panel it is
            and gives one way out; it sits above the content on every screen
            because there is no other place that is always visible. */}
        {proxied && (
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-warn/40 bg-warn-wash px-5 py-2.5 lg:px-10">
            <p class="text-sm text-warn">
              Viewing as <strong class="font-semibold">{proxied.full_name ?? proxied.email}</strong>
              {proxied.organization_name ? ` · ${proxied.organization_name}` : ""}
            </p>
            <button
              type="button"
              onClick={() => {
                setViewAsTarget(null);
                location.assign("/admin");
              }}
              class="text-sm text-warn underline underline-offset-4 transition-opacity hover:opacity-70"
            >
              Stop
            </button>
          </div>
        )}

      <main class="mx-auto w-full max-w-6xl px-5 py-7 sm:py-10 lg:px-10">
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
    </div>
  );
}
