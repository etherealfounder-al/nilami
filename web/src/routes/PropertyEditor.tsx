import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { api, ApiError } from "../lib/api";
import { Actions, Field, FormCard, Section, inputCls, labelCls, readForm } from "../components/form";
import { ImageUploader } from "../components/ImageUploader";
import { ErrorNote, Loading, PageHeader } from "../components/ui";

type PropertyDetail = {
  id: string;
  slug: string;
  title: string;
  type: string;
  province: string;
  district: string;
  municipality: string;
  ward: number | null;
  address: string;
  land_area_aana: number | null;
  land_area_sqm: number | null;
  building_floors: number | null;
  built_year: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  road_access: string | null;
  facing: string | null;
  description: string;
  latitude: number | null;
  longitude: number | null;
  video_url: string | null;
  is_published: boolean;
  organization_id: string;
  images: { url: string; sort_order: number }[];
};

const TYPES = ["land", "house", "apartment", "commercial"];
const FACINGS = ["North", "North-East", "East", "South-East", "South", "South-West", "West", "North-West"];

export function PropertyEditor({ mode }: { mode: "new" | "edit" }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [images, setImages] = useState<string[] | null>(null);

  const existing = useQuery({
    queryKey: ["property", id],
    queryFn: () => api<PropertyDetail>(`/v1/admin/properties/${encodeURIComponent(id!)}`),
    enabled: mode === "edit" && !!id,
  });

  // Which institutions this account may file under. A platform administrator
  // sees several; everyone else sees their own, and the API ignores the field
  // either way unless the caller is entitled to choose.
  const orgs = useQuery({
    queryKey: ["institutions"],
    queryFn: () => api<{ id: string; name: string }[]>("/v1/admin/institutions"),
  });

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      mode === "edit"
        ? api(`/v1/admin/properties/${encodeURIComponent(id!)}`, { method: "PUT", body })
        : api("/v1/admin/properties", { method: "POST", body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      queryClient.invalidateQueries({ queryKey: ["property", id] });
      navigate("/properties");
    },
  });

  if (mode === "edit" && existing.isPending) return <Loading />;
  if (mode === "edit" && existing.error) return <ErrorNote message={existing.error.message} />;

  const p = existing.data;
  const photos = images ?? (p?.images ?? []).slice().sort((a, b) => a.sort_order - b.sort_order).map((i) => i.url);

  function onSubmit(e: Event) {
    e.preventDefault();
    const f = readForm(e.currentTarget as HTMLFormElement);
    save.mutate({
      organization_id: f.strOrNull("organization_id"),
      title: f.str("title"),
      slug: f.str("slug"),
      type: f.str("type"),
      province: f.str("province"),
      district: f.str("district"),
      municipality: f.str("municipality"),
      ward: f.int("ward"),
      address: f.str("address"),
      land_area_aana: f.num("land_area_aana"),
      land_area_sqm: f.num("land_area_sqm"),
      building_floors: f.int("building_floors"),
      built_year: f.int("built_year"),
      bedrooms: f.int("bedrooms"),
      bathrooms: f.int("bathrooms"),
      road_access: f.strOrNull("road_access"),
      facing: f.strOrNull("facing"),
      description: f.str("description"),
      latitude: f.num("latitude"),
      longitude: f.num("longitude"),
      video_url: f.strOrNull("video_url"),
      is_published: f.bool("is_published"),
      image_urls: photos,
    });
  }

  return (
    <div class="space-y-8">
      <PageHeader title={mode === "edit" ? "Edit property" : "New property"} />
      {save.error && (
        <ErrorNote
          message={
            save.error instanceof ApiError
              ? save.error.message
              : "The property could not be saved."
          }
        />
      )}

      <FormCard onSubmit={onSubmit}>
        <Section title="Identity">
          <div class="grid gap-4 sm:grid-cols-2">
            <Field label="Title" className="sm:col-span-2">
              <input name="title" required value={p?.title} class={inputCls} />
            </Field>
            <Field label="Slug" hint="Leave blank to build one from the title.">
              <input name="slug" value={p?.slug} class={inputCls} />
            </Field>
            <Field label="Type">
              <select name="type" class={`${inputCls} cursor-pointer`}>
                {TYPES.map((t) => (
                  <option key={t} value={t} selected={(p?.type ?? "house") === t}>
                    {t[0].toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Institution">
              <select name="organization_id" class={`${inputCls} cursor-pointer`}>
                {(orgs.data ?? []).map((o) => (
                  <option key={o.id} value={o.id} selected={p?.organization_id === o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </Field>
            <label class="flex items-center gap-3 self-end pb-2 sm:col-span-2">
              <input type="checkbox" name="is_published" checked={p?.is_published ?? false}
                     class="size-4 accent-seal-700" />
              <span class="text-sm font-medium text-ink">Published on the public site</span>
            </label>
          </div>
        </Section>

        <Section title="Location">
          <div class="grid gap-4 sm:grid-cols-3">
            <Field label="Province"><input name="province" required value={p?.province} class={inputCls} /></Field>
            <Field label="District"><input name="district" required value={p?.district} class={inputCls} /></Field>
            <Field label="Municipality"><input name="municipality" value={p?.municipality} class={inputCls} /></Field>
            <Field label="Ward"><input name="ward" type="number" value={p?.ward ?? ""} class={inputCls} /></Field>
            <Field label="Address / tole" className="sm:col-span-2">
              <input name="address" value={p?.address} class={inputCls} />
            </Field>
            <Field label="Latitude" hint="Decimal degrees, e.g. 27.6878">
              <input name="latitude" type="number" step="any" value={p?.latitude ?? ""} class={inputCls} />
            </Field>
            <Field label="Longitude" hint="Decimal degrees, e.g. 85.3159">
              <input name="longitude" type="number" step="any" value={p?.longitude ?? ""} class={inputCls} />
            </Field>
          </div>
        </Section>

        <Section title="Specifications">
          <div class="grid gap-4 sm:grid-cols-4">
            <Field label="Land area (aana)"><input name="land_area_aana" type="number" step="0.01" value={p?.land_area_aana ?? ""} class={inputCls} /></Field>
            <Field label="Land area (m²)"><input name="land_area_sqm" type="number" step="0.01" value={p?.land_area_sqm ?? ""} class={inputCls} /></Field>
            <Field label="Floors"><input name="building_floors" type="number" value={p?.building_floors ?? ""} class={inputCls} /></Field>
            <Field label="Built year"><input name="built_year" type="number" value={p?.built_year ?? ""} class={inputCls} /></Field>
            <Field label="Bedrooms"><input name="bedrooms" type="number" value={p?.bedrooms ?? ""} class={inputCls} /></Field>
            <Field label="Bathrooms"><input name="bathrooms" type="number" value={p?.bathrooms ?? ""} class={inputCls} /></Field>
            <Field label="Road access"><input name="road_access" value={p?.road_access ?? ""} class={inputCls} /></Field>
            <Field label="Facing">
              <select name="facing" class={`${inputCls} cursor-pointer`}>
                <option value="" selected={!p?.facing}>Not specified</option>
                {FACINGS.map((f) => (
                  <option key={f} value={f} selected={p?.facing === f}>{f}</option>
                ))}
              </select>
            </Field>
          </div>
        </Section>

        <Section title="Narrative and media">
          <Field label="Description">
            <textarea name="description" rows={5} value={p?.description}
                      class="w-full rounded-xl border border-rule-strong bg-white p-3.5 text-sm outline-none transition-colors focus:border-seal-600" />
          </Field>
          <Field label="Video (YouTube, Vimeo or a direct .mp4 link)">
            <input name="video_url" type="url" value={p?.video_url ?? ""} placeholder="https://" class={inputCls} />
          </Field>
          <div class="space-y-1.5">
            <span class={labelCls}>Photographs</span>
            <ImageUploader urls={photos} onChange={setImages} />
          </div>
        </Section>

        <Actions busy={save.isPending} label={mode === "edit" ? "Save changes" : "Create property"}
                 pendingLabel={mode === "edit" ? "Saving…" : "Creating…"} cancelTo="/admin/properties" />
      </FormCard>
    </div>
  );
}
