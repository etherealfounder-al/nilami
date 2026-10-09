/**
 * Shared form field styling.
 *
 * These classes were copied into five form files, and had already drifted: the
 * signup form grew to h-12/px-4 while every admin form stayed h-11/px-3.5, so
 * the same control was a different height depending on which page you were on.
 * One definition means that cannot happen again.
 */
export const inputCls =
  "h-11 w-full rounded-xl border border-ink/15 bg-white px-3.5 text-sm outline-none transition-colors focus:border-evergreen-600";

export const labelCls =
  "text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft";
