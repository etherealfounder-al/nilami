import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "../lib/api";
import { ErrorNote, Loading, PageHeader } from "../components/ui";
import { LogoUploader } from "../components/LogoUploader";
import { Select } from "../components/Select";

type Organization = {
  id: string;
  slug: string;
  name: string;
  name_np: string;
  logo_url: string | null;
  website: string | null;
  contact_email: string;
  contact_phone: string;
  address: string;
  address_np: string;
  approved: boolean;
};

const field =
  "field";
const label = "text-xs font-semibold uppercase tracking-[0.12em] text-content-soft";

/**
 * The institution's own details.
 *
 * Which institution this is comes from the session, not from the form: a
 * platform administrator may name one, and staff always get their own
 * whichever id they ask for. The API decides, so nothing here can be pointed
 * at somebody else's.
 */
export function Institution() {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  // The logo is set by an upload, not by a form control, so it is held here
  // and sent with the rest on save. undefined means "not touched yet", which
  // is how the loaded value and an explicit removal stay distinguishable.
  const [logo, setLogo] = useState<string | null | undefined>(undefined);
  // Which institution is being edited. Empty means "whichever the API picks",
  // which for staff is their own and is the only one they can reach.
  const [orgId, setOrgId] = useState("");

  /*
   * A platform administrator has no institution of their own, so the API
   * hands them one — the first by name — and this is the only screen where
   * that choice matters. The endpoint has always taken ?org= for exactly
   * this; it simply had nothing to send it.
   *
   * Staff get a single-entry list and no picker, because the API would ignore
   * the parameter anyway: it scopes every answer to the session.
   */
  const institutions = useQuery({
    queryKey: ["institutions"],
    queryFn: () => api<{ id: string; name: string; approved: boolean }[]>("/v1/admin/institutions"),
  });

  const { data, isPending, error } = useQuery({
    queryKey: ["institution", orgId],
    // A platform administrator belongs to no institution, and the API says so
    // with a 404 rather than a null body. That is an answer, not a failure, so
    // it becomes null here instead of an error the screen cannot act on.
    queryFn: async (): Promise<Organization | null> => {
      try {
        return await api<Organization>(
          orgId
            ? `/v1/admin/institution?org=${encodeURIComponent(orgId)}`
            : "/v1/admin/institution"
        );
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      }
    },
  });

  const save = useMutation({
    mutationFn: (body: Partial<Organization> & { organization_id?: string }) =>
      api("/v1/admin/institution", { method: "PATCH", body }),
    onSuccess: () => {
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ["institution"] });
    },
  });

  if (isPending) return <Loading />;
  if (error) return <ErrorNote message={error.message} />;
  if (!data) {
    return (
      <div class="space-y-8">
        <PageHeader title="Institution" />
        <p class="border border-line bg-surface p-6 text-sm text-content-soft shadow-soft">
          Your account is not attached to an institution.
        </p>
      </div>
    );
  }

  function onSubmit(e: Event) {
    e.preventDefault();
    setSaved(false);
    const form = new FormData(e.currentTarget as HTMLFormElement);
    save.mutate({
      name: String(form.get("name") ?? ""),
      name_np: String(form.get("name_np") ?? ""),
      website: String(form.get("website") ?? "") || null,
      contact_email: String(form.get("contact_email") ?? ""),
      contact_phone: String(form.get("contact_phone") ?? ""),
      address: String(form.get("address") ?? ""),
      address_np: String(form.get("address_np") ?? ""),
      logo_url: logo === undefined ? data?.logo_url ?? null : logo,
      organization_id: data?.id,
    });
  }

  return (
    <div class="space-y-8">
      <PageHeader title="Institution" subtitle="How this institution appears on the public site." />

      {save.error && <ErrorNote message={save.error.message} />}
      {saved && !save.isPending && (
        <p class="border-l-2 border-accent bg-accent-wash px-4 py-3 text-sm text-content">
          Saved.
        </p>
      )}

      {(institutions.data?.length ?? 0) > 1 && (
        <div class="card flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
          <span class="label">Editing</span>
          <Select
            name="institution_picker"
            value={orgId || data.id}
            onChange={(v) => {
              setOrgId(v);
              setLogo(undefined);
              setSaved(false);
            }}
            class="w-full sm:w-72"
            options={(institutions.data ?? []).map((o) => ({
              value: o.id,
              label: o.name,
              hint: o.approved ? undefined : "awaiting approval",
            }))}
          />
        </div>
      )}

      {/*
        Keyed by the institution.

        Every field below is uncontrolled — defaultValue, read once when the
        input mounts — so changing which institution is loaded updates the
        query and leaves the form showing the previous one's details. The key
        remounts it, which re-reads every defaultValue from the new record.
      */}
      <form
        key={data.id}
        onSubmit={onSubmit}
        class="card space-y-7 p-7 shadow-soft sm:p-9"
      >
        <div>
          <span class="label">Logo</span>
          <div class="mt-2">
            <LogoUploader
              url={logo === undefined ? data.logo_url : logo}
              onChange={setLogo}
            />
          </div>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block space-y-1.5">
            <span class={label}>Name</span>
            <input name="name" required defaultValue={data.name} class={field} />
          </label>
          <label class="block space-y-1.5">
            <span class={label}>Name (Nepali)</span>
            <input name="name_np" defaultValue={data.name_np} class={field} />
          </label>
          <label class="block space-y-1.5">
            <span class={label}>Contact email</span>
            <input
              name="contact_email"
              type="email"
              defaultValue={data.contact_email}
              class={field}
            />
          </label>
          <label class="block space-y-1.5">
            <span class={label}>Contact phone</span>
            <input name="contact_phone" defaultValue={data.contact_phone} class={field} />
          </label>
          <label class="block space-y-1.5 sm:col-span-2">
            <span class={label}>Website</span>
            <input
              name="website"
              type="url"
              defaultValue={data.website ?? ""}
              placeholder="https://"
              class={field}
            />
          </label>
          <label class="block space-y-1.5">
            <span class={label}>Address</span>
            <input name="address" defaultValue={data.address} class={field} />
          </label>
          <label class="block space-y-1.5">
            <span class={label}>Address (Nepali)</span>
            <input name="address_np" defaultValue={data.address_np} class={field} />
          </label>
        </div>

        <div class="flex items-center gap-4 border-t border-line-soft pt-6">
          <button
            type="submit"
            disabled={save.isPending}
            class="btn btn-primary"
          >
            {save.isPending ? "Saving…" : "Save changes"}
          </button>
          {!data.approved && (
            <span class="text-xs text-accent">
              This institution is awaiting approval.
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
