import { upsertAuction } from "@/lib/admin/actions";
import type { Auction } from "@/lib/types";

const inputCls =
  "h-11 w-full rounded-xl border border-ink/15 bg-white px-3.5 text-sm outline-none transition-colors focus:border-evergreen-600";

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

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
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft">
        {label}
      </span>
      {children}
    </label>
  );
}

export function AuctionForm({
  auction,
  properties,
}: {
  auction?: Auction;
  properties: { id: string; title: string }[];
}) {
  const a = auction;
  return (
    <form
      action={upsertAuction}
      className="space-y-8 rounded-2xl border border-ink/8 bg-ivory p-8 shadow-card"
    >
      {a && <input type="hidden" name="id" value={a.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Property" className="sm:col-span-2">
          <select
            name="property_id"
            required
            defaultValue={a?.property_id ?? ""}
            className={inputCls}
          >
            <option value="" disabled>
              Select property…
            </option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Notice number">
          <input name="notice_number" defaultValue={a?.notice_number} className={inputCls} />
        </Field>
        <Field label="Auction round">
          <input name="round" type="number" min={1} defaultValue={a?.round ?? 1} className={inputCls} />
        </Field>
        <Field label="Notice published date">
          <input name="published_date" type="date" defaultValue={a?.published_date ?? ""} className={inputCls} />
        </Field>
        <Field label="Status">
          <select name="status" defaultValue={a?.status ?? "draft"} className={inputCls}>
            {["draft", "upcoming", "open", "closed", "sold", "cancelled"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Submission deadline">
          <input
            name="submission_deadline"
            type="datetime-local"
            required
            defaultValue={toLocalInput(a?.submission_deadline)}
            className={inputCls}
          />
        </Field>
        <Field label="Bid opening date & time">
          <input
            name="opening_datetime"
            type="datetime-local"
            required
            defaultValue={toLocalInput(a?.opening_datetime)}
            className={inputCls}
          />
        </Field>
        <Field label="Opening venue" className="sm:col-span-2">
          <input name="opening_venue" defaultValue={a?.opening_venue} className={inputCls} />
        </Field>
        <Field label="Appraised value (NPR)">
          <input name="appraised_value" type="number" required defaultValue={a?.appraised_value ?? ""} className={inputCls} />
        </Field>
        <Field label="Minimum bid (NPR)">
          <input name="minimum_bid" type="number" required defaultValue={a?.minimum_bid ?? ""} className={inputCls} />
        </Field>
        <Field label="Bid security %">
          <input name="bid_security_pct" type="number" step="0.5" defaultValue={a?.bid_security_pct ?? 10} className={inputCls} />
        </Field>
        <Field label="Bid security amount (blank = auto)">
          <input name="bid_security_amount" type="number" defaultValue={a?.bid_security_amount ?? ""} className={inputCls} />
        </Field>
        <Field label="Winning amount (if sold)">
          <input name="winning_amount" type="number" defaultValue={a?.winning_amount ?? ""} className={inputCls} />
        </Field>
        <Field label="Result note">
          <input name="result_note" defaultValue={a?.result_note ?? ""} className={inputCls} />
        </Field>
      </div>

      <Field label="Terms of sale (one clause per line)">
        <textarea
          name="terms"
          rows={6}
          defaultValue={a?.terms}
          className="w-full rounded-xl border border-ink/15 bg-white p-3.5 text-sm outline-none focus:border-evergreen-600"
        />
      </Field>
      <Field label="Required documents (one per line)">
        <textarea
          name="required_documents"
          rows={4}
          defaultValue={a?.required_documents}
          className="w-full rounded-xl border border-ink/15 bg-white p-3.5 text-sm outline-none focus:border-evergreen-600"
        />
      </Field>

      <div className="flex items-center gap-4 border-t border-ink/8 pt-6">
        <button className="rounded-full bg-evergreen-800 px-7 py-3 text-sm font-semibold text-ivory transition-colors hover:bg-evergreen-700">
          {a ? "Save auction" : "Create auction"}
        </button>
        <a href="/admin/auctions" className="text-sm font-medium text-ink-soft hover:text-ink">
          Cancel
        </a>
      </div>
    </form>
  );
}
