import { redirect } from "next/navigation";
import { InstitutionForm } from "@/components/admin/InstitutionForm";
import { getInstitution, getInstitutionOptions } from "@/lib/admin/queries";
import { getViewer } from "@/lib/admin/view-as";
import type { Organization } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Branding and contact details for an institution. Institution staff land on
 * their own; a platform admin picks one, since they belong to none.
 */
export default async function InstitutionPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const { org: requested } = await searchParams;
  const viewer = await getViewer();
  if (!viewer) redirect("/admin/login");

  const isPlatformAdmin = viewer.viewingAs
    ? viewer.viewingAs.organizationId === null
    : viewer.isPlatformAdmin;
  const organizationId = viewer.viewingAs
    ? viewer.viewingAs.organizationId
    : viewer.organizationId;

  const options = await getInstitutionOptions();

  // Only a platform admin may choose. For everyone else ?org= previously fell
  // through silently, so the address bar could name one institution while the
  // page showed another — indistinguishable from the page ignoring the change.
  // Send them to the clean URL instead, so it never describes something false.
  if (!isPlatformAdmin && requested && requested !== organizationId) {
    redirect("/admin/institution");
  }

  // The API resolves this too, and ignores a foreign id for staff; asking for
  // the right one here only keeps the picker and the form in agreement.
  const targetId = isPlatformAdmin ? requested || options[0]?.id : organizationId;
  if (!targetId) redirect("/admin");

  const data = await getInstitution(targetId);
  if (!data) redirect("/admin");

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-evergreen-900">
          Institution
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          The logo and contact details shown on every listing you publish.
        </p>
      </div>
      <InstitutionForm
        org={data as Organization}
        organizations={isPlatformAdmin ? options : []}
      />
    </div>
  );
}
