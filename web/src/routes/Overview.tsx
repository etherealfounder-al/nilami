import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { statusLabel } from "../lib/format";
import { PageHeader, Pill } from "../components/ui";

type Dashboard = {
  properties: number;
  published: number;
  auctions: number;
  open: number;
  closing_soon: number;
  bidders: number;
  pending_deposits: number;
  recent: {
    id: string;
    title: string;
    status: string;
    submission_deadline: string | null;
  }[];
};

export function Overview() {
  const { data, isPending, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api<Dashboard>("/v1/admin/dashboard"),
  });

  if (isPending) return <p class="py-12 text-center text-sm text-ink-faint">Loading…</p>;
  if (error) {
    return (
      <p class="border-l-2 border-vermilion bg-vermilion-soft px-4 py-3 text-sm text-vermilion">
        {error.message}
      </p>
    );
  }

  const tiles = [
    { label: "Properties", value: data.properties, note: `${data.published} published` },
    { label: "Auctions", value: data.auctions, note: `${data.open} open` },
    { label: "Closing soon", value: data.closing_soon, note: "within 7 days" },
    { label: "Bidders", value: data.bidders, note: `${data.pending_deposits} deposits pending` },
  ];

  return (
    <div class="space-y-12">
      <PageHeader title="Overview" subtitle="The department's record at a glance." />

      {/* The standing figures, ruled like the summary block of an account
          rather than boxed as cards. */}
      <dl class="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} class="border-t-2 border-ink pt-3">
            <dt class="standing">{t.label}</dt>
            <dd class="figure mt-1.5 text-[2.5rem] leading-none text-ink">{t.value}</dd>
            <dd class="mt-1.5 text-xs text-ink-faint">{t.note}</dd>
          </div>
        ))}
      </dl>

      <section>
        <h2 class="font-display border-b-2 border-ink pb-2 text-2xl text-ink">
          Recent auctions
        </h2>
        {data.recent.length === 0 ? (
          <p class="py-12 text-center text-sm text-ink-faint">Nothing here yet.</p>
        ) : (
          <ul>
            {data.recent.map((a) => (
              <li
                key={a.id}
                class="flex items-center justify-between gap-4 border-b border-rule-faint py-3.5"
              >
                <span class="truncate text-ink">{a.title}</span>
                <Pill label={statusLabel(a.status)} tone={a.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
