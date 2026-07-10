import { dictionaries, type Lang } from "@/lib/i18n/dictionaries";

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** Full NPR figure with lakh/crore digit grouping, e.g. "Rs 5,25,00,000" / "रु 5,25,00,000" */
export function npr(amount: number, lang: Lang = "en"): string {
  return `${dictionaries[lang].common.rs} ${inr.format(amount)}`;
}

/** Compact NPR, e.g. "5.25 Cr" / "5.25 करोड" */
export function nprCompact(amount: number, lang: Lang = "en"): string {
  const d = dictionaries[lang].common;
  if (amount >= 1_00_00_000) {
    const cr = amount / 1_00_00_000;
    return `${cr % 1 === 0 ? cr : cr.toFixed(2)} ${d.crore}`;
  }
  if (amount >= 1_00_000) {
    const lakh = amount / 1_00_000;
    return `${lakh % 1 === 0 ? lakh : lakh.toFixed(1)} ${d.lakh}`;
  }
  return inr.format(amount);
}

function dateLocale(lang: Lang): string {
  return lang === "ne" ? "ne-NP" : "en-GB";
}

export function formatDate(iso: string | null | undefined, lang: Lang = "en"): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(dateLocale(lang), {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kathmandu",
  });
}

export function formatDateTime(iso: string | null | undefined, lang: Lang = "en"): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(dateLocale(lang), {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kathmandu",
  });
}

export function typeLabel(t: string, lang: Lang = "en"): string {
  const map = dictionaries[lang].common.types as Record<string, string>;
  return map[t] ?? t;
}

export function statusLabel(s: string, lang: Lang = "en"): string {
  const map = dictionaries[lang].common.statuses as Record<string, string>;
  return map[s] ?? s;
}

export function areaLabel(
  aana: number | null,
  sqm: number | null,
  lang: Lang = "en"
): string {
  const parts: string[] = [];
  if (aana != null) parts.push(`${aana} ${dictionaries[lang].common.aana}`);
  if (sqm != null) parts.push(`${inr.format(Math.round(sqm))} m²`);
  return parts.join(" · ") || "—";
}
