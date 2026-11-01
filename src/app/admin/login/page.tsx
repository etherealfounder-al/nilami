"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Logo } from "@/components/Logo";
import { PasswordInput } from "@/components/admin/PasswordInput";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { signInAction } from "@/lib/admin/actions";

/**
 * Sign-in posts to a server action rather than calling an auth service from
 * the browser.
 *
 * Two things follow. The session cookie is httpOnly, so the page never holds a
 * token for a script to read; and the form submits without JavaScript, which
 * the password manager and the browser's own validation both prefer.
 *
 * The messages come from the API, which already distinguishes wrong
 * credentials from an account awaiting approval and from too many attempts.
 */
export default function AdminLoginPage() {
  const [state, formAction] = useActionState(signInAction, null);

  return (
    <main className="grid min-h-dvh place-items-center bg-evergreen-950 px-5">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-30"
        style={{
          background:
            "radial-gradient(60rem 30rem at 70% 0%, #1b6a52 0%, transparent 55%)",
        }}
      />
      <div className="relative w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo dark />
          <p className="text-sm text-ivory/60">
            Recovery Department · Staff access
          </p>
        </div>
        <form
          action={formAction}
          className="space-y-4 rounded-3xl border border-ivory/10 bg-ivory p-7 shadow-lift"
        >
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">
              Email
            </span>
            <input
              type="email"
              name="email"
              required
              autoComplete="username"
              className="h-12 w-full rounded-xl border border-ink/15 bg-white px-4 text-sm outline-none transition-colors focus:border-evergreen-600"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">
              Password
            </span>
            <PasswordInput
              name="password"
              required
              autoComplete="current-password"
              className="h-12 w-full rounded-xl border border-ink/15 bg-white px-4 text-sm outline-none transition-colors focus:border-evergreen-600"
            />
          </label>
          {state?.error && (
            <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
              {state.error}
            </p>
          )}
          <SubmitButton
            pendingLabel="Signing in…"
            className="h-12 w-full rounded-xl bg-evergreen-800 text-sm font-semibold text-ivory transition-colors hover:bg-evergreen-700 disabled:opacity-60"
          >
            Sign in
          </SubmitButton>
        </form>
        <p className="text-center text-xs text-ivory/40">
          Access is limited to authorised staff.{" "}
          <Link href="/admin/signup" className="font-semibold text-brass-300 hover:underline">
            Request an account
          </Link>
        </p>
      </div>
    </main>
  );
}
