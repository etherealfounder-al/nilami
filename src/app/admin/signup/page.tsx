import { SignupForm } from "@/components/admin/SignupForm";
import { Logo } from "@/components/Logo";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const supabase = await createClient();
  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name")
    .order("name");

  return (
    <main className="grid min-h-dvh place-items-center bg-evergreen-950 px-5 py-12">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-30"
        style={{
          background:
            "radial-gradient(60rem 30rem at 70% 0%, #1b6a52 0%, transparent 55%)",
        }}
      />
      <div className="relative w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo dark />
          <p className="text-sm text-ivory/60">
            Request a staff account for your institution
          </p>
        </div>
        <SignupForm organizations={orgs ?? []} />
        <p className="text-center text-xs text-ivory/40">
          Accounts are activated only after review by the platform
          administrator.
        </p>
      </div>
    </main>
  );
}
