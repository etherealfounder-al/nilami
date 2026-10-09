"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LogoUploader } from "@/components/admin/LogoUploader";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { updateOrganizationBranding } from "@/lib/admin/actions";
import type { Organization } from "@/lib/types";
import { Select } from "@/components/ui/Select";

const inputCls =
  "h-11 w-full rounded-xl border border-ink/15 bg-white px-3.5 text-sm outline-none transition-colors focus:border-evergreen-600";
const labelCls =
  "text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft";

function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block space-y-1.5 ${className}`}>
      <span className={labelCls}>{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-ink-soft">{hint}</span>}
    </label>
  );
}

export function InstitutionForm({
  org,
  organizations,
}: {
  org: Organization;
  /** Non-empty only for a platform admin, who belongs to no institution. */
  organizations: { id: string; name: string }[];
}) {
  const router = useRouter();
  // Switching institution is a server round-trip. Without holding the choice
  // locally the select is re-rendered from the institution still on screen, so
  // it visibly snaps back to the previous one until the new page arrives — on a
  // slow connection that reads as the control doing nothing at all.
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState<string | null>(null);
  // While the switch is in flight show where we are going; once it lands the
  // server's institution is the truth again, so no state needs resetting.
  const choice = pending && target ? target : org.id;

  return (
    <form
      action={updateOrganizationBranding}
      className="space-y-8 rounded-2xl border border-ink/8 bg-ivory p-8 shadow-card"
    >
      <input type="hidden" name="organization_id" value={org.id} />

      {organizations.length > 0 && (
        <div className="space-y-1.5">
          <span className={labelCls}>
            Editing{pending && " · loading…"}
          </span>
          <Select
            aria-label="Institution being edited"
            value={choice}
            disabled={pending}
            onValueChange={(next) => {
              setTarget(next);
              startTransition(() =>
                router.push(`/admin/institution?org=${next}`)
              );
            }}
            options={organizations.map((o) => ({
              value: o.id,
              label: o.name,
            }))}
          />
        </div>
      )}

      {/* Keyed on the institution so switching rebuilds every field from the
          new record. Without it the logo keeps the previous institution's
          state — useState only seeds on mount — and a half-typed edit survives
          the switch, so saving would write either onto the wrong institution.
          The picker sits outside, keeping its in-flight selection. */}
      <fieldset
        key={org.id}
        disabled={pending}
        className={pending ? "opacity-50" : undefined}
      >
      <section className="space-y-4">
        <div>
          <h2 className="font-semibold text-evergreen-900">{org.name}</h2>
          <p className="text-sm text-ink-soft">
            The name is set when the institution is registered and cannot be
            changed here.
          </p>
        </div>

        <div className="space-y-1.5">
          <span className={labelCls}>Logo</span>
          <LogoUploader initialUrl={org.logo_url} name={org.name} />
        </div>

        <Field
          label="Website"
          hint="Shown on each listing as “Visit Bank Auction”. Left blank, the card offers an email enquiry instead."
        >
          <input
            name="website"
            type="url"
            defaultValue={org.website ?? ""}
            placeholder="https://…"
            className={inputCls}
          />
        </Field>
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold text-evergreen-900">Contact for bidders</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email">
            <input
              name="contact_email"
              type="email"
              defaultValue={org.contact_email}
              className={inputCls}
            />
          </Field>
          <Field label="Phone">
            <input
              name="contact_phone"
              defaultValue={org.contact_phone}
              className={inputCls}
            />
          </Field>
          <Field label="Head office address">
            <input name="address" defaultValue={org.address} className={inputCls} />
          </Field>
          <Field label="Head office address (Nepali)">
            <input
              name="address_np"
              defaultValue={org.address_np}
              className={inputCls}
            />
          </Field>
        </div>
      </section>

      <div className="flex items-center gap-4 border-t border-ink/8 pt-6">
        <SubmitButton
          pendingLabel="Saving…"
          className="rounded-full bg-evergreen-800 px-7 py-3 text-sm font-semibold text-ivory transition-colors hover:bg-evergreen-700"
        >
          Save changes
        </SubmitButton>
      </div>
      </fieldset>
    </form>
  );
}
