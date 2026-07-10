import { notFound } from "next/navigation";
import { AuctionForm } from "@/components/admin/AuctionForm";
import { createClient } from "@/lib/supabase/server";
import type { Auction } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditAuctionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: auction }, { data: properties }] = await Promise.all([
    supabase.from("auctions").select("*").eq("id", id).single(),
    supabase.from("properties").select("id, title").order("title"),
  ]);
  if (!auction) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-evergreen-900">
        Edit auction
      </h1>
      <AuctionForm auction={auction as Auction} properties={properties ?? []} />
    </div>
  );
}
