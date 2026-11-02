import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { api } from "../lib/api";
import { formatDateTime, npr, statusLabel } from "../lib/format";
import { Card, Empty, ErrorNote, Loading, PageHeader, Pill, PrimaryLink } from "../components/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Where a notice can go from where it is.
 *
 * A notice moves through fixed states and an officer should not have to open
 * the editor and pick the right word from a list to advance one. Offering only
 * the legal next steps also means the wrong jump — reopening something sold —
 * is not on screen to be clicked by accident.
 *
 * The stored status drives this, not the display status: the API shows a
 * notice past its deadline as closed, but it has not been closed, and what can
 * be done to it depends on the record rather than on the clock.
 */
const NEXT_STEPS: Record<string, { to: string; label: string }[]> = {
  draft: [
    { to: "upcoming", label: "Publish as upcoming" },
    { to: "open", label: "Open bidding" },
  ],
  upcoming: [
    { to: "open", label: "Open bidding" },
    { to: "cancelled", label: "Cancel" },
  ],
  open: [
    { to: "closed", label: "Close bidding" },
    { to: "cancelled", label: "Cancel" },
  ],
  closed: [{ to: "sold", label: "Mark sold" }],
};

type AuctionRow = {
  id: string;
  notice_number: string;
  round: number;
  status: string;
  /** Corrected for a deadline that has already passed; the API decides this. */
  display_status: string;
  submission_deadline: string;
  opening_datetime: string;
  minimum_bid: number;
  winning_amount: number | null;
  property: {
    id: string;
    slug: string;
    title: string;
    district: string;
  };
};

export function Auctions() {
  const queryClient = useQueryClient();
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api(`/v1/admin/auctions/${encodeURIComponent(id)}/status`, { method: "PATCH", body: { status } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["auctions"] }),
  });

  const { data, isPending, error } = useQuery({
    queryKey: ["auctions"],
    queryFn: () => api<AuctionRow[]>("/v1/admin/auctions"),
  });

  return (
    <div class="space-y-8">
      <PageHeader
        title="Auctions"
        subtitle="Notices published against the portfolio."
        action={
          <PrimaryLink to="/auctions/new">+ New auction</PrimaryLink>
        }
      />

      {error ? (
        <ErrorNote message={error.message} />
      ) : (
        <Card>
          {isPending ? (
            <Loading />
          ) : data.length === 0 ? (
            <Empty>No auctions yet.</Empty>
          ) : (
            <table class="w-full min-w-[860px] text-sm">
              <thead>
                <tr class="border-b border-line-soft text-left text-xs font-semibold uppercase tracking-[0.12em] text-content-soft">
                  <th class="px-6 py-4">Notice</th>
                  <th class="px-4 py-4">Property</th>
                  <th class="px-4 py-4">Status</th>
                  <th class="px-4 py-4">Deadline</th>
                  <th class="px-4 py-4 text-right">Minimum bid</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-line-soft">
                {data.map((a) => (
                  <tr key={a.id} class="hover:bg-surface-sunken/50">
                    <td class="px-6 py-3.5">
                      <Link
                        to={`/auctions/${a.id}`}
                        className="font-medium text-content hover:text-accent"
                      >
                        {a.notice_number}
                      </Link>
                      <span class="block text-xs text-content-soft">Round {a.round}</span>
                    </td>
                    <td class="px-4 py-3.5">
                      <span class="block max-w-[22rem] truncate">{a.property.title}</span>
                      <span class="text-xs text-content-soft">{a.property.district}</span>
                    </td>
                    <td class="px-4 py-3.5">
                      {/* display_status, not status: the API corrects a notice
                          whose deadline has passed but whose row still says open. */}
                      <div class="flex flex-wrap items-center gap-2">
                        <Pill label={statusLabel(a.display_status)} tone={a.display_status} />
                        {(NEXT_STEPS[a.status] ?? []).map((step) => (
                          <button
                            key={step.to}
                            type="button"
                            disabled={setStatus.isPending}
                            onClick={() => setStatus.mutate({ id: a.id, status: step.to })}
                            class="rounded-full border border-line px-2.5 py-1 text-xs text-content-soft transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
                          >
                            {step.label}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td class="px-4 py-3.5 text-content-soft">
                      {formatDateTime(a.submission_deadline)}
                    </td>
                    <td class="px-4 py-3.5 text-right tabular-nums">
                      {npr(a.winning_amount ?? a.minimum_bid)}
                      {a.winning_amount != null && (
                        <span class="block text-xs text-accent">winning bid</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </div>
  );
}
