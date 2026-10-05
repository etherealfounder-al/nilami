import { getViewer } from "@/lib/admin/view-as";

/**
 * The institution picker's options, and the one it locks to.
 *
 * getAdminScope() used to live beside this and returned the institution every
 * admin query then had to remember to filter by. It is gone: the API resolves
 * the scope from the caller's token and applies it in SQL, so a page cannot
 * leak another institution's rows by forgetting a predicate.
 */
export async function getAdminOrgContext(): Promise<{
  organizations: { id: string; name: string }[];
  lockedOrg: { id: string; name: string } | null;
}> {
  const viewer = await getViewer();
  if (!viewer) return { organizations: [], lockedOrg: null };

  // While proxying into a staff member, the form locks to their institution.
  const effectiveOrgId = viewer.viewingAs
    ? viewer.viewingAs.organizationId
    : viewer.organizationId;

  return {
    organizations: viewer.organizations,
    lockedOrg: effectiveOrgId
      ? viewer.organizations.find((o) => o.id === effectiveOrgId) ?? null
      : null,
  };
}
