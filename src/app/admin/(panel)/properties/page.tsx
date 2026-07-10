import Image from "next/image";
import Link from "next/link";
import { deleteProperty } from "@/lib/admin/actions";
import { typeLabel } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Property } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminPropertiesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("properties")
    .select("*, images:property_images(url, sort_order), organization:organizations(name)")
    .order("created_at", { ascending: false });
  const properties = (data ?? []) as Property[];

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-evergreen-900">
            Properties
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Collateral properties in the recovery portfolio.
          </p>
        </div>
        <Link
          href="/admin/properties/new"
          className="rounded-full bg-evergreen-800 px-5 py-2.5 text-sm font-semibold text-ivory transition-colors hover:bg-evergreen-700"
        >
          + New property
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-ink/8 bg-ivory shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink/8 text-left text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft">
              <th className="px-6 py-4">Property</th>
              <th className="px-4 py-4">Institution</th>
              <th className="px-4 py-4">Type</th>
              <th className="px-4 py-4">District</th>
              <th className="px-4 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/8">
            {properties.map((p) => {
              const cover = p.images?.sort(
                (a, b) => a.sort_order - b.sort_order
              )[0];
              return (
                <tr key={p.id} className="hover:bg-cream/50">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-parchment">
                        {cover && (
                          <Image
                            src={cover.url}
                            alt=""
                            fill
                            sizes="44px"
                            className="object-cover"
                          />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">
                          {p.title}
                        </p>
                        <p className="truncate text-xs text-ink-soft">
                          {p.loan_ref}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-ink-soft">
                    {p.organization?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3.5 text-ink-soft">
                    {typeLabel(p.type)}
                  </td>
                  <td className="px-4 py-3.5 text-ink-soft">{p.district}</td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] ${
                        p.is_published
                          ? "bg-evergreen-100 text-evergreen-700"
                          : "bg-ink/8 text-ink-soft"
                      }`}
                    >
                      {p.is_published ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="px-6 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/auctions/${p.slug}`}
                        className="rounded-full px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-evergreen-50 hover:text-evergreen-800"
                      >
                        View
                      </Link>
                      <Link
                        href={`/admin/properties/${p.id}`}
                        className="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink hover:border-evergreen-600 hover:text-evergreen-800"
                      >
                        Edit
                      </Link>
                      <form action={deleteProperty}>
                        <input type="hidden" name="id" value={p.id} />
                        <button className="rounded-full px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-danger-soft hover:text-danger">
                          Delete
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
