"use client";

import { useRef, useState } from "react";
import { uploadImage } from "@/lib/admin/upload";

const MAX_MB = 2;
const TYPES = ["image/png", "image/jpeg", "image/webp"];

/**
 * One logo per institution, stored in the same public bucket as property
 * photographs under an `organizations/` prefix. The URL rides along in a hidden
 * field, so the surrounding form posts it like any other value.
 */
export function LogoUploader({
  initialUrl,
  name,
}: {
  initialUrl: string | null;
  name: string;
}) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(files: FileList | File[]) {
    setError(null);
    const file = Array.from(files)[0];
    if (!file) return;
    if (!TYPES.includes(file.type)) {
      setError("Use a PNG, JPG, WebP or SVG file.");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`That file is larger than ${MAX_MB} MB.`);
      return;
    }

    setBusy(true);
    try {
      setUrl(await uploadImage(file, "organization"));
    } catch (e) {
      setError(
        e instanceof Error
          ? `Upload failed: ${e.message}`
          : "Upload failed — are you still signed in?"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name="logo_url" value={url} />

      <div className="flex items-start gap-4">
        <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-ink/10 bg-white">
          {url ? (
            // Any host may be pasted in, and next/image only permits the two
            // configured ones, so the preview is a plain img.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={name} className="size-full object-contain p-1.5" />
          ) : (
            <span className="text-[11px] text-ink-soft">No logo</span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              upload(e.dataTransfer.files);
            }}
            className={`w-full rounded-xl border-2 border-dashed px-4 py-4 text-center text-sm transition-colors ${
              dragOver
                ? "border-evergreen-600 bg-evergreen-50"
                : "border-ink/15 bg-white hover:border-evergreen-600/50 hover:bg-evergreen-50/50"
            }`}
          >
            {busy ? "Uploading…" : "Drop a logo here or click to browse"}
            <span className="mt-0.5 block text-xs text-ink-soft">
              PNG, JPG, WebP or SVG · up to {MAX_MB} MB · a square mark reads best
            </span>
          </button>

          <div className="flex gap-2">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="…or paste a logo URL"
              className="h-9 w-full rounded-lg border border-ink/15 bg-white px-3 text-xs outline-none focus:border-evergreen-600"
            />
            {url && (
              <button
                type="button"
                onClick={() => setUrl("")}
                className="shrink-0 rounded-lg px-3 text-xs font-medium text-ink-soft hover:text-danger"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={TYPES.join(",")}
        hidden
        onChange={(e) => e.target.files && upload(e.target.files)}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
