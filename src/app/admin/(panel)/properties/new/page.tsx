import { PropertyForm } from "@/components/admin/PropertyForm";
import { getAdminOrgContext } from "@/lib/admin/org";

export const dynamic = "force-dynamic";

export default async function NewPropertyPage() {
  const { organizations, lockedOrg } = await getAdminOrgContext();
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-evergreen-900">
        New property
      </h1>
      <PropertyForm organizations={organizations} lockedOrg={lockedOrg} />
    </div>
  );
}
