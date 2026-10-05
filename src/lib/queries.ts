import { api, NotFoundError } from "@/lib/api";
import type { Auction, Property } from "@/lib/types";

export type AuctionWithProperty = Auction & { property: Property };

/**
 * The public reads, now served by the Go API.
 *
 * Each function is one request returning one document the page can render.
 * Before, every one of these fetched all non-draft auctions with their images,
 * institutions and view counts, then filtered in JavaScript — a listing page
 * paid for every row in the table, and the detail page did it to find a single
 * slug. Over a link from Vercel to a VPS in Hyderabad, that cost is no longer
 * something to ignore.
 *
 * The status a visitor sees is now decided in SQL. It used to be recomputed per
 * page, which let a list and its own filter disagree about whether a notice
 * whose deadline had passed was still open.
 */

/** Seconds a public response may be reused. Auctions change on human timescales. */
const PUBLIC_TTL = 30;

export type HomeSummary = {
  open_count: number;
  open_value: number;
  districts: { district: string; count: number }[];
  featured: AuctionWithProperty[];
};

export async function getHomeSummary(): Promise<HomeSummary> {
  return api<HomeSummary>("/v1/pages/home", {
    revalidate: PUBLIC_TTL,
    tags: ["auctions"],
  });
}

export type AuctionsPage = {
  items: AuctionWithProperty[];
  total: number;
  /** Every district with a listing, not only those matching the current filter. */
  districts: string[];
  /** Likewise every institution, so the picker does not shrink as you use it. */
  organizations: { slug: string; name: string; name_np: string }[];
  status_counts: Record<string, number>;
};

export type AuctionFilters = {
  status?: string;
  type?: string;
  district?: string;
  org?: string;
  q?: string;
  page?: number;
  size?: number;
};

/**
 * One request for the whole listing page: the cards, the total for paging, and
 * the values behind the filter controls.
 *
 * The facets come from the unfiltered set, so choosing a district does not
 * remove every other district from the control that chose it.
 */
export async function getAuctionsPage(
  filters: AuctionFilters = {}
): Promise<AuctionsPage> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  const suffix = query.toString();
  return api<AuctionsPage>(`/v1/pages/auctions${suffix ? `?${suffix}` : ""}`, {
    revalidate: PUBLIC_TTL,
    tags: ["auctions"],
  });
}

export async function getAuctionBySlug(
  slug: string
): Promise<AuctionWithProperty | null> {
  try {
    return await api<AuctionWithProperty>(
      `/v1/pages/listing/${encodeURIComponent(slug)}`,
      { revalidate: PUBLIC_TTL, tags: ["auctions", `listing:${slug}`] }
    );
  } catch (error) {
    // A slug nobody published is a 404 for the visitor, not a server error.
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}

/**
 * Count one visit, returning the new total.
 *
 * Null means no published listing carries this slug — a stale link rather than
 * a failure, so the caller renders the page without a count instead of an error.
 */
export async function recordPropertyView(slug: string): Promise<number | null> {
  try {
    const { view_count } = await api<{ view_count: number }>(
      `/v1/pages/listing/${encodeURIComponent(slug)}/view`,
      { method: "POST" }
    );
    return view_count;
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}
