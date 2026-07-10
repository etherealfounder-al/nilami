import { createClient } from "@/lib/supabase/server";
import type { Auction, Property } from "@/lib/types";

export type AuctionWithProperty = Auction & { property: Property };

const AUCTION_SELECT =
  "*, property:properties(*, images:property_images(*))";

function sortImages(a: AuctionWithProperty) {
  a.property.images?.sort((x, y) => x.sort_order - y.sort_order);
  return a;
}

export async function getPublicAuctions(filters?: {
  status?: string;
  type?: string;
  district?: string;
  q?: string;
}): Promise<AuctionWithProperty[]> {
  const supabase = await createClient();
  let query = supabase
    .from("auctions")
    .select(AUCTION_SELECT)
    .neq("status", "draft")
    .order("submission_deadline", { ascending: true });

  if (filters?.status) query = query.eq("status", filters.status);

  const { data, error } = await query;
  if (error) throw error;

  let rows = (data as unknown as AuctionWithProperty[]).filter(
    (a) => a.property
  );
  if (filters?.type) rows = rows.filter((a) => a.property.type === filters.type);
  if (filters?.district)
    rows = rows.filter(
      (a) => a.property.district.toLowerCase() === filters.district!.toLowerCase()
    );
  if (filters?.q) {
    const q = filters.q.toLowerCase();
    rows = rows.filter(
      (a) =>
        a.property.title.toLowerCase().includes(q) ||
        a.property.district.toLowerCase().includes(q) ||
        a.property.municipality.toLowerCase().includes(q)
    );
  }
  return rows.map(sortImages);
}

export async function getAuctionBySlug(
  slug: string
): Promise<AuctionWithProperty | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("auctions")
    .select(AUCTION_SELECT)
    .neq("status", "draft")
    .order("round", { ascending: false });
  if (error) throw error;
  const rows = (data as unknown as AuctionWithProperty[]).filter(
    (a) => a.property?.slug === slug
  );
  return rows.length ? sortImages(rows[0]) : null;
}

export async function getDistricts(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("properties")
    .select("district")
    .eq("is_published", true);
  return [...new Set((data ?? []).map((r) => r.district))].sort();
}
