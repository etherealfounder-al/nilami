"use client";

import { ImageUploader } from "@/components/admin/ImageUploader";
import { LandAreaField } from "@/components/admin/LandAreaField";
import { LocationSelects } from "@/components/admin/LocationSelects";
import { RoadAccessFields } from "@/components/admin/RoadAccessFields";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { upsertProperty } from "@/lib/admin/actions";
import type { Property } from "@/lib/types";
import { Select } from "@/components/ui/Select";

const inputCls =
  "h-11 w-full rounded-xl border border-ink/15 bg-white px-3.5 text-sm outline-none transition-colors focus:border-evergreen-600";
const labelCls =
  "text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft";

const FACINGS = [
  "North",
  "North-East",
  "East",
  "South-East",
  "South",
  "South-West",
  "West",
  "North-West",
];

function Field({
  label,
  children,
  className = "",
  // Select fields wrap in a div: a <label> would bind to the hidden native
  // element behind our trigger rather than the trigger itself.
  as: Tag = "label",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  as?: "label" | "div";
}) {
  return (
    <Tag className={`block space-y-1.5 ${className}`}>
      <span className={labelCls}>{label}</span>
      {children}
    </Tag>
  );
}

export function PropertyForm({
  property,
  organizations,
  lockedOrg,
}: {
  property?: Property;
  organizations: { id: string; name: string }[];
  lockedOrg?: { id: string; name: string } | null;
}) {
  const p = property;
  const initialUrls = (p?.images ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((i) => i.url);

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
          <Field label="Type" as="div">
            <Select
              name="type"
              aria-label="Type"
              defaultValue={p?.type ?? "house"}
              options={[
                { value: "land", label: "Land" },
                { value: "house", label: "House" },
                { value: "apartment", label: "Apartment" },
                { value: "commercial", label: "Commercial" },
              ]}
            />
          </Field>
          {lockedOrg ? (
            <div className="block space-y-1.5">
              <span className={labelCls}>Institution</span>
              <p className="flex h-11 items-center rounded-xl border border-ink/10 bg-cream px-3.5 text-sm text-ink">
                {lockedOrg.name}
              </p>
              <input type="hidden" name="organization_id" value={lockedOrg.id} />
            </div>
          ) : (
            <Field label="Institution" as="div">
              <Select
                name="organization_id"
                required
                aria-label="Institution"
                defaultValue={p?.organization_id ?? ""}
                placeholder="Select institution…"
                options={organizations.map((o) => ({
                  value: o.id,
                  label: o.name,
                }))}
              />
            </Field>
          )}
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
        <div className="grid items-end gap-4 sm:grid-cols-3">
          <LocationSelects
            province={p?.province}
            district={p?.district}
            municipality={p?.municipality}
            latitude={p?.latitude}
            longitude={p?.longitude}
            labelCls={labelCls}
          />
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
          <LandAreaField
            value={p?.land_area_aana}
            inputCls={inputCls}
            labelCls={labelCls}
          />
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
          <RoadAccessFields
            value={p?.road_access}
            inputCls={inputCls}
            labelCls={labelCls}
          />
          <Field label="Facing" as="div">
            <Select
              name="facing"
              aria-label="Facing"
              defaultValue={p?.facing ?? ""}
              options={[
                { value: "", label: "Not specified" },
                ...FACINGS.map((f) => ({ value: f, label: f })),
                ...(p?.facing && !FACINGS.includes(p.facing)
                  ? [{ value: p.facing, label: `${p.facing} — not in list` }]
                  : []),
              ]}
            />
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
        <Field label="Video (YouTube, Vimeo or a direct .mp4 link)">
          <input
            name="video_url"
            type="url"
            defaultValue={p?.video_url ?? ""}
            placeholder="https://www.youtube.com/watch?v=…"
            className={inputCls}
          />
        </Field>
        <div className="space-y-1.5">
          <span className={labelCls}>Photographs</span>
          <ImageUploader initialUrls={initialUrls} />
        </div>
      </section>

      <div className="flex items-center gap-4 border-t border-ink/8 pt-6">
        <SubmitButton
          pendingLabel={p ? "Saving…" : "Creating…"}
          className="rounded-full bg-evergreen-800 px-7 py-3 text-sm font-semibold text-ivory transition-colors hover:bg-evergreen-700"
        >
          {p ? "Save changes" : "Create property"}
        </SubmitButton>
        <a href="/admin/properties" className="text-sm font-medium text-ink-soft hover:text-ink">
          Cancel
        </a>
      </div>
    </form>
  );
}
