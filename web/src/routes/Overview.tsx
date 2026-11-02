import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { api } from "../lib/api";
import { formatCount, npr, statusLabel } from "../lib/format";
import { PageHeader, Pill } from "../components/ui";

type Dashboard = {
  properties: number;
  published: number;
  auctions: number;
  open: number;
  closing_soon: number;
  bidders: number;
  pending_deposits: number;
  at_stake: number;
  by_status: Record<string, number>;
  calendar: {
    id: string;
    title: string;
    district: string;
    status: string;
    submission_deadline: string;
    minimum_bid: number;
  }[];
  recent: {
    id: string;
    title: string;
    status: string;
    notice_number: string;
    submission_deadline: string | null;
  }[];
};

const DAY = 86_400_000;
/** How far ahead the calendar looks. Beyond this nothing is actionable yet. */
const HORIZON = 60;

const daysOut = (iso: string) =>
  Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / DAY));

/** The order a recovery moves through, which is the order the bar is stacked. */
const PIPELINE = ["draft", "upcoming", "open", "closed", "sold", "cancelled"];

const BAR_TONE: Record<string, string> = {
  draft: "bg-content-faint/40",
  upcoming: "bg-warn",
  open: "bg-accent",
  closed: "bg-content-faint",
  sold: "bg-content",
  cancelled: "bg-bad",
};

