import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { ApiError, api } from "../lib/api";
import { Mark, PasswordInput } from "../components/ui";
import { Select } from "../components/Select";

type Org = { id: string; name: string };

/**
 * Requesting staff access.
 *
 * Open to anyone, because that is what signing up is: the account it creates
 * is unapproved and can reach nothing until a platform administrator clears
 * it on the Staff screen. The institution list is public for the same reason
 * the public site is — these are the banks whose notices it publishes.
 */
export function SignupPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [adding, setAdding] = useState(false);
  // An institution requested during this signup. It is unapproved, so it is
  // not in the list the server returns — but the person who just asked for it
  // has to be able to select it, or they would have to wait for approval
  // before they could even request an account.
  const [requested, setRequested] = useState<Org | null>(null);
  const [org, setOrg] = useState("");

  const { data: orgs, isPending } = useQuery({
    queryKey: ["signup-organizations"],
    queryFn: () => api<Org[]>("/v1/pages/signup/organizations"),
  });

  async function onSubmit(e: Event) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const f = new FormData(form);
    setBusy(true);
    setError(null);
    try {
      await api("/v1/pages/signup", {
        method: "POST",
        body: JSON.stringify({
          email: String(f.get("email") ?? "").trim(),
          password: String(f.get("password") ?? ""),
          full_name: String(f.get("full_name") ?? "").trim(),
          organization_id: org,
          role: String(f.get("role") ?? "staff"),
        }),
      });
      setDone(true);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not create the account."
      );
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <main class="grid min-h-dvh place-items-center bg-canvas px-6 py-14">
        <div class="card w-full max-w-md p-8 text-center">
          <span class="mx-auto grid size-12 place-items-center rounded-xl bg-accent-wash text-accent">
            <Mark class="size-7" />
          </span>
          <h1 class="title mt-5 text-xl">Request received</h1>
          <p class="mt-2 text-sm leading-relaxed text-content-soft">
            Your account has been created and is waiting for a platform
            administrator to approve it. You will be able to sign in once it
            has been cleared.
          </p>
          <button onClick={() => navigate("/login")} class="btn btn-primary mt-7 w-full">
            Back to sign in
          </button>
        </div>
      </main>
    );
  }

  return (
    <main class="min-h-dvh lg:grid lg:grid-cols-[0.9fr_1.1fr]">
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
        <p class="max-w-sm text-sm leading-relaxed text-on-deep/55">
          Staff of a participating institution can request access to the
          recovery panel. Accounts are approved by a platform administrator
          before they can reach anything.
        </p>
      </div>

      <div class="grid place-items-center px-6 py-14 lg:px-14">
        <form onSubmit={onSubmit} class="w-full max-w-sm">
          <h1 class="title text-2xl">Request access</h1>
          <p class="mt-1 text-sm text-content-soft">
            Already approved?{" "}
            <Link to="/login" className="text-accent hover:underline">
              Sign in
            </Link>
          </p>

          <label class="mt-7 block">
            <span class="label">Institution</span>
            <Select
              name="organization_id"
              required
              disabled={isPending}
              value={org}
              onChange={setOrg}
              placeholder={isPending ? "Loading…" : "Choose your institution"}
              class="mt-1.5"
              options={[
                ...(orgs ?? []).map((o) => ({ value: o.id, label: o.name })),
                ...(requested
                  ? [{ value: requested.id, label: requested.name, hint: "awaiting approval" }]
                  : []),
              ]}
            />
            <button
              type="button"
              onClick={() => setAdding(true)}
              class="mt-2 text-sm text-accent hover:underline"
            >
              My institution is not listed
            </button>
          </label>

          <label class="mt-5 block">
            <span class="label">Full name</span>
            <input type="text" name="full_name" required autoComplete="name" class="field mt-1.5" />
          </label>

          <label class="mt-5 block">
            <span class="label">Work email</span>
            <input type="email" name="email" required autoComplete="username" class="field mt-1.5" />
          </label>

          <label class="mt-5 block">
            <span class="label">Password</span>
            <PasswordInput name="password" required autoComplete="new-password" class="field mt-1.5" />
            <span class="mt-1.5 block text-xs text-content-faint">
              At least 12 characters.
            </span>
          </label>

          {error && (
            <p class="mt-5 rounded-lg border border-bad/30 bg-bad-wash px-4 py-3 text-sm text-bad">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} class="btn btn-primary mt-7 w-full">
            {busy ? "Sending…" : "Request access"}
          </button>
        </form>
      </div>

      {adding && (
        <AddInstitution
          onClose={() => setAdding(false)}
          onCreated={(created) => {
            setRequested(created);
            setOrg(created.id);
            setAdding(false);
          }}
        />
      )}
    </main>
  );
}

