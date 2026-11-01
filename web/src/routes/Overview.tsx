import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

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

  if (isPending) return <p class="text-sm text-ink-soft">Loading…</p>;
  if (error) {
    return (
      <p class="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
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
    <div class="space-y-8">
      <h1 class="font-display text-2xl font-semibold text-evergreen-900">Overview</h1>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <div
            key={t.label}
            class="rounded-2xl border border-ink/8 bg-ivory p-5 shadow-card"
          >
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft">
              {t.label}
            </p>
            <p class="mt-2 font-display text-3xl font-semibold tabular-nums text-evergreen-900">
              {t.value}
            </p>
            <p class="mt-1 text-xs text-ink-soft">{t.note}</p>
          </div>
        ))}
      </div>

      <section class="space-y-3">
        <h2 class="font-semibold text-evergreen-900">Recent auctions</h2>
        {data.recent.length === 0 ? (
          <p class="rounded-2xl border border-ink/8 bg-ivory p-6 text-sm text-ink-soft shadow-card">
            Nothing here yet.
          </p>
        ) : (
          <ul class="divide-y divide-ink/8 overflow-hidden rounded-2xl border border-ink/8 bg-ivory shadow-card">
            {data.recent.map((a) => (
              <li key={a.id} class="flex items-center justify-between gap-4 px-5 py-4">
                <span class="truncate text-sm font-medium text-ink">{a.title}</span>
                <span class="shrink-0 text-xs uppercase tracking-[0.1em] text-ink-soft">
                  {a.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
