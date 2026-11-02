import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
 * The status is the only thing editable here: who may bid is decided by the
 * deposit clearing, and that is a judgement a person makes against a bank
 * slip, not something the system can infer.
 */
export function Bidders() {
  const queryClient = useQueryClient();
  const { data, isPending, error } = useQuery({
    queryKey: ["bidders"],
    queryFn: () => api<Bidder[]>("/v1/admin/bidders"),
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
      />

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
