import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { approveOpportunity, rejectOpportunity } from "@/lib/actions/opportunities";
import type { Opportunity } from "@/app/opportunities/OpportunitiesClient";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  internship: "Internship",
  "full-time": "Full-Time",
  club: "Club",
  research: "Research",
  other: "Other",
};

const TYPE_STYLES: Record<string, { bg: string; color: string }> = {
  internship:  { bg: "rgba(201,168,76,0.10)",  color: "var(--akp-gold)" },
  "full-time": { bg: "rgba(10,34,64,0.07)",    color: "var(--t-secondary)" },
  club:        { bg: "rgba(59,130,246,0.08)",  color: "#60a5fa" },
  research:    { bg: "rgba(16,185,129,0.08)",  color: "#34d399" },
  other:       { bg: "var(--s-1)",             color: "var(--t-secondary)" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function AdminOpportunitiesPage() {
  await requireAdmin();

  const admin = createAdminClient();
  const { data } = await admin
    .from("opportunities")
    .select("*")
    .eq("is_active", true)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const pending = (data ?? []) as Opportunity[];

  return (
    <main className="flex-1" style={{ background: "var(--s-page)", minHeight: "100vh" }}>
      {/* ── Title bar ── */}
      <div style={{ background: "var(--s-0)", borderBottom: "1px solid var(--b-default)" }}>
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center gap-3">
          <a
            href="/admin"
            className="text-[13px]"
            style={{ color: "var(--t-muted)", textDecoration: "none" }}
          >
            Admin
          </a>
          <span style={{ color: "var(--b-default)" }}>/</span>
          <span className="text-[13px] font-semibold" style={{ color: "var(--t-primary)" }}>
            Opportunities
          </span>
          {pending.length > 0 && (
            <span
              className="ml-1 inline-flex items-center justify-center text-[11px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: "rgba(220,38,38,0.12)", color: "#dc2626", minWidth: "20px" }}
            >
              {pending.length}
            </span>
          )}
          <span className="ml-auto">
            <span className="badge badge-navy">Admin access</span>
          </span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="mb-6">
          <h1
            className="text-[17px] font-bold mb-1"
            style={{ color: "var(--t-primary)", fontFamily: "var(--font-display)", letterSpacing: "-0.01em" }}
          >
            Pending Opportunities
          </h1>
          <p className="text-[13px]" style={{ color: "var(--t-muted)" }}>
            Review member-submitted opportunities before they appear on the board.
          </p>
        </div>

        {pending.length === 0 ? (
          <div
            className="text-center py-20 rounded-2xl"
            style={{ background: "var(--s-0)", border: "1px dashed var(--b-default)" }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ background: "rgba(16,185,129,0.10)", color: "#059669" }}
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-[15px] font-semibold mb-1" style={{ color: "var(--t-primary)" }}>
              All caught up
            </p>
            <p className="text-[13px]" style={{ color: "var(--t-muted)" }}>
              No opportunities are waiting for review.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {pending.map((opp) => {
              const typeStyle = TYPE_STYLES[opp.type] ?? TYPE_STYLES.other;
              return (
                <div
                  key={opp.id}
                  className="card p-5 flex flex-col gap-3"
                >
                  {/* Top row */}
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="text-[12px] font-medium" style={{ color: "var(--t-muted)" }}>
                          {opp.organization}
                        </p>
                        <span
                          className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: typeStyle.bg, color: typeStyle.color }}
                        >
                          {TYPE_LABELS[opp.type] ?? opp.type}
                        </span>
                        {opp.audience !== "all" && (
                          <span
                            className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full"
                            style={{
                              background: opp.audience === "students"
                                ? "rgba(59,130,246,0.08)"
                                : "rgba(168,85,247,0.08)",
                              color: opp.audience === "students" ? "#60a5fa" : "#c084fc",
                            }}
                          >
                            {opp.audience === "students" ? "Students only" : "Alumni only"}
                          </span>
                        )}
                      </div>
                      <h3
                        className="text-[15px] font-bold leading-snug"
                        style={{ color: "var(--t-primary)", fontFamily: "var(--font-display)" }}
                      >
                        {opp.title}
                      </h3>
                    </div>
                  </div>

                  {/* Description */}
                  {opp.description && (
                    <p className="text-[13px] leading-relaxed" style={{ color: "var(--t-secondary)" }}>
                      {opp.description}
                    </p>
                  )}

                  {/* Meta */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px]" style={{ color: "var(--t-muted)" }}>
                    <span>Posted by <strong style={{ color: "var(--t-secondary)" }}>{opp.posted_by_name ?? "Member"}</strong></span>
                    <span>Submitted {formatDate(opp.created_at)}</span>
                    {opp.deadline && <span>Deadline {opp.deadline}</span>}
                    {opp.link && (
                      <a
                        href={opp.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                        style={{ color: "var(--t-muted)" }}
                      >
                        View link
                      </a>
                    )}
                  </div>

                  {/* Actions */}
                  <div
                    className="flex items-center gap-2 pt-3"
                    style={{ borderTop: "1px solid var(--b-subtle)" }}
                  >
                    <form
                      action={async () => {
                        "use server";
                        await approveOpportunity(opp.id);
                      }}
                    >
                      <button
                        type="submit"
                        className="btn btn-sm"
                        style={{
                          background: "rgba(16,185,129,0.10)",
                          color: "#059669",
                          border: "1px solid rgba(16,185,129,0.2)",
                          fontWeight: 600,
                        }}
                      >
                        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Approve
                      </button>
                    </form>
                    <form
                      action={async () => {
                        "use server";
                        await rejectOpportunity(opp.id);
                      }}
                    >
                      <button
                        type="submit"
                        className="btn btn-ghost btn-sm"
                        style={{ color: "#dc2626", borderColor: "rgba(220,38,38,0.2)" }}
                      >
                        Reject
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
