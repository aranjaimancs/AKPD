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

  return (
    <main className="flex-1">
      {/* ── Hero ── */}
      <div className="navy-texture relative overflow-hidden">
        <div
          className="pointer-events-none absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, var(--akp-gold) 0%, transparent 70%)" }}
        />
        <div className="relative max-w-6xl mx-auto px-6 pt-16 pb-20">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-px w-8" style={{ background: "var(--akp-gold)" }} />
            <span
              className="text-xs font-bold tracking-[0.2em] uppercase"
              style={{ color: "var(--akp-gold)" }}
            >
              Alpha Kappa Psi · AKPD
            </span>
          </div>

          <h1
            className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.05] text-white mb-6"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Opportunities
            <br />
            <span style={{ color: "var(--akp-gold)" }}>Board.</span>
          </h1>
          <p className="text-blue-200 text-lg max-w-lg leading-relaxed">
            Internships, full-time roles, clubs, and research openings
            shared by members — for members.
          </p>
        </div>

        {/* Stats strip */}
        <div className="border-t" style={{ borderColor: "rgba(201,168,76,0.2)" }}>
          <div className="max-w-6xl mx-auto px-6 py-5 flex gap-8">
            <div>
              <p className="text-2xl font-extrabold text-white">{opportunities.length}</p>
              <p className="text-xs uppercase tracking-wide" style={{ color: "var(--akp-gold)" }}>
                Active listings
              </p>
            </div>
            {(["internship", "full-time", "club", "research"] as const).map((t) => {
              const count = opportunities.filter((o) => o.type === t).length;
              if (count === 0) return null;
              return (
                <div key={t}>
                  <p className="text-2xl font-extrabold text-white">{count}</p>
                  <p className="text-xs uppercase tracking-wide capitalize" style={{ color: "var(--akp-gold)" }}>
                    {t === "full-time" ? "Full-time" : t}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="h-[3px]" style={{ background: "var(--akp-gold)" }} />
      </div>

      {/* ── Board ── */}
      <div className="max-w-6xl mx-auto px-6 py-14">
        <OpportunitiesClient
          initialOpportunities={opportunities}
          currentUserId={member?.auth_user_id ?? undefined}
          isAdmin={isAdmin}
        />
      </div>
    </main>
  );
}
