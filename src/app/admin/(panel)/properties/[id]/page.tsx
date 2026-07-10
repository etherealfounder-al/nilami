import { notFound } from "next/navigation";
import { PropertyForm } from "@/components/admin/PropertyForm";
import { getAdminOrgContext } from "@/lib/admin/org";
import { createClient } from "@/lib/supabase/server";
import type { Property } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data }, { organizations, lockedOrg }] = await Promise.all([
    supabase
      .from("properties")
      .select("*, images:property_images(*)")
      .eq("id", id)
      .single(),
    getAdminOrgContext(),
  ]);
  if (!data) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-evergreen-900">
        Edit property
      </h1>
      <PropertyForm
        property={data as Property}
        organizations={organizations}
        lockedOrg={lockedOrg}
      />
    </div>
  );
}
