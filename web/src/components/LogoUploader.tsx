import { useState } from "react";
import { api } from "../lib/api";

type Presigned = { upload_url: string; public_url: string };

/**
 * The institution's logo.
 *
 * One image rather than a gallery, so this replaces instead of appending, and
 * it previews on both grounds — a mark drawn for white paper can disappear on
 * the dark theme, and the person uploading it should see that before a bidder
 * does.
 *
 * The bytes go straight from the browser to object storage: the API signs a
 * URL and the browser PUTs to it, so a logo never occupies a request slot on
 * the server. The signature covers the content type, so the PUT must send
 * exactly what was signed for.
 */
export function LogoUploader({
  url,
  onChange,
}: {
  url: string | null;
  onChange: (next: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("That file is not an image.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const signed = await api<Presigned>("/v1/admin/uploads", {
        method: "POST",
        body: { kind: "organization", content_type: file.type },
      });
      const put = await fetch(signed.upload_url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) throw new Error(`storage refused the upload (${put.status})`);
      onChange(signed.public_url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="space-y-3">
      <div class="flex flex-wrap items-center gap-4">
        {/* Two swatches, so a mark that only works on one ground is obvious
            here rather than on the public site. */}
        <div class="flex gap-2">
          <span class="grid size-16 place-items-center overflow-hidden rounded-lg border border-line bg-white">
            {url ? (
              <img src={url} alt="" class="size-full object-contain p-1.5" />
            ) : (
              <span class="text-[0.625rem] text-content-faint">None</span>
            )}
          </span>
          <span class="grid size-16 place-items-center overflow-hidden rounded-lg border border-line bg-deep">
            {url && <img src={url} alt="" class="size-full object-contain p-1.5" />}
          </span>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <label class="btn btn-quiet cursor-pointer">
            <input
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              class="sr-only"
              disabled={busy}
              onChange={(e) => {
                upload((e.target as HTMLInputElement).files);
                (e.target as HTMLInputElement).value = "";
              }}
            />
            {busy ? "Uploading…" : url ? "Replace" : "Upload a logo"}
          </label>
          {url && (
            <button
              type="button"
              onClick={() => onChange(null)}
              class="text-sm text-content-soft transition-colors hover:text-bad"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      <p class="text-xs text-content-faint">
        A square mark reads best. PNG or SVG with a transparent background works
        on both the light and dark site.
      </p>

      {error && (
        <p class="rounded-lg border border-bad/30 bg-bad-wash px-3 py-2 text-sm text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
