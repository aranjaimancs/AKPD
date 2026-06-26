import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import OnboardingWizard from "./OnboardingWizard";

export const dynamic = "force-dynamic";

export type OnboardingProfile = {
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

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // If their profile is already complete, skip onboarding
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "full_name, headline, bio, avatar_url, pledge_class, grad_year, major, linkedin_url, location_label, interests"
    )
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.full_name) redirect("/people");

  const initial: OnboardingProfile = {
    full_name: profile?.full_name ?? null,
    headline: profile?.headline ?? null,
    bio: profile?.bio ?? null,
    avatar_url: profile?.avatar_url ?? null,
    pledge_class: profile?.pledge_class ?? null,
    grad_year: profile?.grad_year ?? null,
    major: profile?.major ?? null,
    linkedin_url: profile?.linkedin_url ?? null,
    location_label: profile?.location_label ?? null,
    interests: profile?.interests ?? null,
  };

  return (
    <OnboardingWizard
      email={user.email!}
      initialData={initial}
    />
  );
}
