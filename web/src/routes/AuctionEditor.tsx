import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { api, ApiError } from "../lib/api";
import { Actions, Field, FormCard, Section, inputCls, readForm } from "../components/form";
import { ErrorNote, Loading, PageHeader } from "../components/ui";

type AuctionDetail = {
  id: string;
  round: number;
  notice_number: string;
  published_date: string | null;
  submission_deadline: string;
  opening_datetime: string;
  opening_venue: string;
  appraised_value: number | null;
  minimum_bid: number;
  bid_security_amount: number;
  terms: string;
  required_documents: string;
  notice_pdf_url: string | null;
  status: string;
  winning_amount: number | null;
  result_note: string | null;
  property: { id: string; slug: string; title: string };
};

const STATUSES = ["draft", "upcoming", "open", "closed", "sold", "cancelled"];

/**
 * A datetime-local input wants "YYYY-MM-DDTHH:mm" in the browser's own zone,
 * while the API speaks RFC 3339 in UTC. Converting through the Date object
 * rather than slicing the string keeps the offset right — slicing an ISO
 * string shows a Kathmandu reader a time five and three quarter hours out.
 */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}

export function AuctionEditor({ mode }: { mode: "new" | "edit" }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const existing = useQuery({
    queryKey: ["auction", id],
    queryFn: () => api<AuctionDetail>(`/v1/admin/auctions/${encodeURIComponent(id!)}`),
    enabled: mode === "edit" && !!id,
  });

  const properties = useQuery({
    queryKey: ["properties"],
    queryFn: () => api<{ id: string; title: string; district: string }[]>("/v1/admin/properties"),
  });

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      mode === "edit"
        ? api(`/v1/admin/auctions/${encodeURIComponent(id!)}`, { method: "PUT", body })
        : api("/v1/admin/auctions", { method: "POST", body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auctions"] });
      queryClient.invalidateQueries({ queryKey: ["auction", id] });
      navigate("/auctions");
    },
  });

  if (mode === "edit" && existing.isPending) return <Loading />;
  if (mode === "edit" && existing.error) return <ErrorNote message={existing.error.message} />;

  const a = existing.data;

  function onSubmit(e: Event) {
    e.preventDefault();
    const f = readForm(e.currentTarget as HTMLFormElement);
    save.mutate({
      property_id: f.str("property_id"),
      round: f.int("round") ?? 1,
      notice_number: f.str("notice_number"),
      published_date: f.strOrNull("published_date"),
      submission_deadline: fromLocalInput(f.str("submission_deadline")),
      opening_datetime: fromLocalInput(f.str("opening_datetime")),
      opening_venue: f.str("opening_venue"),
      appraised_value: f.num("appraised_value"),
      minimum_bid: f.num("minimum_bid") ?? 0,
      bid_security_amount: f.num("bid_security_amount") ?? 0,
      terms: f.str("terms"),
      required_documents: f.str("required_documents"),
      notice_pdf_url: f.strOrNull("notice_pdf_url"),
      status: f.str("status"),
      winning_amount: f.num("winning_amount"),
      result_note: f.strOrNull("result_note"),
    });
  }

  return (
    <div class="space-y-8">
      <PageHeader title={mode === "edit" ? "Edit auction" : "New auction"} />
      {save.error && (
        <ErrorNote
          message={save.error instanceof ApiError ? save.error.message : "The auction could not be saved."}
        />
      )}

      <FormCard onSubmit={onSubmit}>
        <Section title="Notice">
          <div class="grid gap-4 sm:grid-cols-2">
            <Field label="Property" className="sm:col-span-2">
              <select name="property_id" required class={`${inputCls} cursor-pointer`}>
                <option value="">Choose a property…</option>
                {(properties.data ?? []).map((p) => (
                  <option key={p.id} value={p.id} selected={a?.property.id === p.id}>
                    {p.title} — {p.district}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Notice number">
              <input name="notice_number" required value={a?.notice_number} class={inputCls} />
            </Field>
            <Field label="Round" hint="First auction is round 1; a re-auction is 2.">
              <input name="round" type="number" min="1" value={a?.round ?? 1} class={inputCls} />
            </Field>
            <Field label="Notice published">
              <input name="published_date" type="date" value={a?.published_date ?? ""} class={inputCls} />
            </Field>
            <Field label="Status">
              <select name="status" class={`${inputCls} cursor-pointer`}>
                {STATUSES.map((s) => (
                  <option key={s} value={s} selected={(a?.status ?? "draft") === s}>
                    {s[0].toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Section>

        <Section title="Dates and venue">
          <div class="grid gap-4 sm:grid-cols-2">
            <Field label="Submission deadline">
              <input name="submission_deadline" type="datetime-local" required
                     value={toLocalInput(a?.submission_deadline)} class={inputCls} />
            </Field>
            <Field label="Bid opening">
              <input name="opening_datetime" type="datetime-local" required
                     value={toLocalInput(a?.opening_datetime)} class={inputCls} />
            </Field>
            <Field label="Opening venue" className="sm:col-span-2">
              <input name="opening_venue" value={a?.opening_venue} class={inputCls} />
            </Field>
          </div>
        </Section>

        <Section title="Money">
          <div class="grid gap-4 sm:grid-cols-3">
            <Field label="Appraised value (NPR)">
              <input name="appraised_value" type="number" step="1" value={a?.appraised_value ?? ""} class={inputCls} />
            </Field>
            <Field label="Minimum bid (NPR)">
              <input name="minimum_bid" type="number" step="1" required value={a?.minimum_bid ?? ""} class={inputCls} />
            </Field>
            <Field label="Bid security (NPR)">
              <input name="bid_security_amount" type="number" step="1" required
                     value={a?.bid_security_amount ?? ""} class={inputCls} />
            </Field>
            <Field label="Winning amount (NPR)" hint="Set once the auction is sold.">
              <input name="winning_amount" type="number" step="1" value={a?.winning_amount ?? ""} class={inputCls} />
            </Field>
            <Field label="Result note" className="sm:col-span-2">
              <input name="result_note" value={a?.result_note ?? ""} class={inputCls} />
            </Field>
          </div>
        </Section>

        <Section title="Terms">
          <Field label="Terms of sale">
            <textarea name="terms" rows={4} value={a?.terms}
                      class="w-full rounded-xl border border-rule-strong bg-white p-3.5 text-sm outline-none transition-colors focus:border-seal-600" />
          </Field>
          <Field label="Documents required with a bid">
            <textarea name="required_documents" rows={3} value={a?.required_documents}
                      class="w-full rounded-xl border border-rule-strong bg-white p-3.5 text-sm outline-none transition-colors focus:border-seal-600" />
          </Field>
          <Field label="Notice PDF">
            <input name="notice_pdf_url" type="url" value={a?.notice_pdf_url ?? ""} placeholder="https://" class={inputCls} />
          </Field>
        </Section>

        <Actions busy={save.isPending} label={mode === "edit" ? "Save changes" : "Create auction"}
                 pendingLabel={mode === "edit" ? "Saving…" : "Creating…"} cancelTo="/admin/auctions" />
      </FormCard>
    </div>
  );
}
