"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const inputCls =
  "h-12 w-full rounded-xl border border-ink/15 bg-white px-4 text-sm outline-none transition-colors focus:border-evergreen-600";
const labelCls =
  "text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft";

export function SignupForm({
  organizations,
}: {
  organizations: { id: string; name: string }[];
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgId, setOrgId] = useState("");
  const [role, setRole] = useState("officer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

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
          Your account is pending review. Once the platform administrator
          approves it, you will be able to sign in with the credentials you
          just chose.
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
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-3xl border border-ivory/10 bg-ivory p-7 shadow-lift"
    >
      <label className="block space-y-1.5">
        <span className={labelCls}>Full name</span>
        <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} />
      </label>
      <label className="block space-y-1.5">
        <span className={labelCls}>Institution</span>
        <select required value={orgId} onChange={(e) => setOrgId(e.target.value)} className={inputCls}>
          <option value="" disabled>
            Select your institution…
          </option>
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
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
  );
}
