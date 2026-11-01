import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { api } from "../lib/api";
import { formatDateTime, npr, statusLabel } from "../lib/format";
import { Card, Empty, ErrorNote, Loading, PageHeader, Pill, PrimaryLink } from "../components/ui";

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
                <tr class="border-b border-rule-faint text-left text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft">
                  <th class="px-6 py-4">Notice</th>
                  <th class="px-4 py-4">Property</th>
                  <th class="px-4 py-4">Status</th>
                  <th class="px-4 py-4">Deadline</th>
                  <th class="px-4 py-4 text-right">Minimum bid</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-rule-faint">
                {data.map((a) => (
                  <tr key={a.id} class="hover:bg-linen/50">
                    <td class="px-6 py-3.5">
                      <Link
                        to={`/auctions/${a.id}`}
                        className="font-medium text-ink hover:text-seal-700"
                      >
                        {a.notice_number}
                      </Link>
                      <span class="block text-xs text-ink-soft">Round {a.round}</span>
                    </td>
                    <td class="px-4 py-3.5">
                      <span class="block max-w-[22rem] truncate">{a.property.title}</span>
                      <span class="text-xs text-ink-soft">{a.property.district}</span>
                    </td>
                    <td class="px-4 py-3.5">
                      {/* display_status, not status: the API corrects a notice
                          whose deadline has passed but whose row still says open. */}
                      <Pill label={statusLabel(a.display_status)} tone={a.display_status} />
                    </td>
                    <td class="px-4 py-3.5 text-ink-soft">
                      {formatDateTime(a.submission_deadline)}
                    </td>
                    <td class="px-4 py-3.5 text-right tabular-nums">
                      {npr(a.winning_amount ?? a.minimum_bid)}
                      {a.winning_amount != null && (
                        <span class="block text-xs text-seal-700">winning bid</span>
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
