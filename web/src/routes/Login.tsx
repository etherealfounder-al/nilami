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
    /*
      Sign-in, set as the title page of the record it opens: the masthead,
      a rule, and two ruled fields. Split on a wide screen so the dark half
      carries the name and the light half carries the work.
    */
    <main class="min-h-dvh lg:grid lg:grid-cols-2">
      <div class="flex flex-col justify-between bg-seal-950 px-8 py-12 lg:px-14 lg:py-16">
        <div>
          <span aria-hidden="true" class="font-display block text-5xl leading-none text-oat lg:text-6xl">
            निलामी
          </span>
          <span class="mt-3 block text-[0.6875rem] font-semibold tracking-[0.42em] text-brass-500 uppercase">
            Nilami
          </span>
        </div>
        <p class="mt-10 max-w-sm text-sm leading-relaxed text-oat/55 lg:mt-0">
          The recovery department's record of collateral offered for sale —
          properties, auction rounds, and the bidders who have lodged a
          security against them.
        </p>
      </div>

      <div class="grid place-items-center px-6 py-14 lg:px-14">
        <form onSubmit={onSubmit} class="w-full max-w-sm">
          <p class="standing">Staff access</p>
          <h1 class="font-display mt-2 border-b-2 border-ink pb-4 text-[2rem] leading-none text-ink">
            Sign in
          </h1>

          <label class="mt-8 block">
            <span class="standing">Email</span>
            <input
              type="email"
              name="email"
              required
              autoComplete="username"
              class="field mt-1.5"
            />
          </label>

          <label class="mt-6 block">
            <span class="standing">Password</span>
            <PasswordInput
              name="password"
              required
              autoComplete="current-password"
              class="field mt-1.5"
            />
          </label>

          {error && (
            <p class="mt-6 border-l-2 border-vermilion bg-vermilion-soft px-4 py-3 text-sm text-vermilion">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            class="mt-9 w-full border-2 border-ink bg-ink py-3 font-display text-base text-oat transition-colors hover:border-seal-800 hover:bg-seal-800 disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
