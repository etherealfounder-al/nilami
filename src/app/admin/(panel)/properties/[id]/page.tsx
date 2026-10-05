import { notFound } from "next/navigation";
import { PropertyForm } from "@/components/admin/PropertyForm";
import { getAdminOrgContext } from "@/lib/admin/org";
import { getAdminProperty } from "@/lib/admin/queries";
import { NotFoundError } from "@/lib/api";
import type { Property } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // The API applies the caller's scope, so another institution's id is a 404.
  const [property, { organizations, lockedOrg }] = await Promise.all([
    getAdminProperty(id).catch((e) => {
      if (e instanceof NotFoundError) return null;
      throw e;
    }),
    getAdminOrgContext(),
  ]);
  if (!property) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-evergreen-900">
        Edit property
      </h1>
      <PropertyForm
        property={property as Property}
        organizations={organizations}
        lockedOrg={lockedOrg}
      />
    </div>
  );
}
