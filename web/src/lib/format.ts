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

/** Tailwind classes for a status pill, so one status looks alike everywhere. */
export function statusTone(status: string): string {
  switch (status) {
    case "open":
      return "bg-evergreen-100 text-evergreen-900";
    case "upcoming":
      return "bg-brass-100 text-brass-600";
    case "sold":
      return "bg-evergreen-50 text-evergreen-700";
    case "cancelled":
    case "rejected":
      return "bg-danger-soft text-danger";
    case "verified":
      return "bg-evergreen-100 text-evergreen-900";
    default:
      return "bg-cream text-ink-soft";
  }
}
