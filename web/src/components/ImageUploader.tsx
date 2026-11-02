import type { ComponentChildren } from "preact";
import { useState } from "react";
import { api } from "../lib/api";

type Presigned = {
  upload_url: string;
  public_url: string;
  key: string;
  expires_in: number;
};

/**
 * Photographs, uploaded straight from the browser to object storage.
 *
 * The bytes never pass through the API or the server: it signs a URL, and the
 * browser PUTs to it. A ten-megabyte photograph on a Kathmandu connection
 * would otherwise occupy a request slot on a two-core box for the whole upload.
 *
 * The signature covers content-type and host, so the PUT must send exactly the
 * type that was signed for — a mismatch is rejected by storage, not by us.
 */
export function ImageUploader({
  urls,
  onChange,
}: {
  urls: string[];
  onChange: (next: string[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    const added: string[] = [];
    try {
      for (const file of Array.from(files)) {
        const signed = await api<Presigned>("/v1/admin/uploads", {
          method: "POST",
          body: { kind: "property", content_type: file.type },
        });
        const put = await fetch(signed.upload_url, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!put.ok) throw new Error(`storage refused the upload (${put.status})`);
        added.push(signed.public_url);
      }
      onChange([...urls, ...added]);
    } catch (e) {
      // Whatever uploaded before the failure is kept: making someone re-send
      // four photographs because the fifth failed is worse than a partial set.
      if (added.length) onChange([...urls, ...added]);
      setError(e instanceof Error ? e.message : "The upload failed.");
    } finally {
      setBusy(false);
    }
  }

  const move = (from: number, to: number) => {
    if (to < 0 || to >= urls.length) return;
    const next = [...urls];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  function remove(url: string) {
    onChange(urls.filter((u) => u !== url));
  }

  /*
   * Reordering by drag, using the browser's own drag-and-drop rather than a
   * library. The whole interaction is four events and an index swap; a
   * dependency for it would cost more than the admin's entire select control.
   * The arrow buttons stay for keyboard and touch, where dragging is either
   * impossible or unpleasant.
   */
  function onDrop(to: number) {
    const from = dragging;
    setDragging(null);
    if (from === null || from === to) return;
    move(from, to);
  }

  return (
    <div class="space-y-3">
      <div class="flex flex-wrap items-center gap-3">
        <label class="btn btn-quiet cursor-pointer">
          {busy ? "Uploading…" : "Add photographs"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={busy}
            class="sr-only"
            onChange={(e) => {
              const input = e.currentTarget as HTMLInputElement;
              void upload(input.files);
              // Cleared so choosing the same file twice fires again.
              input.value = "";
            }}
          />
        </label>
        <span class="text-xs text-content-faint">
          JPEG, PNG or WebP. The first is the cover — drag to reorder.
        </span>
      </div>

      {error && (
        <p class="rounded-lg border border-bad/30 bg-bad-wash px-4 py-3 text-sm text-bad">{error}</p>
      )}

      {urls.length > 0 && (
        <ul class="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {urls.map((url, i) => (
            <li
              key={url}
              draggable
              onDragStart={() => setDragging(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(i)}
              onDragEnd={() => setDragging(null)}
              class={`group relative overflow-hidden rounded-lg border bg-surface-sunken transition-all ${
                dragging === i ? "border-accent opacity-50" : "border-line"
              }`}
            >
              <img src={url} alt="" class="aspect-[4/3] w-full cursor-grab object-cover active:cursor-grabbing" />

              {i === 0 && (
                <span class="pointer-events-none absolute left-2 top-2 rounded bg-accent px-1.5 py-0.5 text-[0.625rem] font-semibold leading-none text-on-accent">
                  Cover
                </span>
              )}

              {/* Controls appear on hover, and are always present for a
                  keyboard: a photograph that can only be reordered by drag
                  cannot be reordered at all without a pointer. */}
              <div class="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent p-1.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                <span class="flex gap-0.5">
                  <IconButton label="Move earlier" disabled={i === 0} onClick={() => move(i, i - 1)}>
                    <path d="M10 12.5L5.5 8 10 3.5" />
                  </IconButton>
                  <IconButton label="Move later" disabled={i === urls.length - 1} onClick={() => move(i, i + 1)}>
                    <path d="M6 3.5L10.5 8 6 12.5" />
                  </IconButton>
                </span>
                <IconButton label="Remove" danger onClick={() => remove(url)}>
                  <path d="M4 4l8 8M12 4l-8 8" />
                </IconButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** A small square control drawn over a photograph. */
function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: ComponentChildren;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      class={`grid size-6 place-items-center rounded bg-black/45 text-white backdrop-blur-sm transition-colors disabled:opacity-30 ${
        danger ? "hover:bg-bad" : "hover:bg-black/70"
      }`}
    >
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"
           stroke-linecap="round" stroke-linejoin="round" class="size-3.5" aria-hidden="true">
        {children}
      </svg>
    </button>
  );
}
