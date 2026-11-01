import { useQueryClient } from "@tanstack/react-query";
import { signOut } from "../lib/session";

/** A real session whose account has not been approved yet. */
export function PendingPage() {
  const queryClient = useQueryClient();
  return (
    <main class="grid min-h-dvh place-items-center bg-seal-950 px-5">
      <div class="w-full max-w-md space-y-5 rounded-3xl border border-oat/10 bg-oat p-8 text-center shadow-raised">
        <div class="mx-auto grid size-12 place-items-center rounded-full bg-brass-100 text-2xl">
          ⏳
        </div>
        <h1 class="font-display text-2xl font-semibold text-seal-900">
          Account pending approval
        </h1>
        <p class="text-sm leading-relaxed text-ink-soft">
          Your staff account request has been received. The platform
          administrator must approve it before you can access the dashboard.
        </p>
        <button
          onClick={async () => {
            await signOut();
            await queryClient.invalidateQueries({ queryKey: ["session"] });
          }}
          class="text-sm font-medium text-ink-soft hover:text-ink"
        >
          Sign out
        </button>
      </div>
    </main>
  );
}
