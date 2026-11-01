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

  return (
    <div class="space-y-3">
      <div class="flex flex-wrap items-center gap-3">
        <label class="cursor-pointer rounded-full border border-rule-strong bg-white px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:border-seal-600">
          {busy ? "Uploading…" : "Add photographs"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={busy}
            class="hidden"
            onChange={(e) => {
              const input = e.currentTarget as HTMLInputElement;
              void upload(input.files);
              // Cleared so choosing the same file twice fires again.
              input.value = "";
            }}
          />
        </label>
        <span class="text-xs text-ink-soft">JPEG, PNG or WebP. The first is the cover.</span>
      </div>

      {error && (
        <p class="rounded-xl bg-vermilion-soft px-4 py-3 text-sm text-vermilion">{error}</p>
      )}

      {urls.length > 0 && (
        <ul class="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {urls.map((url, i) => (
            <li key={url} class="group relative overflow-hidden rounded-xl border border-ink/10 bg-linen">
              <img src={url} alt="" class="aspect-[4/3] w-full object-cover" />
              {i === 0 && (
                <span class="absolute left-1.5 top-1.5 rounded-full bg-seal-800 px-2 py-0.5 text-[10px] font-semibold uppercase text-oat">
                  Cover
                </span>
              )}
              <div class="absolute inset-x-0 bottom-0 flex justify-between bg-ink/60 p-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button type="button" onClick={() => move(i, i - 1)} aria-label="Move earlier"
                        class="px-1.5 text-xs text-oat disabled:opacity-40" disabled={i === 0}>←</button>
                <button type="button" onClick={() => onChange(urls.filter((u) => u !== url))}
                        aria-label="Remove" class="px-1.5 text-xs text-oat">✕</button>
                <button type="button" onClick={() => move(i, i + 1)} aria-label="Move later"
                        class="px-1.5 text-xs text-oat disabled:opacity-40" disabled={i === urls.length - 1}>→</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
