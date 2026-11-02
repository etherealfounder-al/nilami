import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { api, ApiError } from "../lib/api";
import { Actions, Field, FormCard, Section, inputCls, labelCls, readForm } from "../components/form";
import { ImageUploader } from "../components/ImageUploader";
import { LandAreaField } from "../components/LandAreaField";
import { Select } from "../components/Select";
import { parseLandArea } from "../lib/nepal/land-area";
import { LocationSelects } from "../components/LocationSelects";
import { MapPicker } from "../components/MapPicker";
import { RoadAccessFields } from "../components/RoadAccessFields";
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
  // The selects are controlled now, so their values live here. null means
  // "not touched", which is how the loaded record and a deliberate change
  // stay distinguishable — the same pattern the logo uploader uses.
  const [type_, setTypeState] = useState<string | null>(null);
  const [orgId, setOrgIdState] = useState<string | null>(null);
  const [facing, setFacingState] = useState<string | null>(null);

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

  /* Removing a property an officer should not have created — a duplicate, or
     one entered against the wrong institution. Offered only on an existing
     record, and it asks first. The server refuses while an auction still
     references the property, so the usual answer to "it would not delete" is
     that a notice is still attached to it. */
  const remove = useMutation({
    mutationFn: () =>
      api(`/v1/admin/properties/${encodeURIComponent(id!)}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      navigate("/properties");
    },
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
      // The land-area field accepts "1-0-0-0" as well as "8.5", so it is
      // parsed here rather than read as a plain number — f.num would turn the
      // ropani form into nothing and save a null over a real area.
      land_area_aana: parseLandArea(f.str("land_area_aana")),
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
      {remove.error && <ErrorNote message={remove.error.message} />}
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
              <Select
                  name="type"
                  value={type_ ?? p?.type ?? "house"}
                  onChange={setTypeState}
                  class="mt-1.5"
                  options={TYPES.map((t) => ({ value: t, label: t[0].toUpperCase() + t.slice(1) }))}
                />
            </Field>
            <Field label="Institution">
              <Select
                  name="organization_id"
                  value={orgId ?? p?.organization_id ?? ""}
                  onChange={setOrgIdState}
                  placeholder="Choose an institution"
                  class="mt-1.5"
                  options={(orgs.data ?? []).map((o) => ({ value: o.id, label: o.name }))}
                />
            </Field>
            <label class="flex items-center gap-3 self-end pb-2 sm:col-span-2">
              <input type="checkbox" name="is_published" checked={p?.is_published ?? false}
                     class="size-4 accent-gilt-deep" />
              <span class="text-sm font-medium text-content">Published on the public site</span>
            </label>
          </div>
        </Section>

        <Section title="Location">
          <div class="grid gap-4 sm:grid-cols-3">
            <LocationSelects
              province={p?.province}
              district={p?.district}
              municipality={p?.municipality}
              ward={p?.ward}
            />
            <Field label="Address / tole" className="sm:col-span-2">
              <input name="address" value={p?.address} class={inputCls} />
            </Field>
            <MapPicker latitude={p?.latitude} longitude={p?.longitude} />
          </div>
        </Section>

        <Section title="Specifications">
          <div class="grid gap-4 sm:grid-cols-4">
            <LandAreaField value={p?.land_area_aana} />
            <Field label="Land area (m²)"><input name="land_area_sqm" type="number" step="0.01" value={p?.land_area_sqm ?? ""} class={inputCls} /></Field>
            <Field label="Floors"><input name="building_floors" type="number" value={p?.building_floors ?? ""} class={inputCls} /></Field>
            <Field label="Built year"><input name="built_year" type="number" value={p?.built_year ?? ""} class={inputCls} /></Field>
            <Field label="Bedrooms"><input name="bedrooms" type="number" value={p?.bedrooms ?? ""} class={inputCls} /></Field>
            <Field label="Bathrooms"><input name="bathrooms" type="number" value={p?.bathrooms ?? ""} class={inputCls} /></Field>
            <RoadAccessFields value={p?.road_access} />
            <Field label="Facing">
              <Select
                  name="facing"
                  value={facing ?? p?.facing ?? ""}
                  onChange={setFacingState}
                  placeholder="Not specified"
                  class="mt-1.5"
                  options={FACINGS.map((f) => ({ value: f, label: f }))}
                />
            </Field>
          </div>
        </Section>

        <Section title="Narrative and media">
          <Field label="Description">
            <textarea name="description" rows={5} value={p?.description}
                      class="w-full border border-line bg-surface p-3.5 text-sm text-content outline-none transition-colors focus:border-accent" />
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
                 pendingLabel={mode === "edit" ? "Saving…" : "Creating…"} cancelTo="/admin/properties">
          {mode === "edit" && (
            <button
              type="button"
              disabled={remove.isPending}
              onClick={() => {
                if (confirm("Delete this property? This cannot be undone."))
                  remove.mutate();
              }}
              class="ml-auto text-sm text-content-faint underline-offset-4 transition-colors hover:text-bad hover:underline disabled:opacity-40"
            >
              {remove.isPending ? "Deleting…" : "Delete property"}
            </button>
          )}
        </Actions>
      </FormCard>
    </div>
  );
}
