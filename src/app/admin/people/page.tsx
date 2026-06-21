import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import PeopleAdminClient, { type PersonRow } from "./PeopleAdminClient";

export const dynamic = "force-dynamic";

export default async function AdminPeoplePage() {
  await requireAdmin();

  const { data } = await createAdminClient()
    .from("people")
    .select(
      "id, full_name, headshot_url, title, company, industry, location_label, latitude, longitude, grad_year, member_type, pledge_class, linkedin_url, bio, major, interests"
    )
    .order("full_name");

  return (
    <main className="flex-1" style={{ background: "var(--s-page)", minHeight: "100vh" }}>
      {/* ── Breadcrumb bar ── */}
      <div style={{ background: "var(--s-0)", borderBottom: "1px solid var(--b-default)" }}>
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-2">
          <a href="/admin" className="text-[13px] transition-opacity hover:opacity-70" style={{ color: "var(--t-muted)" }}>Admin</a>
          <span style={{ color: "var(--b-strong)" }}>/</span>
          <span className="text-[13px] font-semibold" style={{ color: "var(--t-primary)" }}>People Directory</span>
          <span className="ml-auto text-[12px]" style={{ color: "var(--t-faint)" }}>{data?.length ?? 0} people</span>
          <a href="/people" className="btn btn-ghost btn-sm">View Map</a>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <PeopleAdminClient people={(data ?? []) as PersonRow[]} />
      </div>
    </main>
  );
}
