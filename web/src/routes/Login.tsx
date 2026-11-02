import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { ApiError } from "../lib/api";
import { Mark, PasswordInput } from "../components/ui";
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
    <main class="min-h-dvh lg:grid lg:grid-cols-[0.9fr_1.1fr]">
      {/* The panel carries the name and what the record is for. Centred
          rather than pinned to the corners: at laptop height the two ends
          were a screen apart with nothing between them. */}
      <div class="flex flex-col justify-center gap-7 bg-deep px-8 py-14 lg:px-14">
        <div class="flex items-center gap-4">
          <span class="grid size-14 shrink-0 place-items-center rounded-2xl bg-accent text-on-accent">
            <Mark class="size-8" />
          </span>
          <span>
            <span aria-hidden="true" class="display block text-[2.5rem] leading-none text-on-deep lg:text-5xl">
              निलामी
            </span>
            <span class="mt-1 block text-[0.6875rem] font-semibold tracking-[0.42em] text-accent uppercase">
              Nilami
            </span>
          </span>
        </div>
        <span aria-hidden="true" class="h-px w-16 bg-accent/50"></span>
        <p class="max-w-sm text-sm leading-relaxed text-on-deep/55">
          The recovery department's record of collateral offered for sale —
          properties, auction rounds, and the bidders who have lodged a
          security against them.
        </p>
      </div>

      <div class="grid place-items-center px-6 py-14 lg:px-14">
        <form onSubmit={onSubmit} class="w-full max-w-sm">
          <p class="eyebrow">Staff access</p>
          <h1 class="title text-2xl">Sign in</h1>
          <p class="mt-1 text-sm text-content-soft">
            Staff of a participating institution can{" "}
            <Link to="/signup" className="text-accent hover:underline">
              request access
            </Link>
            .
          </p>

          <label class="mt-8 block">
            <span class="eyebrow">Email</span>
            <input
              type="email"
              name="email"
              required
              autoComplete="username"
              class="field mt-1.5"
            />
          </label>

          <label class="mt-6 block">
            <span class="eyebrow">Password</span>
            <PasswordInput
              name="password"
              required
              autoComplete="current-password"
              class="field mt-1.5"
            />
          </label>

          {error && (
            <p class="mt-6 border-l-2 border-bad bg-bad-wash px-4 py-3 text-sm text-bad">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            class="btn btn-primary mt-9 w-full"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
