import { upsertProperty } from "@/lib/admin/actions";
import type { Property } from "@/lib/types";

const inputCls =
  "h-11 w-full rounded-xl border border-ink/15 bg-white px-3.5 text-sm outline-none transition-colors focus:border-evergreen-600";
const labelCls =
  "text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft";

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block space-y-1.5 ${className}`}>
      <span className={labelCls}>{label}</span>
      {children}
    </label>
  );
}

export function PropertyForm({ property }: { property?: Property }) {
  const p = property;
  const imageUrls = (p?.images ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((i) => i.url)
    .join("\n");

  return (
    <form
      action={upsertProperty}
      className="space-y-8 rounded-2xl border border-ink/8 bg-ivory p-8 shadow-card"
    >
      {p && <input type="hidden" name="id" value={p.id} />}

      <section className="space-y-4">
        <h2 className="font-semibold text-evergreen-900">Identity</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" className="sm:col-span-2">
            <input name="title" required defaultValue={p?.title} className={inputCls} />
          </Field>
          <Field label="Slug (blank = auto)">
            <input name="slug" defaultValue={p?.slug} className={inputCls} />
          </Field>
          <Field label="Type">
            <select name="type" defaultValue={p?.type ?? "house"} className={inputCls}>
              <option value="land">Land</option>
              <option value="house">House</option>
              <option value="apartment">Apartment</option>
              <option value="commercial">Commercial</option>
            </select>
          </Field>
          <Field label="Loan reference">
            <input name="loan_ref" defaultValue={p?.loan_ref} className={inputCls} />
          </Field>
          <label className="flex items-center gap-3 self-end pb-2">
            <input
              type="checkbox"
              name="is_published"
              defaultChecked={p?.is_published ?? false}
              className="size-4 accent-evergreen-700"
            />
            <span className="text-sm font-medium text-ink">
              Published on the public site
            </span>
          </label>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold text-evergreen-900">Location</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Province">
            <input name="province" required defaultValue={p?.province} className={inputCls} />
          </Field>
          <Field label="District">
            <input name="district" required defaultValue={p?.district} className={inputCls} />
          </Field>
          <Field label="Municipality">
            <input name="municipality" required defaultValue={p?.municipality} className={inputCls} />
          </Field>
          <Field label="Ward">
            <input name="ward" type="number" defaultValue={p?.ward ?? ""} className={inputCls} />
          </Field>
          <Field label="Address / tole" className="sm:col-span-2">
            <input name="address" defaultValue={p?.address} className={inputCls} />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold text-evergreen-900">Specifications</h2>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Land area (aana)">
            <input name="land_area_aana" type="number" step="0.01" defaultValue={p?.land_area_aana ?? ""} className={inputCls} />
          </Field>
          <Field label="Land area (m²)">
            <input name="land_area_sqm" type="number" step="0.01" defaultValue={p?.land_area_sqm ?? ""} className={inputCls} />
          </Field>
          <Field label="Floors">
            <input name="building_floors" type="number" defaultValue={p?.building_floors ?? ""} className={inputCls} />
          </Field>
          <Field label="Built year">
            <input name="built_year" type="number" defaultValue={p?.built_year ?? ""} className={inputCls} />
          </Field>
          <Field label="Bedrooms">
            <input name="bedrooms" type="number" defaultValue={p?.bedrooms ?? ""} className={inputCls} />
          </Field>
          <Field label="Bathrooms">
            <input name="bathrooms" type="number" defaultValue={p?.bathrooms ?? ""} className={inputCls} />
          </Field>
          <Field label="Road access">
            <input name="road_access" defaultValue={p?.road_access ?? ""} className={inputCls} />
          </Field>
          <Field label="Facing">
            <input name="facing" defaultValue={p?.facing ?? ""} className={inputCls} />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold text-evergreen-900">Narrative & media</h2>
        <Field label="Description">
          <textarea
            name="description"
            rows={5}
            defaultValue={p?.description}
            className="w-full rounded-xl border border-ink/15 bg-white p-3.5 text-sm outline-none transition-colors focus:border-evergreen-600"
          />
        </Field>
        <Field label="Image URLs (one per line, first = cover)">
          <textarea
            name="image_urls"
            rows={4}
            defaultValue={imageUrls}
            placeholder="https://…"
            className="w-full rounded-xl border border-ink/15 bg-white p-3.5 font-mono text-xs outline-none transition-colors focus:border-evergreen-600"
          />
        </Field>
      </section>

      <div className="flex items-center gap-4 border-t border-ink/8 pt-6">
        <button className="rounded-full bg-evergreen-800 px-7 py-3 text-sm font-semibold text-ivory transition-colors hover:bg-evergreen-700">
          {p ? "Save changes" : "Create property"}
        </button>
        <a href="/admin/properties" className="text-sm font-medium text-ink-soft hover:text-ink">
          Cancel
        </a>
      </div>
    </form>
  );
}