export function Overview() {
  const { data, isPending, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api<Dashboard>("/v1/admin/dashboard"),
  });

  if (isPending)
    return <p class="py-16 text-center text-sm text-content-faint">Loading…</p>;
  if (error) {
    return (
      <p class="rounded-lg border border-bad/30 bg-bad-wash px-4 py-3 text-sm text-bad">
        {error.message}
      </p>
    );
  }

  const queue = [
    { n: data.pending_deposits, one: "deposit to verify", many: "deposits to verify", to: "/bidders", bad: true },
    { n: data.closing_soon, one: "auction closes this week", many: "auctions close this week", to: "/auctions", bad: true },
    { n: data.properties - data.published, one: "property unpublished", many: "properties unpublished", to: "/properties", bad: false },
  ].filter((q) => q.n > 0);

  const total = PIPELINE.reduce((sum, k) => sum + (data.by_status[k] ?? 0), 0);
  const upcoming = (data.calendar ?? []).filter((a) => daysOut(a.submission_deadline) <= HORIZON);

  return (
    <div class="space-y-10">
      <PageHeader title="Overview" subtitle="Where every live auction stands today." />

      {/*
        The calendar.

        This desk runs on deadlines — a bid closes, a bid opens, and missing
        either costs a round. A list of dates makes you read and compare; an
        axis lets you see the crowding. Each marker sits at its true distance
        from today, so two auctions closing in the same week visibly collide
        and one closing alone in six weeks visibly does not.

        Drawn with grid positioning rather than a charting library: this is
        one axis and a dozen dots, and a library for it would cost more than
        the whole admin bundle.
      */}
      <section class="card overflow-hidden">
        <div class="flex flex-wrap items-end justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div>
            <h2 class="title text-lg">Next {HORIZON} days</h2>
            <p class="mt-0.5 text-sm text-content-soft">
              {upcoming.length === 0
                ? "No submission deadlines ahead."
                : `${formatCount(upcoming.length)} ${upcoming.length === 1 ? "deadline" : "deadlines"} ahead`}
            </p>
          </div>
          <p class="text-right">
            <span class="eyebrow block">At stake</span>
            <span class="figure text-xl text-content">{npr(data.at_stake)}</span>
          </p>
        </div>

        {upcoming.length === 0 ? (
          <p class="px-6 py-12 text-center text-sm text-content-faint">
            Nothing is scheduled. New auctions appear here as soon as they open.
          </p>
        ) : (
          <div class="px-5 pb-6 pt-8 sm:px-6">
            <div class="relative">
              {/* The axis, with today anchored at the left edge. */}
              <div class="absolute inset-x-0 top-0 h-px bg-line" />
              <div class="absolute left-0 top-0 h-2.5 w-px bg-content" />
              <span class="absolute left-0 top-4 text-[0.6875rem] font-semibold text-content">
                Today
              </span>
              {[15, 30, 45, 60].map((d) => (
                <div key={d} class="absolute top-0" style={`left:${(d / HORIZON) * 100}%`}>
                  <div class="h-1.5 w-px bg-line" />
                  <span class="absolute -translate-x-1/2 pt-2 text-[0.6875rem] text-content-faint">
                    {d}d
                  </span>
                </div>
              ))}

              {/* One row per auction, so labels never overlap even when the
                  dates nearly do. */}
              <ul class="relative space-y-1.5 pt-12">
                {upcoming.map((a) => {
                  const d = daysOut(a.submission_deadline);
                  const pct = Math.min(97, (d / HORIZON) * 100);
                  const soon = d <= 7;
                  return (
                    <li key={a.id} class="relative h-8">
                      <div
                        class="absolute top-1/2 h-px -translate-y-1/2 bg-line-soft"
                        style={`left:0;width:${pct}%`}
                      />
                      <Link
                        to={`/auctions/${a.id}`}
                        className="group absolute top-1/2 flex -translate-y-1/2 items-center gap-2.5"
                        style={`left:${pct}%`}
                      >
                        <span
                          class={`size-2.5 shrink-0 rounded-full ring-4 transition-transform group-hover:scale-125 ${
                            soon ? "bg-bad ring-bad-wash" : a.status === "open" ? "bg-accent ring-accent-wash" : "bg-warn ring-warn-wash"
                          }`}
                        />
                        <span class="whitespace-nowrap">
                          <span class="text-sm text-content transition-colors group-hover:text-accent">
                            {a.title}
                          </span>
                          <span class="ml-2 text-xs text-content-faint">
                            {d}d · {a.district}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </section>

      <div class="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        {/* The pipeline: every auction this institution holds, by state. */}
        <section class="card p-5 sm:p-6">
          <h2 class="title text-lg">Pipeline</h2>
          <p class="mt-0.5 text-sm text-content-soft">
            {formatCount(data.auctions)} {data.auctions === 1 ? "auction" : "auctions"} across{" "}
            {formatCount(data.properties)} {data.properties === 1 ? "property" : "properties"}
          </p>

          {total > 0 && (
            <>
              <div class="mt-5 flex h-2.5 overflow-hidden rounded-full bg-surface-sunken">
                {PIPELINE.map((k) => {
                  const n = data.by_status[k] ?? 0;
                  if (!n) return null;
                  return (
                    <span
                      key={k}
                      class={BAR_TONE[k]}
                      style={`width:${(n / total) * 100}%`}
                      title={`${statusLabel(k)}: ${n}`}
                    />
                  );
                })}
              </div>
              <ul class="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                {PIPELINE.filter((k) => data.by_status[k]).map((k) => (
                  <li key={k} class="flex items-center gap-2 text-sm">
                    <span class={`size-2 shrink-0 rounded-full ${BAR_TONE[k]}`} />
                    <span class="text-content-soft">{statusLabel(k)}</span>
                    <span class="figure ml-auto text-content">{data.by_status[k]}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {/* What is stuck, and the one tap that unsticks it. */}
        <section class="card p-5 sm:p-6">
          <h2 class="title text-lg">Needs you</h2>
          {queue.length === 0 ? (
            <p class="mt-4 rounded-lg bg-accent-wash px-4 py-3 text-sm text-accent">
              Nothing is waiting. Every deposit is verified and no deadline falls
              inside the week.
            </p>
          ) : (
            <ul class="mt-4 space-y-1">
              {queue.map((q) => (
                <li key={q.to}>
                  <Link
                    to={q.to}
                    className="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-surface-sunken"
                  >
                    <span
                      class={`figure grid size-9 shrink-0 place-items-center rounded-lg text-sm ${
                        q.bad ? "bg-bad-wash text-bad" : "bg-warn-wash text-warn"
                      }`}
                    >
                      {q.n}
                    </span>
                    <span class="text-sm text-content">{q.n === 1 ? q.one : q.many}</span>
                    <span
                      aria-hidden="true"
                      class="ml-auto text-content-faint transition-transform duration-200 group-hover:translate-x-0.5"
                    >
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section class="card overflow-hidden">
        <div class="flex items-center justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <h2 class="title text-lg">Recently updated</h2>
          <Link to="/auctions" className="text-sm text-accent hover:underline">
            All auctions
          </Link>
        </div>
        {data.recent.length === 0 ? (
          <p class="px-6 py-12 text-center text-sm text-content-faint">Nothing here yet.</p>
        ) : (
          <ul class="divide-y divide-line-soft">
            {data.recent.map((a) => (
              <li key={a.id}>
                <Link
                  to={`/auctions/${a.id}`}
                  className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-surface-sunken sm:px-6"
                >
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm text-content transition-colors group-hover:text-accent">
                      {a.title}
                    </span>
                    <span class="mt-0.5 block text-xs text-content-faint">{a.notice_number}</span>
                  </span>
                  <Pill label={statusLabel(a.status)} tone={a.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
