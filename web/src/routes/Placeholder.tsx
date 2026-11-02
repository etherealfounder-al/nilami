/**
 * A route that exists and is reachable but is not written yet.
 *
 * Deliberately explicit rather than a blank page: during the port it has to be
 * obvious at a glance which screens are done and which are not.
 */
export function Placeholder({ title }: { title: string }) {
  return (
    <div class="border border-line bg-surface p-10 shadow-soft">
      <h1 class="display text-2xl font-semibold text-content">{title}</h1>
      <p class="mt-2 text-sm text-content-soft">Not ported yet.</p>
    </div>
  );
}
