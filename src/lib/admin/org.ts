import { createClient } from "@/lib/supabase/server";

export async function getAdminOrgContext(): Promise<{
  organizations: { id: string; name: string }[];
  lockedOrg: { id: string; name: string } | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: orgs }, { data: profile }] = await Promise.all([
    supabase.from("organizations").select("id, name").order("name"),
    supabase
      .from("profiles")
      .select("organization_id, organization:organizations(id, name)")
      .eq("id", user!.id)
      .single(),
  ]);
  const locked = (profile?.organization as unknown as { id: string; name: string } | null) ?? null;
  return { organizations: orgs ?? [], lockedOrg: locked };
}
