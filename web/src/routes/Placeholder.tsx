/**
 * A route that exists and is reachable but is not written yet.
 *
 * Deliberately explicit rather than a blank page: during the port it has to be
 * obvious at a glance which screens are done and which are not.
 */
export function Placeholder({ title }: { title: string }) {
  return (
    <div class="rounded-2xl border border-ink/8 bg-ivory p-8 shadow-card">
      <h1 class="font-display text-2xl font-semibold text-evergreen-900">{title}</h1>
      <p class="mt-2 text-sm text-ink-soft">Not ported yet.</p>
    </div>
  );
}
