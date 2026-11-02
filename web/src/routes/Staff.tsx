import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, setViewAsTarget} from "../lib/api";
import { formatDate } from "../lib/format";
import { Card, Empty, ErrorNote, Loading, PageHeader, Pill } from "../components/ui";

type StaffRow = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  approved: boolean;
  created_at: string;
  organization_id: string | null;
  organization_name: string | null;
  /** Null for a platform administrator, who belongs to no institution. */
  organization_approved: boolean | null;
};

/**
 * Approving someone is one call now, not two.
 *
 * It used to set a flag here and confirm the address with Supabase, which
 * could half-succeed and leave an approved account that still could not sign
 * in. Rejecting deletes the account, and its sessions go with it.
 */
export function Staff() {
  const queryClient = useQueryClient();
  const { data, isPending, error } = useQuery({
    queryKey: ["staff"],
    queryFn: () => api<StaffRow[]>("/v1/admin/staff"),
  });

  const decide = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "approve" | "reject" }) =>
      api(`/v1/admin/staff/${encodeURIComponent(id)}/${action}`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff"] }),
  });

  return (
    <div class="space-y-8">
      <PageHeader
        title="Staff"
        subtitle="Accounts requesting access, and the people who already have it."
      />

      {error && <ErrorNote message={error.message} />}
      {decide.error && <ErrorNote message={decide.error.message} />}

      <Card>
        {isPending || !data ? (
          <Loading />
        ) : data.length === 0 ? (
          <Empty>No staff accounts yet.</Empty>
        ) : (
          <table class="w-full min-w-[820px] text-sm">
            <thead>
              <tr class="border-b border-line-soft text-left text-xs font-semibold uppercase tracking-[0.12em] text-content-soft">
                <th class="px-6 py-4">Person</th>
                <th class="px-4 py-4">Institution</th>
                <th class="px-4 py-4">Role</th>
                <th class="px-4 py-4">Requested</th>
                <th class="px-6 py-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-line-soft">
              {data.map((s) => (
                <tr key={s.id} class="hover:bg-surface-sunken/50">
                  <td class="px-6 py-3.5">
                    <span class="block font-medium text-content">{s.full_name}</span>
                    <span class="text-xs text-content-soft">{s.email}</span>
                  </td>
                  <td class="px-4 py-3.5 text-content-soft">
                    {s.organization_name ?? "Platform"}
                    {s.organization_approved === false && (
                      <span class="block text-xs text-accent">
                        institution also pending
                      </span>
                    )}
                  </td>
                  <td class="px-4 py-3.5 capitalize">{s.role}</td>
                  <td class="px-4 py-3.5 text-content-soft">{formatDate(s.created_at)}</td>
                  <td class="px-6 py-3.5 text-right">
                    {s.approved ? (
                      <span class="inline-flex items-center gap-3">
                        <Pill label="Approved" tone="open" />
                        {/* Standing in a colleague's shoes.

                            The server has always honoured X-View-As, narrowing
                            the scope to that account and refusing to widen it —
                            a query test asserts both. Nothing ever sent it, so
                            the panel could display who it was proxying as and
                            offered no way to say who. This screen is reachable
                            only by a platform administrator, which is the same
                            condition the server enforces. */}
                        {/* Only for staff who belong to an institution: a
                            platform administrator has none, so viewing as one
                            narrows to nothing and viewing as yourself is a
                            no-op the server would quietly ignore. */}
                        {s.organization_id && (
                        <button
                          type="button"
                          onClick={() => {
                            setViewAsTarget(s.id);
                            location.assign("/admin");
                          }}
                          class="text-xs text-content-faint underline-offset-4 transition-colors hover:text-accent hover:underline"
                        >
                          View as
                        </button>
                        )}
                      </span>
                    ) : (
                      <span class="inline-flex gap-2">
                        <button
                          disabled={decide.isPending}
                          onClick={() => decide.mutate({ id: s.id, action: "approve" })}
                          class="btn btn-primary !px-3 !py-1.5 !text-xs"
                        >
                          Approve
                        </button>
                        <button
                          disabled={decide.isPending}
                          // Rejection deletes the account and cannot be undone.
                          // The page it replaces asked for no confirmation, so
                          // neither does this; worth revisiting as a product call.
                          onClick={() => decide.mutate({ id: s.id, action: "reject" })}
                          class="btn btn-quiet !px-3 !py-1.5 !text-xs hover:!border-bad hover:!text-bad"
                        >
                          Reject
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
