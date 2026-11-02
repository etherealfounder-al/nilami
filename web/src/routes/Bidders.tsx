import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../lib/api";
import { Select } from "../components/Select";
import { depositLabel, formatDate, npr } from "../lib/format";
import { Card, Empty, ErrorNote, Loading, PageHeader, Pill } from "../components/ui";

type Bidder = {
  id: string;
  auction_id: string;
  full_name: string;
  phone: string;
  email: string;
  citizenship_no: string;
  deposit_amount: number | null;
  deposit_proof_url: string | null;
  deposit_status: string;
  notes: string;
  created_at: string;
  auction?: { notice_number: string; property: { title: string } };
};

/**
 * Bidders and the state of their bid-security deposit.
 *
 * Who may bid is decided by the deposit clearing, which is a judgement a
 * person makes against a bank slip rather than something the system infers —
 * so the status is set by hand here.
 *
 * Officers also record bidders who walk into a branch with a voucher, and
 * remove ones entered against the wrong auction, which is why this both adds
 * and deletes.
 */
export function Bidders() {
  const queryClient = useQueryClient();
  const { data, isPending, error } = useQuery({
    queryKey: ["bidders"],
    queryFn: () => api<Bidder[]>("/v1/admin/bidders"),
  });

  const [adding, setAdding] = useState(false);

  const add = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api("/v1/admin/bidders", { method: "POST", body }),
    onSuccess: () => {
      setAdding(false);
      queryClient.invalidateQueries({ queryKey: ["bidders"] });
    },
  });

  /* For a row entered against the wrong auction, not for a bidder who
     withdrew — that is what a status is for. It asks first, because the
     deposit reference on the row may be the only record of the slip. */
  const remove = useMutation({
    mutationFn: (id: string) =>
      api(`/v1/admin/bidders/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bidders"] }),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api(`/v1/admin/bidders/${encodeURIComponent(id)}/status`, {
        method: "PATCH",
        body: { deposit_status: status },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bidders"] }),
  });

  return (
    <div class="space-y-8">
      <PageHeader
        title="Bidders"
        subtitle="Interested bidders and bid-security deposit verification."
        action={
          <button type="button" onClick={() => setAdding((v) => !v)} class="btn btn-ghost">
            {adding ? "Cancel" : "Record a bidder"}
          </button>
        }
      />

      {adding && <AddBidderForm onSubmit={(b) => add.mutate(b)} pending={add.isPending} />}
      {add.error && <ErrorNote message={add.error.message} />}
      {remove.error && <ErrorNote message={remove.error.message} />}

      {error && <ErrorNote message={error.message} />}
      {setStatus.error && <ErrorNote message={setStatus.error.message} />}

      <Card>
        {isPending || !data ? (
          <Loading />
        ) : data.length === 0 ? (
          <Empty>No bidders registered yet.</Empty>
        ) : (
          <table class="w-full min-w-[920px] text-sm">
            <thead>
              <tr class="border-b border-line-soft text-left text-xs font-semibold uppercase tracking-[0.12em] text-content-soft">
                <th class="px-6 py-4">Bidder</th>
                <th class="px-4 py-4">Auction</th>
                <th class="px-4 py-4 text-right">Deposit</th>
                <th class="px-4 py-4">Registered</th>
                <th class="px-6 py-4 text-right">Deposit status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-line-soft">
              {data.map((b) => (
                <tr key={b.id} class="hover:bg-surface-sunken/50">
                  <td class="px-6 py-3.5">
                    <span class="block font-medium text-content">{b.full_name}</span>
                    <span class="text-xs text-content-soft">
                      {b.phone}
                      {b.email ? ` · ${b.email}` : ""}
                    </span>
                  </td>
                  <td class="px-4 py-3.5">
                    <span class="block max-w-[20rem] truncate text-content">
                      {b.auction?.property?.title ?? "—"}
                    </span>
                    <span class="text-xs text-content-soft">
                      {b.auction?.notice_number ?? ""}
                    </span>
                  </td>
                  <td class="px-4 py-3.5 text-right tabular-nums">
                    {npr(b.deposit_amount)}
                    {b.deposit_proof_url && (
                      <a
                        href={b.deposit_proof_url}
                        target="_blank"
                        rel="noreferrer"
                        class="block text-xs text-accent underline"
                      >
                        proof
                      </a>
                    )}
                  </td>
                  <td class="px-4 py-3.5 text-content-soft">{formatDate(b.created_at)}</td>
                  <td class="px-6 py-3.5">
                    <div class="flex items-center justify-end gap-2">
                      <Pill label={depositLabel(b.deposit_status)} tone={b.deposit_status} />
                      <button
                        type="button"
                        disabled={remove.isPending}
                        onClick={() => {
                          if (confirm(`Remove ${b.full_name} from this auction? The deposit reference on this row goes with it.`))
                            remove.mutate(b.id);
                        }}
                        aria-label={`Remove ${b.full_name}`}
                        class="text-content-faint transition-colors hover:text-bad disabled:opacity-40"
                      >
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4" aria-hidden="true">
                          <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.2a1 1 0 0 0 1 .8h3.8a1 1 0 0 0 1-.8l.6-8.2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                      </button>
                      <Select
                          name={`deposit_status_${b.id}`}
                          value={b.deposit_status}
                          disabled={setStatus.isPending}
                          onChange={(v) => setStatus.mutate({ id: b.id, status: v })}
                          class="w-36"
                          options={[
                            { value: "pending", label: "Pending" },
                            { value: "verified", label: "Verified" },
                            { value: "rejected", label: "Rejected" },
                            { value: "refunded", label: "Refunded" },
                          ]}
                        />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

type Auction = { id: string; notice_number: string; property?: { title: string } };

/**
 * Recording a bidder who came to a branch.
 *
 * Only a name and the auction are required: an officer with a counter queue
 * has a voucher in hand and not always an email address, and a row that
 * cannot be saved without one gets written on paper instead.
 */
function AddBidderForm({
  onSubmit,
  pending,
}: {
  onSubmit: (body: Record<string, unknown>) => void;
  pending: boolean;
}) {
  const auctions = useQuery({
    queryKey: ["auctions", "for-bidder"],
    queryFn: () => api<Auction[]>("/v1/admin/auctions"),
  });
  const [auctionId, setAuctionId] = useState("");

  return (
    <form
      class="card space-y-5 p-6"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget as HTMLFormElement);
        const str = (k: string) => String(f.get(k) ?? "").trim();
        const deposit = str("deposit_amount");
        onSubmit({
          auction_id: auctionId,
          full_name: str("full_name"),
          phone: str("phone"),
          email: str("email"),
          citizenship_no: str("citizenship_no"),
          deposit_amount: deposit === "" ? null : Number(deposit),
          notes: str("notes"),
        });
      }}
    >
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="sm:col-span-2">
          <span class="label">Auction</span>
          <Select
            name="auction_id"
            value={auctionId}
            onChange={setAuctionId}
            placeholder="Choose an auction"
            class="mt-1.5"
            options={(auctions.data ?? []).map((a) => ({
              value: a.id,
              label: a.property?.title ?? a.notice_number,
              hint: a.notice_number,
            }))}
          />
        </div>
        <label class="block">
          <span class="label">Full name</span>
          <input name="full_name" required class="field mt-1.5" />
        </label>
        <label class="block">
          <span class="label">Phone</span>
          <input name="phone" class="field mt-1.5" />
        </label>
        <label class="block">
          <span class="label">Email</span>
          <input name="email" type="email" class="field mt-1.5" />
        </label>
        <label class="block">
          <span class="label">Citizenship no.</span>
          <input name="citizenship_no" class="field mt-1.5" />
        </label>
        <label class="block">
          <span class="label">Deposit amount</span>
          <input name="deposit_amount" type="number" step="any" class="field mt-1.5" />
        </label>
        <label class="block">
          <span class="label">Notes</span>
          <input name="notes" class="field mt-1.5" />
        </label>
      </div>
      <button type="submit" disabled={pending || !auctionId} class="btn btn-primary">
        {pending ? "Saving…" : "Record bidder"}
      </button>
    </form>
  );
}
