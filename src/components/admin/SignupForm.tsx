"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const inputCls =
  "h-12 w-full rounded-xl border border-ink/15 bg-white px-4 text-sm outline-none transition-colors focus:border-evergreen-600";
const labelCls =
  "text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft";

type Org = { id: string; name: string; pending?: boolean };

function AddInstitutionModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (org: Org) => void;
}) {
  const [name, setName] = useState("");
  const [nameNp, setNameNp] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("request_organization", {
      p_name: name,
      p_name_np: nameNp,
      p_contact_email: email,
      p_contact_phone: phone,
      p_address: address,
    });
    if (error || !data) {
      setError(error?.message ?? "Could not register the institution.");
      setBusy(false);
      return;
    }
    onCreated({ id: data as string, name, pending: true });
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-evergreen-950/70 px-5 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Add your institution"
    >
      <div className="w-full max-w-md rounded-3xl border border-ivory/10 bg-ivory shadow-lift">
        <div className="flex items-start justify-between border-b border-ink/8 px-7 py-5">
          <div>
            <h2 className="font-display text-xl font-semibold text-evergreen-900">
              Add your institution
            </h2>
            <p className="mt-0.5 text-xs text-ink-soft">
              It will be reviewed together with your account request.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 place-items-center rounded-full text-ink-soft transition-colors hover:bg-cream hover:text-ink"
          >
            ✕
          </button>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 px-7 py-6">
          <label className="block space-y-1.5">
            <span className={labelCls}>Institution name *</span>
            <input
              required
              minLength={3}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Machhapuchhre Finance Ltd."
              className={inputCls}
            />
          </label>
          <label className="block space-y-1.5">
            <span className={labelCls}>Name in Nepali</span>
            <input
              value={nameNp}
              onChange={(e) => setNameNp(e.target.value)}
              placeholder="e.g. माछापुच्छ्रे फाइनान्स लि."
              className={inputCls}
            />
          </label>
          <label className="block space-y-1.5">
            <span className={labelCls}>Recovery dept. contact email *</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className={labelCls}>Contact phone</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+977 …"
                className={inputCls}
              />
            </label>
            <label className="block space-y-1.5">
              <span className={labelCls}>Head office address</span>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={inputCls}
              />
            </label>
          </div>
          {error && (
            <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
              {error}
            </p>
          )}
          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-ink/15 px-5 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-evergreen-800 px-6 py-2.5 text-sm font-semibold text-ivory transition-colors hover:bg-evergreen-700 disabled:opacity-60"
            >
              {busy ? "Adding…" : "Add institution"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function SignupForm({
  organizations,
}: {
  organizations: { id: string; name: string }[];
}) {
  const [orgs, setOrgs] = useState<Org[]>(organizations);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgId, setOrgId] = useState("");
  const [role, setRole] = useState("officer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [showModal, setShowModal] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          organization_id: orgId,
          signup_role: role,
        },
      },
    });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="space-y-4 rounded-3xl border border-ivory/10 bg-ivory p-8 text-center shadow-lift">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-evergreen-100 text-2xl">
          ✓
        </div>
        <h2 className="font-display text-2xl font-semibold text-evergreen-900">
          Request submitted
        </h2>
        <p className="text-sm leading-relaxed text-ink-soft">
          Your account{orgs.find((o) => o.id === orgId)?.pending ? " and institution are" : " is"}{" "}
          pending review. Once the platform administrator approves the request,
          you will be able to sign in with the credentials you just chose.
        </p>
        <Link
          href="/admin/login"
          className="inline-block rounded-full bg-evergreen-800 px-6 py-2.5 text-sm font-semibold text-ivory transition-colors hover:bg-evergreen-700"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <>
      {showModal && (
        <AddInstitutionModal
          onClose={() => setShowModal(false)}
          onCreated={(org) => {
            setOrgs((o) => [...o, org]);
            setOrgId(org.id);
            setShowModal(false);
          }}
        />
      )}
      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-3xl border border-ivory/10 bg-ivory p-7 shadow-lift"
      >
        <label className="block space-y-1.5">
          <span className={labelCls}>Full name</span>
          <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} />
        </label>
        <div className="space-y-1.5">
          <span className={labelCls}>Institution</span>
          <select required value={orgId} onChange={(e) => setOrgId(e.target.value)} className={inputCls}>
            <option value="" disabled>
              Select your institution…
            </option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
                {o.pending ? " (new — pending review)" : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="text-xs font-semibold text-evergreen-800 underline-offset-4 hover:underline"
          >
            + Institution not listed? Add it
          </button>
        </div>
        <label className="block space-y-1.5">
          <span className={labelCls}>Role</span>
          <select value={role} onChange={(e) => setRole(e.target.value)} className={inputCls}>
            <option value="officer">Recovery Officer</option>
            <option value="manager">Recovery Manager</option>
            <option value="valuer">Panel Valuer</option>
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className={labelCls}>Work email</span>
          <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
        </label>
        <label className="block space-y-1.5">
          <span className={labelCls}>Password</span>
          <input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
        </label>
        {error && (
          <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="h-12 w-full rounded-xl bg-evergreen-800 text-sm font-semibold text-ivory transition-colors hover:bg-evergreen-700 disabled:opacity-60"
        >
          {busy ? "Submitting…" : "Request account"}
        </button>
        <p className="text-center text-xs text-ink-soft">
          Already approved?{" "}
          <Link href="/admin/login" className="font-semibold text-evergreen-800 hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </>
  );
}
