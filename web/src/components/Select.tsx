import { useSelect } from "downshift";

export type Option = { value: string; label: string; hint?: string };

/**
 * A select whose open list belongs to the page.
 *
 * A native <select> can be styled shut but not open: the popup is drawn by the
 * operating system, down to the highlight colour, and no CSS reaches it.
 *
 * The behaviour comes from downshift rather than from here. What a native
 * select gives for free — keyboard navigation, type-ahead, the ARIA roles a
 * screen reader needs, focus handling — is genuinely hard to rebuild
 * correctly, and getting it subtly wrong produces a control that looks right
 * and is unusable without a mouse. downshift is 15 KB and headless, so the
 * behaviour is borrowed and the appearance stays ours; react-select is twice
 * that, brings its own styling layer, and would have to be fought back into
 * this design system.
 *
 * A hidden input carries the value, so every form around this submits exactly
 * as it did when these were native controls.
 */
export function Select({
  name,
  value,
  options,
  placeholder = "Choose…",
  required,
  disabled,
  onChange,
  class: cls = "",
}: {
  name: string;
  value: string;
  options: Option[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
  class?: string;
}) {
  const selected = options.find((o) => o.value === value) ?? null;

  const {
    isOpen,
    getToggleButtonProps,
    getMenuProps,
    getItemProps,
    highlightedIndex,
  } = useSelect<Option>({
    items: options,
    selectedItem: selected,
    itemToString: (o) => o?.label ?? "",
    onSelectedItemChange: ({ selectedItem }) => {
      if (selectedItem) onChange(selectedItem.value);
    },
  });

  return (
    <div class={`relative ${cls}`}>
      {/* The form still sees a plain value, so nothing around this changes. */}
      <input type="hidden" name={name} value={value} required={required} />

      <button
        type="button"
        disabled={disabled}
        {...getToggleButtonProps()}
        class={`field flex items-center justify-between gap-2 text-left ${
          disabled ? "cursor-not-allowed opacity-55" : "cursor-pointer"
        }`}
      >
        <span class={`truncate ${selected ? "" : "text-content-faint"}`}>
          {selected?.label ?? placeholder}
        </span>
        <svg
          viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"
          stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
          class={`size-4 shrink-0 text-content-faint transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`}
        >
          <path d="M4 6.5l4 4 4-4" />
        </svg>
      </button>

      {/* The list is always rendered so downshift keeps its ref; it is only
          populated when open, which is what keeps a 753-item municipality
          list from being in the DOM the rest of the time. */}
      <ul
        {...getMenuProps()}
        class={
          isOpen
            ? "absolute z-50 mt-1.5 max-h-64 w-full overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-lift"
            : "hidden"
        }
      >
        {isOpen && options.length === 0 && (
          <li class="px-3 py-2 text-sm text-content-faint">Nothing to choose</li>
        )}
        {isOpen &&
          options.map((o, i) => (
            <li
              key={o.value}
              {...getItemProps({ item: o, index: i })}
              class={`flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm ${
                highlightedIndex === i ? "bg-accent-wash text-accent" : "text-content"
              }`}
            >
              <span class="flex-1 truncate">{o.label}</span>
              {o.hint && <span class="shrink-0 text-xs text-content-faint">{o.hint}</span>}
              {o.value === value && (
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"
                     stroke-linecap="round" stroke-linejoin="round" class="size-3.5 shrink-0" aria-hidden="true">
                  <path d="M3 8.5l3.5 3.5L13 5" />
                </svg>
              )}
            </li>
          ))}
      </ul>
    </div>
  );
}
