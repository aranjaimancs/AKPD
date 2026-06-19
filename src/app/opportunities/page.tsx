import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMember } from "@/lib/auth";
import OpportunitiesClient, { type Opportunity } from "./OpportunitiesClient";

export const dynamic = "force-dynamic";

export default async function OpportunitiesPage() {
  const [member, opportunitiesResult] = await Promise.all([
    getCurrentMember(),
    createAdminClient()
      .from("opportunities")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
  ]);

  const opportunities: Opportunity[] = (opportunitiesResult.data ?? []) as Opportunity[];
  const isAdmin = member?.role === "admin";

  const counts = {
    internship: opportunities.filter((o) => o.type === "internship").length,
    "full-time": opportunities.filter((o) => o.type === "full-time").length,
    club: opportunities.filter((o) => o.type === "club").length,
    research: opportunities.filter((o) => o.type === "research").length,
  };

  return (
    <main className="flex-1">
      {/* ── Title bar ── */}
      <div style={{ background: "var(--s-0)", borderBottom: "1px solid var(--b-default)" }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1
              className="text-[17px] font-bold"
              style={{ color: "var(--t-primary)", fontFamily: "var(--font-display)", letterSpacing: "-0.01em" }}
            >
              Opportunities
            </h1>
            {opportunities.length > 0 && (
              <span className="text-[13px]" style={{ color: "var(--t-faint)" }}>
                {opportunities.length} active
                {counts.internship > 0 && ` · ${counts.internship} internship${counts.internship !== 1 ? "s" : ""}`}
                {counts["full-time"] > 0 && ` · ${counts["full-time"]} full-time`}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Board ── */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <OpportunitiesClient
          initialOpportunities={opportunities}
          currentUserId={member?.auth_user_id ?? undefined}
          isAdmin={isAdmin}
        />
      </div>
    </main>
  );
}
