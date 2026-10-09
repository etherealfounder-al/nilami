"use client";

import { useRouter } from "next/navigation";
import { dictionaries, type Lang } from "@/lib/i18n/dictionaries";
import { listingHref, type ListingParams } from "@/lib/pagination";
import { Select } from "@/components/ui/Select";

/**
 * Rows-per-page control. Changing the size returns to page 1 — the old page
 * number would point somewhere else once the pages are re-cut.
 */
export function PageSizeSelect({
  basePath,
  params,
  size,
  sizes,
  lang = "en",
}: {
  basePath: string;
  params: ListingParams;
  size: number;
  sizes: readonly number[];
  lang?: Lang;
}) {
  const router = useRouter();
  const l = dictionaries[lang].listing;

  return (
    <div className="inline-flex items-center gap-2.5 rounded-full border border-ink/10 bg-white py-1.5 pl-4 pr-1.5 shadow-card">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
        {l.perPage}
      </span>
      <Select
        variant="pill"
        aria-label={l.perPage}
        value={String(size)}
        onValueChange={(next) =>
          router.push(
            listingHref(basePath, params, { size: next, page: undefined })
          )
        }
        options={sizes.map((n) => ({ value: String(n), label: String(n) }))}
      />
    </div>
  );
}
