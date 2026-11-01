import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError } from "../lib/api";
import { PasswordInput } from "../components/ui";
import { signIn } from "../lib/session";

/**
 * The messages come from the API, which already tells wrong credentials apart
 * from an account awaiting approval and from too many attempts. Replacing them
 * with one of our own would say less.
 */
export function LoginPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: Event) {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    setBusy(true);
    setError(null);
    try {
      await signIn(String(data.get("email") ?? ""), String(data.get("password") ?? ""));
      // The gate re-reads who is signed in; it decides where to go next.
      await queryClient.invalidateQueries({ queryKey: ["session"] });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <main class="grid min-h-dvh place-items-center bg-evergreen-950 px-5">
      <div
        aria-hidden
        class="pointer-events-none fixed inset-0 opacity-30"
        style="background: radial-gradient(60rem 30rem at 70% 0%, #1b6a52 0%, transparent 55%)"
      />
      <div class="relative w-full max-w-sm space-y-8">
        <div class="flex flex-col items-center gap-3 text-center">
          <p class="font-display text-3xl font-semibold text-ivory">Nilami</p>
          <p class="text-sm text-ivory/60">Recovery Department · Staff access</p>
        </div>
        <form
          onSubmit={onSubmit}
          class="space-y-4 rounded-3xl border border-ivory/10 bg-ivory p-7 shadow-lift"
        >
          <label class="block space-y-1.5">
            <span class="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">
              Email
            </span>
            <input
              type="email"
              name="email"
              required
              autoComplete="username"
              class="h-12 w-full rounded-xl border border-ink/15 bg-white px-4 text-sm outline-none transition-colors focus:border-evergreen-600"
            />
          </label>
          <label class="block space-y-1.5">
            <span class="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">
              Password
            </span>
            <PasswordInput
              name="password"
              required
              autoComplete="current-password"
              class="h-12 w-full rounded-xl border border-ink/15 bg-white px-4 text-sm outline-none transition-colors focus:border-evergreen-600"
            />
          </label>
          {error && (
            <p class="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>
          )}
          <button
            type="submit"
            disabled={busy}
            class="h-12 w-full rounded-xl bg-evergreen-800 text-sm font-semibold text-ivory transition-colors hover:bg-evergreen-700 disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
