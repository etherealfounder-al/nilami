import { AuctionForm } from "@/components/admin/AuctionForm";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewAuctionPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("properties")
    .select("id, title")
    .order("title");

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-evergreen-900">
        New auction
      </h1>
      <AuctionForm properties={data ?? []} />
    </div>
  );
}
