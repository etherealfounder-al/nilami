const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** Full NPR figure with lakh/crore digit grouping, e.g. "Rs 5,25,00,000" */
export function npr(amount: number): string {
  return `Rs ${inr.format(amount)}`;
}

/** Compact NPR, e.g. "5.25 Cr" / "48 Lakh" */
export function nprCompact(amount: number): string {
  if (amount >= 1_00_00_000) {
    const cr = amount / 1_00_00_000;
    return `${cr % 1 === 0 ? cr : cr.toFixed(2)} Cr`;
  }
  if (amount >= 1_00_000) {
    const lakh = amount / 1_00_000;
    return `${lakh % 1 === 0 ? lakh : lakh.toFixed(1)} Lakh`;
  }
  return inr.format(amount);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kathmandu",
  });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kathmandu",
  });
}

export function typeLabel(t: string): string {
  const map: Record<string, string> = {
    land: "Land",
    house: "House",
    apartment: "Apartment",
    commercial: "Commercial",
  };
  return map[t] ?? t;
}

export function statusLabel(s: string): string {
  const map: Record<string, string> = {
    draft: "Draft",
    upcoming: "Upcoming",
    open: "Open for Bids",
    closed: "Bidding Closed",
    sold: "Sold",
    cancelled: "Cancelled",
  };
  return map[s] ?? s;
}

export function areaLabel(aana: number | null, sqm: number | null): string {
  const parts: string[] = [];
  if (aana != null) parts.push(`${aana} Aana`);
  if (sqm != null) parts.push(`${inr.format(Math.round(sqm))} m²`);
  return parts.join(" · ") || "—";
}
