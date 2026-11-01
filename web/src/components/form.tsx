import type { ComponentChildren } from "preact";

export const inputCls =
  "h-11 w-full rounded-xl border border-ink/15 bg-white px-3.5 text-sm outline-none transition-colors focus:border-evergreen-600";
export const labelCls =
  "text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft";

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
    <section class="space-y-4">
      <h2 class="font-semibold text-evergreen-900">{title}</h2>
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
      class="space-y-8 rounded-2xl border border-ink/8 bg-ivory p-8 shadow-card"
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
    <div class="flex flex-wrap items-center gap-4 border-t border-ink/8 pt-6">
      <button
        type="submit"
        disabled={busy}
        class="rounded-full bg-evergreen-800 px-7 py-3 text-sm font-semibold text-ivory transition-colors hover:bg-evergreen-700 disabled:opacity-60"
      >
        {busy ? pendingLabel : label}
      </button>
      <a href={cancelTo} class="text-sm font-medium text-ink-soft hover:text-ink">
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
