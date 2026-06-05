import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember, getCurrentMember } from "@/lib/auth";
import PeopleClient, { type Person } from "./PeopleClient";

export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  // Auth gate — redirect to /login if not a member
  await requireMember();

  const [member, { data }] = await Promise.all([
    getCurrentMember(),
    createAdminClient()
      .from("people")
      .select(
        "id, full_name, headshot_url, title, company, industry, location_label, latitude, longitude, grad_year, member_type, pledge_class"
      )
      .order("full_name"),
  ]);

  return (
    <PeopleClient
      people={(data ?? []) as Person[]}
      isAdmin={member?.role === "admin"}
    />
  );
}