/**
 * Requesting an institution that is not on the portal yet.
 *
 * Reachable before any account exists, which is why the endpoint behind it
 * carries its own limits rather than a credential: a name worth storing, a
 * contact address that parses, and a ceiling on how many requests may be
 * queued at once. The institution lands unapproved and is shown to nobody
 * except a platform administrator and the person who asked for it.
 */
function AddInstitution({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (org: Org) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: Event) {
    e.preventDefault();
    const f = new FormData(e.target as HTMLFormElement);
    const name = String(f.get("name") ?? "").trim();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ id: string }>("/v1/organizations/requests", {
        method: "POST",
        body: JSON.stringify({
          name,
          name_np: String(f.get("name_np") ?? "").trim(),
          contact_email: String(f.get("contact_email") ?? "").trim(),
          contact_phone: String(f.get("contact_phone") ?? "").trim(),
          address: String(f.get("address") ?? "").trim(),
        }),
      });
      onCreated({ id: res.id, name });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not register the institution."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      class="fixed inset-0 z-50 grid place-items-center bg-deep/70 px-5 py-10 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Add your institution"
    >
      <form onSubmit={submit} class="card max-h-full w-full max-w-lg overflow-y-auto p-6 sm:p-8">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h2 class="title text-xl">Add your institution</h2>
            <p class="mt-1 text-sm text-content-soft">
              It will be reviewed before any notice can be published under it.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            class="-mr-1 -mt-1 grid size-8 shrink-0 place-items-center rounded-lg text-content-faint transition-colors hover:bg-surface-sunken hover:text-content"
          >
            ✕
          </button>
        </div>

        <label class="mt-6 block">
          <span class="label">Institution name</span>
          <input type="text" name="name" required minLength={3} class="field mt-1.5"
                 placeholder="e.g. Machhapuchhre Finance Ltd." />
        </label>

        <label class="mt-5 block">
          <span class="label">Name in Nepali</span>
          <input type="text" name="name_np" class="field mt-1.5"
                 placeholder="e.g. माछापुच्छ्रे फाइनान्स लि." />
        </label>

        <label class="mt-5 block">
          <span class="label">Recovery department email</span>
          <input type="email" name="contact_email" required class="field mt-1.5" />
        </label>

        <div class="mt-5 grid gap-5 sm:grid-cols-2">
          <label class="block">
            <span class="label">Contact phone</span>
            <input type="tel" name="contact_phone" class="field mt-1.5" placeholder="+977 …" />
          </label>
          <label class="block">
            <span class="label">Head office address</span>
            <input type="text" name="address" class="field mt-1.5" />
          </label>
        </div>

        {error && (
          <p class="mt-5 rounded-lg border border-bad/30 bg-bad-wash px-4 py-3 text-sm text-bad">
            {error}
          </p>
        )}

        <div class="mt-7 flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy} class="btn btn-primary">
            {busy ? "Sending…" : "Add institution"}
          </button>
          <button type="button" onClick={onClose} class="btn btn-quiet">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
