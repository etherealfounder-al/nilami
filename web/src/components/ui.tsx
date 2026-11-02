import type { ComponentChildren } from "preact";
import { useState } from "react";
import { Link } from "react-router";
import { statusTone } from "../lib/format";

/**
 * The mark.
 *
 * An auction gavel — a mallet mid-strike over its block. Drawn in strokes and
 * in currentColor so one definition serves the rail, the sign-in panel and
 * either ground. It is the same geometry the public chrome and the favicon
 * use; a brand that redraws itself per surface is not a brand.
 */
export function Mark({ class: cls = "size-6" }: { class?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" class={cls}>
      <g stroke="currentColor" stroke-width="5" stroke-linecap="round">
        <path d="M14 50h20" />
        <path d="M24 50V33" />
        <path d="M17 15l14 14" />
        <path d="M24 11l14 14" />
        <path d="M13 22l14 14" />
        <path d="M34 27l16 16" />
      </g>
    </svg>
  );
}

/**
 * The shapes every panel screen repeats, so they stay identical across them.
 *
 * The panel is the back office of the gazette the public pages publish, so it
 * is set on the same paper in the same ink — but arranged for work rather
 * than for reading: rules instead of cards, and figures given room.
 */

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ComponentChildren;
}) {
  return (
    <div class="flex flex-col gap-4 border-b-2 border-content pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="display text-[2rem] leading-none text-content">{title}</h1>
        {subtitle && <p class="mt-2 text-sm text-content-soft">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/**
 * A sheet: the surface a table or a form sits on.
 *
 * Barely raised, because paper does not flpaper. The horizontal scroll lives
 * here so a wide table does not push the whole page sideways on a phone.
 */
export function Card({ children }: { children: ComponentChildren }) {
  return (
    <div class="overflow-x-auto border border-line bg-surface shadow-soft">
      {children}
    </div>
  );
}

/** A status, chiped rather than pilled — the same mark the notices carry. */
export function Pill({ label, tone }: { label: string; tone?: string }) {
  return (
    <span class={`chip ${statusTone(tone ?? label.toLowerCase())}`}>{label}</span>
  );
}

export function Empty({ children }: { children: ComponentChildren }) {
  return <p class="px-6 py-14 text-center text-sm text-content-faint">{children}</p>;
}

export function Loading() {
  return <p class="px-6 py-14 text-center text-sm text-content-faint">Loading…</p>;
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <p class="border-l-2 border-bad bg-bad-wash px-4 py-3 text-sm text-bad">
      {message}
    </p>
  );
}

/** The heading row of a ruled table. */
export function THead({ cols }: { cols: (string | { label: string; right?: boolean })[] }) {
  return (
    <thead>
      <tr class="border-b-2 border-content">
        {cols.map((c) => {
          const col = typeof c === "string" ? { label: c, right: false } : c;
          return (
            <th
              key={col.label}
              class={`eyebrow px-4 py-3 ${col.right ? "text-right" : "text-left"} first:pl-5 last:pr-5`}
            >
              {col.label}
            </th>
          );
        })}
      </tr>
    </thead>
  );
}

/**
 * The primary action, used for the "new" links on list screens.
 *
 * A router Link rather than an anchor: an anchor reloads the whole app to
 * reach a route it already holds, which costs a blank screen and a fresh
 * round of queries.
 */
export function PrimaryLink({
  to,
  children,
}: {
  to: string;
  children: ComponentChildren;
}) {
  return (
    <Link
      to={to}
      class="shrink-0 self-start border-b-2 border-content pb-1 display text-lg text-content transition-colors hover:border-accent hover:text-accent sm:self-auto"
    >
      {children}
    </Link>
  );
}

/**
 * A password field that can be revealed.
 *
 * Typing a long password blind is where most failed sign-ins come from, and a
 * reveal toggle is cheaper than a reset. The button carries type="button" so
 * it never submits the form it sits in, and aria-pressed so a screen reader
 * announces the current state rather than just the label.
 */
export function PasswordInput({
  name,
  autoComplete,
  required,
  class: cls,
}: {
  name: string;
  autoComplete?: string;
  required?: boolean;
  class?: string;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div class="relative">
      <input
        type={shown ? "text" : "password"}
        name={name}
        required={required}
        autoComplete={autoComplete}
        class={`${cls ?? ""} pr-11`}
      />
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        aria-pressed={shown}
        aria-label={shown ? "Hide password" : "Show password"}
        class="absolute inset-y-0 right-0 grid w-11 place-items-center text-content-faint transition-colors hover:text-accent"
      >
        {shown ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="size-5" aria-hidden="true">
            <path d="M3 3l18 18M10.6 10.7a2 2 0 002.8 2.8" stroke-linecap="round" />
            <path d="M16.7 16.8A9.3 9.3 0 0112 18c-5 0-9-6-9-6a16.8 16.8 0 014.1-4.6m3.1-1.2A9.3 9.3 0 0112 6c5 0 9 6 9 6a16.9 16.9 0 01-2.3 3" stroke-linecap="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="size-5" aria-hidden="true">
            <path d="M3 12s4-6 9-6 9 6 9 6-4 6-9 6-9-6-9-6z" stroke-linecap="round" />
            <circle cx="12" cy="12" r="2.4" />
          </svg>
        )}
      </button>
    </div>
  );
}
