import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Profile, TimelineEntry } from "@/types/profile";
import SeniorForm from "@/components/SeniorForm";

export const dynamic = "force-dynamic";

async function getProfile(slug: string): Promise<Profile | null> {
  if (!slug || slug.includes("..")) return null;
  const { data } = await createAdminClient()
    .from("seniors")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;
  return {
    slug: data.slug,
    name: data.name,
    headshot: data.headshot_url ?? "",
    hometown: data.hometown ?? null,
    majors: data.majors ?? [],
    minors: data.minors ?? [],
    pledgeClass: data.pledge_class,
    gradYear: data.grad_year,
    destinationTitle: data.destination_title,
    destinationCompany: data.destination_company,
    tags: data.tags ?? [],
    summary: data.summary,
    timeline: (data.timeline ?? []) as TimelineEntry[],
    programs: data.programs ?? [],
    recruiting: data.recruiting ?? [],
    advice: data.advice ?? [],
    flags: data.flags ?? [],
    ...(data.linkedin_url ? { linkedIn: data.linkedin_url } : {}),
    ...(data.email ? { email: data.email } : {}),
    ...(data.website ? { website: data.website } : {}),
  };
}

export default async function EditSeniorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireAdmin();

  const { slug } = await params;
  const profile = await getProfile(slug);
  if (!profile) notFound();

  return (
    <SeniorForm
      mode="edit"
      initialData={profile}
      existingHeadshotUrl={profile.headshot || undefined}
    />
  );
}
