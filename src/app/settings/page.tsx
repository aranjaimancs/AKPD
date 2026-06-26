import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SettingsForm from "./SettingsForm";

export const dynamic = "force-dynamic";

type Profile = {
  full_name: string | null;
  headline: string | null;
  bio: string | null;
  avatar_url: string | null;
  pledge_class: string | null;
  grad_year: number | null;
  major: string | null;
  linkedin_url: string | null;
  location_label: string | null;
  interests: string[] | null;
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  let profile: Profile = {
    full_name: null,
    headline: null,
    bio: null,
    avatar_url: null,
    pledge_class: null,
    grad_year: null,
    major: null,
    linkedin_url: null,
    location_label: null,
    interests: null,
  };

  try {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, headline, bio, avatar_url, pledge_class, grad_year, major, linkedin_url, location_label, interests")
      .eq("id", user.id)
      .maybeSingle();
    if (data) profile = data;
  } catch {}

  return (
    <main className="flex-1" style={{ background: "var(--s-page)" }}>
      {/* ── Title bar ── */}
      <div style={{ background: "var(--s-0)", borderBottom: "1px solid var(--b-default)" }}>
        <div className="max-w-2xl mx-auto px-6 py-4">
          <h1
            className="text-[17px] font-bold"
            style={{ color: "var(--t-primary)", fontFamily: "var(--font-display)", letterSpacing: "-0.01em" }}
          >
            Settings
          </h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <SettingsForm initialData={profile} email={user.email!} />
      </div>
    </main>
  );
}
