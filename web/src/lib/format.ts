/**
 * Formatting for the panel.
 *
 * English only, deliberately: the staff panel is not translated, so these
 * carry their own label maps rather than depending on the public site's
 * dictionaries. That keeps this app free of the one piece of shared state
 * that cannot be shared — the dictionaries hold functions, not just strings.
 */

const TYPES: Record<string, string> = {
  land: "Land",
  house: "House",
  apartment: "Apartment",
  commercial: "Commercial",
};

const STATUSES: Record<string, string> = {
  draft: "Draft",
  upcoming: "Upcoming",
  open: "Open for Bids",
  closed: "Bidding Closed",
  sold: "Sold",
  cancelled: "Cancelled",
};

const DEPOSITS: Record<string, string> = {
  pending: "Pending",
  verified: "Verified",
  rejected: "Rejected",
  refunded: "Refunded",
};

export const typeLabel = (t: string) => TYPES[t] ?? t;
export const statusLabel = (s: string) => STATUSES[s] ?? s;
export const depositLabel = (s: string) => DEPOSITS[s] ?? s;

/** Indian grouping, which is what Nepali readers expect for these sums. */
export const formatCount = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("en-IN");

export function npr(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return `Rs ${amount.toLocaleString("en-IN")}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * The colour of a status stamp, so one status looks alike everywhere.
 *
 * A single colour rather than a foreground/background pair: the stamp draws
 * its own rule in currentColor, matching the public pages, where the same
 * states are printed on the same paper.
 */
export function statusTone(status: string): string {
  switch (status) {
    case "open":
    case "verified":
    case "published":
      return "text-seal-700";
    case "upcoming":
    case "pending":
      return "text-brass-700";
    case "sold":
      return "text-ink";
    case "cancelled":
    case "rejected":
      return "text-vermilion";
    default:
      return "text-ink-faint";
  }
}
