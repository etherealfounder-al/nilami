"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

/** Never changes, so the store only ever reports its initial snapshot. */
const subscribeNever = () => () => {};

export type SelectOption = {
  value: string;
  label: string;
  /** Rendered but not choosable — used for the "Select your institution…" prompt. */
  disabled?: boolean;
};

type Variant = "field" | "pill" | "filter";

/**
 * A select whose dropdown we control.
 *
 * A native <select> renders its option list with the operating system, which
 * on macOS is a grey menu that ignores every token in our theme. Replacing it
 * outright is the usual fix and the usual regression: a <div> listbox submits
 * nothing, validates nothing, and loses the native picker that phones give us
 * for free.
 *
 * So the native element stays, and stays the form control. It carries the
 * name, the value and `required`, which means a GET form still filters without
 * JavaScript and the browser still refuses an empty required field. Once this
 * component mounts we hide it and drive it from our own listbox, which is the
 * only part the OS was styling badly.
 *
 * The hidden select keeps layout (`absolute inset-0 opacity-0`) rather than
 * `display:none`. A constraint violation on a `display:none` control throws
 * "An invalid form control is not focusable" and blocks submission with no
 * message, because the browser cannot anchor the bubble to a box that was
 * never laid out.
 */
export function Select({
  options,
  name,
  value,
  defaultValue,
  onValueChange,
  placeholder,
  required,
  disabled,
  variant = "field",
  className = "",
  id,
  "aria-label": ariaLabel,
}: {
  options: readonly SelectOption[];
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  variant?: Variant;
  className?: string;
  id?: string;
  "aria-label"?: string;
}) {
  const reactId = useId();
  const listId = `${reactId}-listbox`;
  const buttonId = id ?? `${reactId}-button`;

  // Uncontrolled callers keep their value here; controlled callers own it.
  const [internal, setInternal] = useState(defaultValue ?? "");
  const current = value !== undefined ? value : internal;

  // Before hydration we render only the native select, so the server HTML and
  // the first client paint agree and a no-JS browser gets a working control.
  // Read through a store rather than an effect: setState in an effect costs a
  // second render pass of every select on the page.
  const mounted = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false
  );
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const rootRef = useRef<HTMLDivElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typeahead = useRef({ buffer: "", at: 0 });

  const choosable = useMemo(
    () => options.filter((o) => !o.disabled),
    [options]
  );
  const selected = options.find((o) => o.value === current);

  const label =
    selected && selected.value !== ""
      ? selected.label
      : placeholder ?? selected?.label ?? "";

  const commit = useCallback(
    (next: string) => {
      if (value === undefined) setInternal(next);
      onValueChange?.(next);
      // Mirror into the native control so a plain form submit sees the change
      // and any :invalid styling recomputes.
      const el = selectRef.current;
      if (el && el.value !== next) {
        el.value = next;
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
    },
    [onValueChange, value]
  );

  const openList = useCallback(() => {
    if (disabled) return;
    const i = choosable.findIndex((o) => o.value === current);
    setActive(i >= 0 ? i : 0);
    setOpen(true);
  }, [choosable, current, disabled]);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    setActive(-1);
    if (refocus) document.getElementById(buttonId)?.focus();
  }, [buttonId]);

  // Close on a click that lands outside, and on scroll of an ancestor, since
  // the panel is positioned relative to the trigger rather than the viewport.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open, close]);

  // Keep the highlighted row in view when arrowing through a long list.
  useEffect(() => {
    if (!open || active < 0) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }

    switch (e.key) {
      case "Escape":
        e.preventDefault();
        close();
        return;
      case "Tab":
        close(false);
        return;
      case "ArrowDown":
        e.preventDefault();
        setActive((i) => Math.min(i + 1, choosable.length - 1));
        return;
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
        return;
      case "Home":
        e.preventDefault();
        setActive(0);
        return;
      case "End":
        e.preventDefault();
        setActive(choosable.length - 1);
        return;
      case "Enter":
      case " ":
        e.preventDefault();
        if (choosable[active]) {
          commit(choosable[active].value);
          close();
        }
        return;
    }

    // Typeahead: successive letters within a second extend the search, so
    // "ka" reaches Kavre rather than jumping to anything starting with "a".
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const now = Date.now();
      const t = typeahead.current;
      t.buffer = now - t.at > 1000 ? e.key : t.buffer + e.key;
      t.at = now;
      const hit = choosable.findIndex((o) =>
        o.label.toLowerCase().startsWith(t.buffer.toLowerCase())
      );
      if (hit >= 0) setActive(hit);
    }
  };

  const trigger = {
    pill: "h-8 cursor-pointer rounded-full bg-cream pl-3.5 pr-3 text-sm font-semibold tabular-nums text-evergreen-900 transition-colors hover:bg-evergreen-50",
    // The public listing filters sit on ivory inside a white card.
    filter:
      "h-11 w-full cursor-pointer rounded-xl border border-ink/12 bg-ivory px-3 text-left text-sm transition-colors hover:border-ink/25 sm:w-auto sm:min-w-44",
    field:
      "h-11 w-full cursor-pointer rounded-xl border border-ink/15 bg-white px-3.5 text-left text-sm transition-colors hover:border-ink/25",
  }[variant];

  return (
    <div
      ref={rootRef}
      className={`relative ${
        {
          pill: "inline-block",
          filter: "block w-full sm:w-auto",
          field: "block",
        }[variant]
      } ${className}`}
    >
      {/* The real control. Laid out but invisible so validation can anchor. */}
      <select
        ref={selectRef}
        name={name}
        required={required}
        disabled={disabled}
        value={current}
        aria-hidden={mounted}
        tabIndex={mounted ? -1 : undefined}
        onChange={(e) => {
          if (value === undefined) setInternal(e.target.value);
          onValueChange?.(e.target.value);
        }}
        className={
          mounted
            ? "absolute inset-0 h-full w-full opacity-0 pointer-events-none"
            : `${trigger} appearance-none`
        }
      >
        {placeholder !== undefined && !options.some((o) => o.value === "") && (
          <option value="" disabled={required}>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>

      {mounted && (
        <>
          <button
            type="button"
            id={buttonId}
            role="combobox"
            aria-controls={listId}
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-label={ariaLabel}
            disabled={disabled}
            onClick={() => (open ? close() : openList())}
            onKeyDown={onKeyDown}
            className={`${trigger} relative flex items-center justify-between gap-2 outline-none focus-visible:border-evergreen-600 focus-visible:ring-2 focus-visible:ring-evergreen-600/30 disabled:cursor-not-allowed disabled:opacity-60 ${
              open ? "border-evergreen-600" : ""
            }`}
          >
            <span
              className={`truncate ${
                selected && selected.value !== "" ? "" : "text-ink-soft"
              }`}
            >
              {label}
            </span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className={`size-3.5 shrink-0 text-ink-soft transition-transform ${
                open ? "rotate-180" : ""
              }`}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          {open && (
            <div
              ref={listRef}
              id={listId}
              role="listbox"
              aria-activedescendant={
                active >= 0 ? `${reactId}-opt-${active}` : undefined
              }
              tabIndex={-1}
              onKeyDown={onKeyDown}
              className="absolute z-50 mt-1.5 max-h-64 w-full min-w-max overflow-y-auto rounded-xl border border-ink/12 bg-white p-1 shadow-lg shadow-ink/10"
            >
              {choosable.length === 0 ? (
                <p className="px-3 py-2.5 text-sm text-ink-soft">
                  Nothing to choose from yet.
                </p>
              ) : (
                choosable.map((o, i) => {
                  const isSelected = o.value === current;
                  return (
                    <div
                      key={o.value}
                      id={`${reactId}-opt-${i}`}
                      data-index={i}
                      role="option"
                      aria-selected={isSelected}
                      onPointerEnter={() => setActive(i)}
                      onClick={() => {
                        commit(o.value);
                        close();
                      }}
                      className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                        i === active
                          ? "bg-evergreen-50 text-evergreen-900"
                          : "text-ink"
                      } ${isSelected ? "font-semibold" : ""}`}
                    >
                      <span className="truncate">{o.label}</span>
                      {isSelected && (
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                          className="size-3.5 shrink-0 text-evergreen-600"
                        >
                          <path d="m5 13 4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
