import { redirect } from "next/navigation";
import { approveStaff, rejectStaff } from "@/lib/admin/actions";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const roleLabels: Record<string, string> = {
  admin: "Platform Admin",
  manager: "Recovery Manager",
  officer: "Recovery Officer",
  valuer: "Panel Valuer",
};

export default async function AdminStaffPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user!.id)
    .single();
  if (me?.organization_id !== null) redirect("/admin");

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, approved, created_at, organization:organizations(name)")
    .order("approved", { ascending: true })
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as unknown as {
    id: string;
    full_name: string;
    email: string;
    role: string;
    approved: boolean;
    created_at: string;
    organization: { name: string } | null;
  }[];
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

      <div className="overflow-hidden rounded-2xl border border-ink/8 bg-ivory shadow-card">
        <table className="w-full text-sm">
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
                  {p.organization?.name ?? "Platform"}
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
                  {!p.approved && (
                    <div className="flex items-center justify-end gap-2">
                      <form action={approveStaff}>
                        <input type="hidden" name="id" value={p.id} />
                        <button className="rounded-full bg-evergreen-800 px-4 py-1.5 text-xs font-semibold text-ivory transition-colors hover:bg-evergreen-700">
                          Approve
                        </button>
                      </form>
                      <form action={rejectStaff}>
                        <input type="hidden" name="id" value={p.id} />
                        <button className="rounded-full border border-ink/15 px-4 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-danger hover:text-danger">
                          Reject
                        </button>
                      </form>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
