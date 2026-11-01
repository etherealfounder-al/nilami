import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { api } from "../lib/api";
import { formatCount, typeLabel } from "../lib/format";
import { Card, Empty, ErrorNote, Loading, PageHeader, Pill } from "../components/ui";

type PropertyRow = {
  id: string;
  slug: string;
  title: string;
  type: string;
  district: string;
  municipality: string;
  is_published: boolean;
  organization_name: string;
  cover_url: string | null;
  image_count: number;
  auction_count: number;
  view_count: number;
};

export function Properties() {
  const { data, isPending, error } = useQuery({
    queryKey: ["properties"],
    // Scoped by the API from the session; there is no filter to forget here.
    queryFn: () => api<PropertyRow[]>("/v1/admin/properties"),
  });

  return (
    <div class="space-y-8">
      <PageHeader
        title="Properties"
        subtitle="Collateral properties in the recovery portfolio."
        action={
          <Link
            to="/properties/new"
            className="shrink-0 self-start rounded-full bg-evergreen-800 px-5 py-2.5 text-sm font-semibold text-ivory transition-colors hover:bg-evergreen-700 sm:self-auto"
          >
            + New property
          </Link>
        }
      />

      {error ? (
        <ErrorNote message={error.message} />
      ) : (
        <Card>
          {isPending ? (
            <Loading />
          ) : data.length === 0 ? (
            <Empty>No properties yet.</Empty>
          ) : (
            <table class="w-full min-w-[780px] text-sm">
              <thead>
                <tr class="border-b border-ink/8 text-left text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft">
                  <th class="px-6 py-4">Property</th>
                  <th class="px-4 py-4">Institution</th>
                  <th class="px-4 py-4">Type</th>
                  <th class="px-4 py-4">District</th>
                  <th class="px-4 py-4">Status</th>
                  <th class="px-4 py-4 text-right">Views</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-ink/8">
                {data.map((p) => (
                  <tr key={p.id} class="hover:bg-cream/50">
                    <td class="px-6 py-3.5">
                      <div class="flex items-center gap-3">
                        <div class="size-11 shrink-0 overflow-hidden rounded-lg bg-parchment">
                          {p.cover_url && (
                            <img
                              src={p.cover_url}
                              alt=""
                              width={44}
                              height={44}
                              loading="lazy"
                              class="size-full object-cover"
                            />
                          )}
                        </div>
                        <div class="min-w-0">
                          <Link
                            to={`/properties/${p.id}`}
                            className="block truncate font-medium text-ink hover:text-evergreen-700"
                          >
                            {p.title}
                          </Link>
                          <span class="text-xs text-ink-soft">
                            {p.image_count} photo{p.image_count === 1 ? "" : "s"} ·{" "}
                            {p.auction_count} auction{p.auction_count === 1 ? "" : "s"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td class="px-4 py-3.5 text-ink-soft">{p.organization_name}</td>
                    <td class="px-4 py-3.5">{typeLabel(p.type)}</td>
                    <td class="px-4 py-3.5 text-ink-soft">{p.district}</td>
                    <td class="px-4 py-3.5">
                      <Pill
                        label={p.is_published ? "Published" : "Draft"}
                        tone={p.is_published ? "open" : "draft"}
                      />
                    </td>
                    <td class="px-4 py-3.5 text-right tabular-nums text-ink-soft">
                      {formatCount(p.view_count)}
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
