import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { setAuctionStatus } from "@/lib/admin/actions";
import { getAdminAuctions } from "@/lib/admin/queries";
import { formatDateTime, nprCompact } from "@/lib/format";
import type { AuctionStatus } from "@/lib/types";
import { formatViews } from "@/lib/views";

export const dynamic = "force-dynamic";

const nextActions: Partial<Record<AuctionStatus, { to: AuctionStatus; label: string }[]>> = {
  draft: [{ to: "upcoming", label: "Publish as upcoming" }, { to: "open", label: "Open bidding" }],
  upcoming: [{ to: "open", label: "Open bidding" }, { to: "cancelled", label: "Cancel" }],
  open: [{ to: "closed", label: "Close bidding" }, { to: "cancelled", label: "Cancel" }],
  closed: [{ to: "sold", label: "Mark sold" }, { to: "open", label: "Re-open" }],
};

export default async function AdminAuctionsPage() {
  // Scoped by the API; the view counter rides along on the property, so every
  // round of a re-auctioned listing shows the same total.
  const auctions = await getAdminAuctions();

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-evergreen-900">
            Auctions
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Auction rounds, deadlines, and lifecycle.
          </p>
        </div>
        <Link
          href="/admin/auctions/new"
          className="shrink-0 self-start rounded-full bg-evergreen-800 px-5 py-2.5 text-sm font-semibold text-ivory transition-colors hover:bg-evergreen-700 sm:self-auto"
        >
          + New auction
        </Link>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-ink/8 bg-ivory shadow-card">
        <table className="w-full min-w-[740px] text-sm">
          <thead>
            <tr className="border-b border-ink/8 text-left text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft">
              <th className="px-6 py-4">Property / notice</th>
              <th className="px-4 py-4">Min. bid</th>
              <th className="px-4 py-4">Deadline</th>
              <th className="px-4 py-4">Status</th>
              <th className="px-4 py-4 text-right">Views</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/8">
            {auctions.map((a) => (
              <tr key={a.id} className="hover:bg-cream/50">
                <td className="px-6 py-3.5">
                  <p className="font-medium text-ink">{a.property?.title}</p>
                  <p className="text-xs text-ink-soft">
                    {a.notice_number} · Round {a.round}
                  </p>
                </td>
                <td className="px-4 py-3.5 font-medium text-evergreen-800">
                  {nprCompact(a.minimum_bid)}
                </td>
                <td className="px-4 py-3.5 text-ink-soft">
                  {formatDateTime(a.submission_deadline)}
                </td>
                <td className="px-4 py-3.5">
                  <StatusBadge status={a.status as AuctionStatus} />
                </td>
                <td
                  className="px-4 py-3.5 text-right tabular-nums text-ink-soft"
                  title="Views of this property's public listing"
                >
                  {formatViews(a.property?.view_count)}
                </td>
                <td className="px-6 py-3.5">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {(nextActions[a.status as AuctionStatus] ?? []).map((act) => (
                      <form key={act.to} action={setAuctionStatus}>
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="status" value={act.to} />
                        <SubmitButton className="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-evergreen-600 hover:text-evergreen-800">
                          {act.label}
                        </SubmitButton>
                      </form>
                    ))}
                    <Link
                      href={`/admin/auctions/${a.id}`}
                      className="rounded-full bg-evergreen-50 px-3 py-1.5 text-xs font-medium text-evergreen-800 hover:bg-evergreen-100"
                    >
                      Edit
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
