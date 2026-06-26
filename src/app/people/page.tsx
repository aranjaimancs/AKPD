import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember, getCurrentMember } from "@/lib/auth";
import PeopleClient, { type Person } from "./PeopleClient";

export const dynamic = "force-dynamic";

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  // Auth gate — redirect to /login if not a member
  await requireMember();

  const [member, { data }, params] = await Promise.all([
    getCurrentMember(),
    createAdminClient()
      .from("people")
      .select(
        "id, full_name, headshot_url, title, company, industry, location_label, latitude, longitude, grad_year, member_type, pledge_class, interests, bio, linkedin_url"
      )
      .order("full_name"),
    searchParams,
  ]);

  return (
    <PeopleClient
      people={(data ?? []) as Person[]}
      isAdmin={member?.role === "admin"}
      showTour={params.welcome === "1"}
    />
  );
}
