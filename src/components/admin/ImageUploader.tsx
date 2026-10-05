"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { uploadImage } from "@/lib/admin/upload";

const MAX_MB = 10;

export function ImageUploader({ initialUrls }: { initialUrls: string[] }) {
  const [urls, setUrls] = useState<string[]>(initialUrls);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [manualUrl, setManualUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  async function uploadFiles(files: FileList | File[]) {
    setError(null);
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) {
      setError("Only image files are supported.");
      return;
    }
    for (const file of list) {
      if (file.size > MAX_MB * 1024 * 1024) {
        setError(`"${file.name}" is larger than ${MAX_MB} MB — skipped.`);
        continue;
      }
      setUploading((n) => n + 1);
      try {
        const url = await uploadImage(file, "property");
        setUrls((u) => [...u, url]);
      } catch (e) {
        setError(
          e instanceof Error
            ? `Upload failed: ${e.message}`
            : "Upload failed — are you signed in?"
        );
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  function move(i: number, dir: -1 | 1) {
    setUrls((u) => {
      const next = [...u];
      const j = i + dir;
      if (j < 0 || j >= next.length) return u;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {/* The value the server action reads */}
      <input type="hidden" name="image_urls" value={urls.join("\n")} />

      {/* Drop zone */}
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
          uploadFiles(e.dataTransfer.files);
        }}
        className={`flex w-full flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
          dragOver
            ? "border-evergreen-600 bg-evergreen-50"
            : "border-ink/15 bg-white hover:border-evergreen-600/50 hover:bg-evergreen-50/50"
        }`}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-evergreen-700">
          <path
            d="M12 16V4m0 0 4 4m-4-4L8 8M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="text-sm font-medium text-evergreen-900">
          {uploading > 0
            ? `Uploading ${uploading} photo${uploading > 1 ? "s" : ""}…`
            : "Drop photos here or click to browse"}
        </span>
        <span className="text-xs text-ink-soft">
          JPG, PNG or WebP · up to {MAX_MB} MB each · first photo is the cover
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) uploadFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {error && (
        <p className="rounded-xl bg-danger-soft px-4 py-2.5 text-sm text-danger">
          {error}
        </p>
      )}

      {/* Previews */}
      {urls.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {urls.map((url, i) => (
            <li
              key={`${url}-${i}`}
              className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-ink/10 bg-parchment"
            >
              <Image
                src={url}
                alt={`Photo ${i + 1}`}
                fill
                sizes="200px"
                className="object-cover"
              />
              {i === 0 && (
                <span className="absolute left-1.5 top-1.5 rounded-full bg-brass-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-evergreen-950">
                  Cover
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 flex justify-between bg-gradient-to-t from-ink/70 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                <span className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label="Move earlier"
                    className="grid size-6 place-items-center rounded-full bg-ivory/90 text-xs text-ink disabled:opacity-40"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === urls.length - 1}
                    aria-label="Move later"
                    className="grid size-6 place-items-center rounded-full bg-ivory/90 text-xs text-ink disabled:opacity-40"
                  >
                    →
                  </button>
                </span>
                <button
                  type="button"
                  onClick={() => setUrls((u) => u.filter((_, j) => j !== i))}
                  aria-label="Remove photo"
                  className="grid size-6 place-items-center rounded-full bg-danger text-xs text-ivory"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Add by URL fallback */}
      <div className="flex gap-2">
        <input
          type="url"
          value={manualUrl}
          onChange={(e) => setManualUrl(e.target.value)}
          placeholder="…or paste an image URL"
          className="h-10 flex-1 rounded-xl border border-ink/15 bg-white px-3.5 text-xs outline-none transition-colors focus:border-evergreen-600"
        />
        <button
          type="button"
          onClick={() => {
            if (manualUrl.trim()) {
              setUrls((u) => [...u, manualUrl.trim()]);
              setManualUrl("");
            }
          }}
          className="h-10 rounded-xl border border-evergreen-800/25 px-4 text-xs font-semibold text-evergreen-800 transition-colors hover:bg-evergreen-800 hover:text-ivory"
        >
          Add URL
        </button>
      </div>
    </div>
  );
}
