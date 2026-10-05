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

/**
 * The institution a not-yet-converted page filters by.
 *
 * It now reads the viewer the API resolved rather than querying Supabase, so
 * the pages still using it see the same data as the converted ones. It is a
 * stepping stone, not a design: each page that moves to the admin query module
 * stops needing it, because the API applies the scope in SQL. Delete it once
 * the last caller is gone.
 */
const NO_ORG = "00000000-0000-0000-0000-000000000000";

export async function getAdminScope(): Promise<{
  isPlatformAdmin: boolean;
  organizationId: string;
  viewingAs: import("@/lib/admin/view-as").ViewAsTarget | null;
}> {
  const viewer = await getViewer();
  if (!viewer)
    return { isPlatformAdmin: false, organizationId: NO_ORG, viewingAs: null };

  if (viewer.viewingAs) {
    return {
      isPlatformAdmin: viewer.viewingAs.organizationId === null,
      organizationId: viewer.viewingAs.organizationId ?? NO_ORG,
      viewingAs: viewer.viewingAs,
    };
  }
  return {
    isPlatformAdmin: viewer.isPlatformAdmin,
    organizationId: viewer.organizationId ?? NO_ORG,
    viewingAs: null,
  };
}
