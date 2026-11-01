import type { ComponentChildren } from "preact";
import { statusTone } from "../lib/format";

/** The shapes every panel screen repeats, so they stay identical across them. */

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
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="font-display text-3xl font-semibold tracking-tight text-evergreen-900">
          {title}
        </h1>
        {subtitle && <p class="mt-1 text-sm text-ink-soft">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children }: { children: ComponentChildren }) {
  return (
    <div class="overflow-x-auto rounded-2xl border border-ink/8 bg-ivory shadow-card">
      {children}
    </div>
  );
}

export function Pill({ label, tone }: { label: string; tone?: string }) {
  return (
    <span
      class={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone(
        tone ?? label.toLowerCase()
      )}`}
    >
      {label}
    </span>
  );
}

export function Empty({ children }: { children: ComponentChildren }) {
  return <p class="px-6 py-10 text-center text-sm text-ink-soft">{children}</p>;
}

export function Loading() {
  return <p class="px-6 py-10 text-center text-sm text-ink-soft">Loading…</p>;
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <p class="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{message}</p>
  );
}

/** The primary action button, used for the "new" links on list screens. */
export function PrimaryLink({
  href,
  children,
}: {
  href: string;
  children: ComponentChildren;
}) {
  return (
    <a
      href={href}
      class="shrink-0 self-start rounded-full bg-evergreen-800 px-5 py-2.5 text-sm font-semibold text-ivory transition-colors hover:bg-evergreen-700 sm:self-auto"
    >
      {children}
    </a>
  );
}
