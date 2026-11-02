import { useQueryClient } from "@tanstack/react-query";
import { signOut } from "../lib/session";

/** A real session whose account has not been approved yet. */
export function PendingPage() {
  const queryClient = useQueryClient();
  return (
    <main class="grid min-h-dvh place-items-center bg-deep px-5">
      <div class="w-full max-w-md space-y-5 border border-line bg-surface p-10 text-center shadow-lift">
        <div class="mx-auto grid size-12 place-items-center border border-accent/40 bg-accent-wash text-2xl">
          ⏳
        </div>
        <h1 class="display text-2xl font-semibold text-content">
          Account pending approval
        </h1>
        <p class="text-sm leading-relaxed text-content-soft">
          Your staff account request has been received. The platform
          administrator must approve it before you can access the dashboard.
        </p>
        <button
          onClick={async () => {
            await signOut();
            await queryClient.invalidateQueries({ queryKey: ["session"] });
          }}
          class="text-sm font-medium text-content-soft hover:text-content"
        >
          Sign out
        </button>
      </div>
    </main>
  );
}
