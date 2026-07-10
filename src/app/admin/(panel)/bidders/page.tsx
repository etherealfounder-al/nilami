import { addBidder, deleteBidder, setBidderStatus } from "@/lib/admin/actions";
import { npr } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Auction, BidderRecord, Property } from "@/lib/types";

export const dynamic = "force-dynamic";

const inputCls =
  "h-11 w-full rounded-xl border border-ink/15 bg-white px-3.5 text-sm outline-none transition-colors focus:border-evergreen-600";

const statusStyles: Record<string, string> = {
  verified: "bg-evergreen-100 text-evergreen-700",
  pending: "bg-brass-100 text-brass-600",
  rejected: "bg-danger-soft text-danger",
  refunded: "bg-ink/8 text-ink-soft",
};

export default async function AdminBiddersPage() {
  const supabase = await createClient();
  const [{ data: bidders }, { data: auctions }] = await Promise.all([
    supabase
      .from("bidder_records")
      .select("*, auction:auctions(notice_number, property:properties(title))")
      .order("created_at", { ascending: false }),
    supabase
      .from("auctions")
      .select("id, notice_number, status, property:properties(title)")
      .in("status", ["upcoming", "open", "closed"])
      .order("submission_deadline"),
  ]);

  const rows = (bidders ?? []) as (BidderRecord & {
    auction: { notice_number: string; property: { title: string } };
  })[];
  const activeAuctions = (auctions ?? []) as unknown as (Pick<
    Auction,
    "id" | "notice_number" | "status"
  > & { property: Pick<Property, "title"> })[];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-evergreen-900">
          Bidder records
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Interested bidders and bid-security deposit verification.
        </p>
      </div>

      {/* Add record */}
      <form
        action={addBidder}
        className="grid gap-4 rounded-2xl border border-ink/8 bg-ivory p-6 shadow-card sm:grid-cols-2 lg:grid-cols-4"
      >
        <label className="block space-y-1.5 sm:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft">
            Auction
          </span>
          <select name="auction_id" required className={inputCls}>
            <option value="">Select auction…</option>
            {activeAuctions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.property?.title} — {a.notice_number} ({a.status})
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft">
            Full name
          </span>
          <input name="full_name" required className={inputCls} />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft">
            Phone
          </span>
          <input name="phone" className={inputCls} />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft">
            Email
          </span>
          <input name="email" type="email" className={inputCls} />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft">
            Citizenship / reg. no.
          </span>
          <input name="citizenship_no" className={inputCls} />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft">
            Deposit amount (NPR)
          </span>
          <input name="deposit_amount" type="number" className={inputCls} />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft">
            Notes
          </span>
          <input name="notes" className={inputCls} />
        </label>
        <div className="flex items-end">
          <button className="h-11 w-full rounded-xl bg-evergreen-800 text-sm font-semibold text-ivory transition-colors hover:bg-evergreen-700">
            Add record
          </button>
        </div>
      </form>

      {/* Records table */}
      <div className="overflow-hidden rounded-2xl border border-ink/8 bg-ivory shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink/8 text-left text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft">
              <th className="px-6 py-4">Bidder</th>
              <th className="px-4 py-4">Auction</th>
              <th className="px-4 py-4">Deposit</th>
              <th className="px-4 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/8">
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-ink-soft">
                  No bidder records yet.
                </td>
              </tr>
            )}
            {rows.map((b) => (
              <tr key={b.id} className="hover:bg-cream/50">
                <td className="px-6 py-3.5">
                  <p className="font-medium text-ink">{b.full_name}</p>
                  <p className="text-xs text-ink-soft">
                    {[b.phone, b.email].filter(Boolean).join(" · ")}
                  </p>
                </td>
                <td className="px-4 py-3.5">
                  <p className="text-ink">{b.auction?.property?.title}</p>
                  <p className="text-xs text-ink-soft">
                    {b.auction?.notice_number}
                  </p>
                </td>
                <td className="px-4 py-3.5 text-ink-soft">
                  {b.deposit_amount ? npr(b.deposit_amount) : "—"}
                  {b.notes && (
                    <p className="max-w-52 truncate text-xs text-ink-soft/70">
                      {b.notes}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3.5">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] ${statusStyles[b.deposit_status]}`}
                  >
                    {b.deposit_status}
                  </span>
                </td>
                <td className="px-6 py-3.5">
                  <div className="flex items-center justify-end gap-2">
                    {(["verified", "rejected", "refunded"] as const)
                      .filter((s) => s !== b.deposit_status)
                      .map((s) => (
                        <form key={s} action={setBidderStatus}>
                          <input type="hidden" name="id" value={b.id} />
                          <input type="hidden" name="deposit_status" value={s} />
                          <button className="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium capitalize text-ink transition-colors hover:border-evergreen-600 hover:text-evergreen-800">
                            {s}
                          </button>
                        </form>
                      ))}
                    <form action={deleteBidder}>
                      <input type="hidden" name="id" value={b.id} />
                      <button className="rounded-full px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-danger-soft hover:text-danger">
                        Delete
                      </button>
                    </form>
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
