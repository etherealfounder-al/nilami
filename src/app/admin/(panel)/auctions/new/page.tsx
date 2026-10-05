import { AuctionForm } from "@/components/admin/AuctionForm";
import { getAdminProperties } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";

export default async function NewAuctionPage() {
  const properties = await getAdminProperties();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-evergreen-900">
        New auction
      </h1>
      <AuctionForm
        properties={properties
          .map((p) => ({ id: p.id, title: p.title }))
          .sort((a, b) => a.title.localeCompare(b.title))}
      />
    </div>
  );
}
