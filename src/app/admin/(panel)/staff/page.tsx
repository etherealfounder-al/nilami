import { redirect } from "next/navigation";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { approveStaff, rejectStaff, startViewAs } from "@/lib/admin/actions";
import { getStaff } from "@/lib/admin/queries";
import { getViewer } from "@/lib/admin/view-as";

export const dynamic = "force-dynamic";

const roleLabels: Record<string, string> = {
  admin: "Platform Admin",
  manager: "Recovery Manager",
  officer: "Recovery Officer",
  valuer: "Panel Valuer",
};

export default async function AdminStaffPage() {
  // Uses the effective scope, so a proxy session hides this page the same way
  // it is hidden from the staff member being proxied into. The API refuses the
  // write regardless; this only keeps the page from being shown at all.
  const viewer = await getViewer();
  if (!viewer || !viewer.isPlatformAdmin || viewer.viewingAs) redirect("/admin");

  const rows = await getStaff();
  const pending = rows.filter((r) => !r.approved).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-evergreen-900">
          Staff
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          {pending > 0
            ? `${pending} account request${pending === 1 ? "" : "s"} awaiting approval.`
            : "All staff accounts are approved."}
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-ink/8 bg-ivory shadow-card">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b border-ink/8 text-left text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft">
              <th className="px-6 py-4">Staff member</th>
              <th className="px-4 py-4">Institution</th>
              <th className="px-4 py-4">Role</th>
              <th className="px-4 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/8">
            {rows.map((p) => (
              <tr key={p.id} className={p.approved ? "hover:bg-cream/50" : "bg-brass-100/30 hover:bg-brass-100/50"}>
                <td className="px-6 py-3.5">
                  <p className="font-medium text-ink">{p.full_name || "—"}</p>
                  <p className="text-xs text-ink-soft">{p.email}</p>
                </td>
                <td className="px-4 py-3.5 text-ink-soft">
                  {p.organization_name ?? "Platform"}
                  {p.organization_name && !p.organization_approved && (
                    <span className="ml-2 rounded-full bg-brass-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-brass-600">
                      New
                    </span>
                  )}
                </td>
                <td className="px-4 py-3.5 text-ink-soft">
                  {roleLabels[p.role] ?? p.role}
                </td>
                <td className="px-4 py-3.5">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] ${
                      p.approved
                        ? "bg-evergreen-100 text-evergreen-700"
                        : "bg-brass-100 text-brass-600"
                    }`}
                  >
                    {p.approved ? "Approved" : "Pending"}
                  </span>
                </td>
                <td className="px-6 py-3.5">
                  <div className="flex items-center justify-end gap-2">
                    {!p.approved ? (
                      <>
                        <form action={approveStaff}>
                          <input type="hidden" name="id" value={p.id} />
                          <SubmitButton
                            pendingLabel="Approving…"
                            className="rounded-full bg-evergreen-800 px-4 py-1.5 text-xs font-semibold text-ivory transition-colors hover:bg-evergreen-700"
                          >
                            Approve
                          </SubmitButton>
                        </form>
                        <form action={rejectStaff}>
                          <input type="hidden" name="id" value={p.id} />
                          <SubmitButton
                            pendingLabel="Rejecting…"
                            className="rounded-full border border-ink/15 px-4 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-danger hover:text-danger"
                          >
                            Reject
                          </SubmitButton>
                        </form>
                      </>
                    ) : p.id === viewer?.userId ? (
                      <span className="text-xs font-medium text-ink-soft">
                        You
                      </span>
                    ) : (
                      <form action={startViewAs}>
                        <input type="hidden" name="id" value={p.id} />
                        <SubmitButton
                          pendingLabel="Switching…"
                          title={`View the panel as ${p.full_name || p.email}`}
                          className="rounded-full border border-evergreen-800/25 px-4 py-1.5 text-xs font-medium text-evergreen-800 transition-colors hover:bg-evergreen-800 hover:text-ivory"
                        >
                          View as
                        </SubmitButton>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
