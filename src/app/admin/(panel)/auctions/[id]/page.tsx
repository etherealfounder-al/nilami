import { notFound } from "next/navigation";
import { AuctionForm } from "@/components/admin/AuctionForm";
import { getAdminAuction, getAdminProperties } from "@/lib/admin/queries";
import { NotFoundError } from "@/lib/api";
import type { Auction } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditAuctionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [auction, properties] = await Promise.all([
    getAdminAuction(id).catch((e) => {
      if (e instanceof NotFoundError) return null;
      throw e;
    }),
    getAdminProperties(),
  ]);
  if (!auction) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-evergreen-900">
        Edit auction
      </h1>
      <AuctionForm
        auction={auction as Auction}
        properties={properties
          .map((p) => ({ id: p.id, title: p.title }))
          .sort((a, b) => a.title.localeCompare(b.title))}
      />
    </div>
  );
}
