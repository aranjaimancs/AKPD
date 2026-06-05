import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SettingsForm from "./SettingsForm";

export const dynamic = "force-dynamic";

type Profile = {
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  pledge_class: string | null;
  grad_year: number | null;
  major: string | null;
  linkedin_url: string | null;
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  let profile: Profile = {
    full_name: null,
    bio: null,
    avatar_url: null,
    pledge_class: null,
    grad_year: null,
    major: null,
    linkedin_url: null,
  };

  try {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, bio, avatar_url, pledge_class, grad_year, major, linkedin_url")
      .eq("id", user.id)
      .maybeSingle();
    if (data) profile = data;
  } catch {}

  return (
    <main className="flex-1">
      {/* Hero */}
      <div className="navy-texture relative overflow-hidden">
        <div className="relative max-w-3xl mx-auto px-6 pt-10 pb-12">
          <h1
            className="text-3xl font-extrabold text-white mb-1"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Profile & Settings
          </h1>
          <p className="text-blue-200/70 text-sm">
            Update your photo, name, and profile info.
          </p>
        </div>
        <div className="h-[3px]" style={{ background: "var(--akp-gold)" }} />
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <SettingsForm
          initialData={profile}
          email={user.email!}
        />
      </div>
    </main>
  );
}
