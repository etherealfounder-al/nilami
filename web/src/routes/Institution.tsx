import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "../lib/api";
import { ErrorNote, Loading, PageHeader } from "../components/ui";

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
  "h-11 w-full rounded-xl border border-ink/15 bg-white px-3.5 text-sm outline-none transition-colors focus:border-evergreen-600";
const label = "text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft";

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

  const { data, isPending, error } = useQuery({
    queryKey: ["institution"],
    // A platform administrator belongs to no institution, and the API says so
    // with a 404 rather than a null body. That is an answer, not a failure, so
    // it becomes null here instead of an error the screen cannot act on.
    queryFn: async (): Promise<Organization | null> => {
      try {
        return await api<Organization>("/v1/admin/institution");
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      }
    },
  });

  const save = useMutation({
    mutationFn: (body: Partial<Organization>) =>
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
        <p class="rounded-2xl border border-ink/8 bg-ivory p-6 text-sm text-ink-soft shadow-card">
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
    });
  }

  return (
    <div class="space-y-8">
      <PageHeader title="Institution" subtitle="How this institution appears on the public site." />

      {save.error && <ErrorNote message={save.error.message} />}
      {saved && !save.isPending && (
        <p class="rounded-xl bg-evergreen-100 px-4 py-3 text-sm text-evergreen-900">
          Saved.
        </p>
      )}

      <form
        onSubmit={onSubmit}
        class="space-y-6 rounded-2xl border border-ink/8 bg-ivory p-8 shadow-card"
      >
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

        <div class="flex items-center gap-4 border-t border-ink/8 pt-6">
          <button
            type="submit"
            disabled={save.isPending}
            class="rounded-full bg-evergreen-800 px-7 py-3 text-sm font-semibold text-ivory transition-colors hover:bg-evergreen-700 disabled:opacity-60"
          >
            {save.isPending ? "Saving…" : "Save changes"}
          </button>
          {!data.approved && (
            <span class="text-xs text-brass-600">
              This institution is awaiting approval.
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
