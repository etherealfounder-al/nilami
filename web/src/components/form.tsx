import type { ComponentChildren } from "preact";

/*
 * Ruled fields rather than boxes.
 *
 * `.field` is defined once in the design system and shared with the public
 * pages' filter form, so a control looks the same whichever half of the site
 * it appears on. A form on paper names where to write with a line.
 */
export const inputCls = "field";
export const labelCls = "standing";

/**
 * One labelled control.
 *
 * `as="div"` exists for a control that is not a single form element — a label
 * wrapping two inputs binds to the first of them, which makes the second
 * unreachable by clicking its own caption.
 */
export function Field({
  label,
  hint,
  className = "",
  as: Tag = "label",
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  as?: "label" | "div";
  children: ComponentChildren;
}) {
  return (
    <Tag class={`block space-y-1.5 ${className}`}>
      <span class={labelCls}>{label}</span>
      {children}
      {hint && <span class="block text-xs text-ink-soft">{hint}</span>}
    </Tag>
  );
}

export function Section({
  title,
  children,
}: {
  title: string;
  children: ComponentChildren;
}) {
  return (
    <section class="space-y-5">
      <h2 class="font-display border-b border-ink pb-2 text-xl text-ink">{title}</h2>
      {children}
    </section>
  );
}

export function FormCard({
  onSubmit,
  children,
}: {
  onSubmit: (e: Event) => void;
  children: ComponentChildren;
}) {
  return (
    <form
      onSubmit={onSubmit}
      class="space-y-10 border border-rule bg-vellum p-7 shadow-sheet sm:p-9"
    >
      {children}
    </form>
  );
}

export function Actions({
  busy,
  label,
  pendingLabel,
  cancelTo,
  children,
}: {
  busy: boolean;
  label: string;
  pendingLabel: string;
  cancelTo: string;
  children?: ComponentChildren;
}) {
  return (
    <div class="flex flex-wrap items-center gap-6 border-t-2 border-ink pt-6">
      <button
        type="submit"
        disabled={busy}
        class="border-2 border-ink bg-ink px-8 py-2.5 font-display text-base text-oat transition-colors hover:border-seal-800 hover:bg-seal-800 disabled:opacity-50"
      >
        {busy ? pendingLabel : label}
      </button>
      <a href={cancelTo} class="text-sm text-ink-soft transition-colors hover:text-ink">
        Cancel
      </a>
      {children}
    </div>
  );
}

/** Reads a form's values, trimming strings and turning blanks into null. */
export function readForm(form: HTMLFormElement) {
  const data = new FormData(form);
  const str = (k: string) => String(data.get(k) ?? "").trim();
  const strOrNull = (k: string) => str(k) || null;
  const num = (k: string) => {
    const v = str(k);
    if (v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const int = (k: string) => {
    const n = num(k);
    return n === null ? null : Math.trunc(n);
  };
  const bool = (k: string) => data.get(k) != null;
  return { str, strOrNull, num, int, bool };
}
