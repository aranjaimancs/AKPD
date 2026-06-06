import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import PeopleAdminClient, { type PersonRow } from "./PeopleAdminClient";

export const dynamic = "force-dynamic";

export default async function AdminPeoplePage() {
  await requireAdmin();

  const { data } = await createAdminClient()
    .from("people")
    .select(
      "id, full_name, headshot_url, title, company, industry, location_label, latitude, longitude, grad_year, member_type, pledge_class, linkedin_url, bio, major"
    )
    .order("full_name");

  return (
    <div
      className="min-h-screen px-4 py-10 sm:px-8"
      style={{ background: "var(--akp-off-white)" }}
    >
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <a
              href="/admin"
              className="inline-block text-xs font-semibold mb-2 transition-opacity hover:opacity-70"
              style={{ color: "var(--akp-gold)" }}
            >
              ← Admin
            </a>
            <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "var(--akp-gold)" }}>
              Admin
            </p>
            <h1
              className="text-3xl font-extrabold"
              style={{ color: "var(--akp-navy)", fontFamily: "var(--font-display)" }}
            >
              People Directory
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--akp-gray-600)" }}>
              {data?.length ?? 0} people — locations are geocoded automatically when you save
            </p>
          </div>
          <a
            href="/people"
            className="text-sm font-semibold px-4 py-2 rounded-xl transition-opacity hover:opacity-80"
            style={{ background: "var(--akp-navy)", color: "var(--akp-gold)" }}
          >
            ← View Map
          </a>
        </div>

        <PeopleAdminClient people={(data ?? []) as PersonRow[]} />
      </div>
    </div>
  );
}
