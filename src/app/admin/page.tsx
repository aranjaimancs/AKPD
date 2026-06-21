import fs from "fs";
import path from "path";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function fetchCounts() {
  const admin = createAdminClient();

  const [
    membersResult,
    adminsResult,
    peopleResult,
    onMapResult,
    fieldsResult,
    resourcesResult,
  ] = await Promise.all([
    admin.from("members").select("id", { count: "exact", head: true }),
    admin.from("members").select("id", { count: "exact", head: true }).eq("role", "admin"),
    admin.from("people").select("id", { count: "exact", head: true }),
    admin.from("people").select("id", { count: "exact", head: true }).not("latitude", "is", null),
    admin.from("recruitment_fields").select("id", { count: "exact", head: true }),
    admin.from("recruitment_resources").select("id", { count: "exact", head: true }),
  ]);

  const indexPath = path.join(process.cwd(), "src", "data", "seniors.json");
  const seniorsCount = fs.existsSync(indexPath)
    ? (JSON.parse(fs.readFileSync(indexPath, "utf8")) as unknown[]).length
    : 0;

  return {
    membersTotal: membersResult.count ?? 0,
    adminsTotal: adminsResult.count ?? 0,
    seniorsTotal: seniorsCount,
    peopleTotal: peopleResult.count ?? 0,
    onMapTotal: onMapResult.count ?? 0,
    fieldsTotal: fieldsResult.count ?? 0,
    resourcesTotal: resourcesResult.count ?? 0,
  };
}

/* Minimal SVG icons for each card — clean, no emoji */
const ICONS = {
  members: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  seniors: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
  ),
  people: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
    </svg>
  ),
  recruitment: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
};

export default async function AdminHubPage() {
  await requireAdmin();
  const counts = await fetchCounts();

  const cards = [
    {
      key: "members",
      icon: ICONS.members,
      title: "Members",
      description: "Manage who can access the portal and their permission levels.",
      stat: { value: counts.membersTotal, label: "members" },
      subStat: `${counts.adminsTotal} admin${counts.adminsTotal !== 1 ? "s" : ""}`,
      href: "/admin/members",
    },
    {
      key: "seniors",
      icon: ICONS.seniors,
      title: "Senior Profiles",
      description: "Create and edit senior profiles, timelines, and recruiting stories.",
      stat: { value: counts.seniorsTotal, label: "profiles" },
      subStat: null,
      href: "/admin/seniors",
    },
    {
      key: "people",
      icon: ICONS.people,
      title: "People Directory",
      description: "Manage the alumni network map and member directory.",
      stat: { value: counts.peopleTotal, label: "people" },
      subStat: `${counts.onMapTotal} on map`,
      href: "/admin/people",
    },
    {
      key: "recruitment",
      icon: ICONS.recruitment,
      title: "Recruitment Resources",
      description: "Organize career track guides, prep documents, and field resources.",
      stat: { value: counts.resourcesTotal, label: "resources" },
      subStat: `${counts.fieldsTotal} field${counts.fieldsTotal !== 1 ? "s" : ""}`,
      href: "/admin/recruitment",
    },
  ];

  return (
    <main className="flex-1" style={{ background: "var(--s-page)", minHeight: "100vh" }}>
      {/* ── Title bar ── */}
      <div style={{ background: "var(--s-0)", borderBottom: "1px solid var(--b-default)" }}>
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-3">
          <span className="text-[13px] font-semibold" style={{ color: "var(--t-primary)" }}>Admin</span>
          <span className="ml-auto">
            <span className="badge badge-navy">Admin access</span>
          </span>
        </div>
      </div>

      {/* ── Stats overview ── */}
      <div style={{ borderBottom: "1px solid var(--b-subtle)" }}>
        <div className="max-w-5xl mx-auto px-6 py-5 flex flex-wrap gap-8">
          {[
            { value: counts.membersTotal, label: "Total members" },
            { value: counts.seniorsTotal, label: "Senior profiles" },
            { value: counts.peopleTotal,  label: "People on map" },
            { value: counts.resourcesTotal, label: "Resources" },
          ].map(({ value, label }) => (
            <div key={label} className="stat-item">
              <span className="stat-value">{value}</span>
              <span className="stat-label">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Card grid ── */}
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cards.map((card) => (
            <a
              key={card.href}
              href={card.href}
              className="admin-hub-card group flex flex-col rounded-xl p-5 transition-all duration-200"
              style={{
                background: "var(--s-0)",
                textDecoration: "none",
              }}
            >
              {/* Icon */}
              <div
                className="w-9 h-9 flex items-center justify-center rounded-lg mb-4 shrink-0 transition-colors duration-200"
                style={{
                  background: "var(--s-1)",
                  color: "var(--t-secondary)",
                  border: "1px solid var(--b-default)",
                }}
              >
                {card.icon}
              </div>

              {/* Title + desc */}
              <p
                className="text-[15px] font-bold mb-1.5 leading-snug"
                style={{ color: "var(--t-primary)", fontFamily: "var(--font-display)" }}
              >
                {card.title}
              </p>
              <p className="text-[13px] leading-relaxed flex-1" style={{ color: "var(--t-secondary)" }}>
                {card.description}
              </p>

              {/* Stats row */}
              <div
                className="mt-4 pt-3 flex items-center justify-between"
                style={{ borderTop: "1px solid var(--b-subtle)" }}
              >
                <div className="flex items-baseline gap-2">
                  <span
                    className="text-xl font-bold"
                    style={{ color: "var(--t-primary)", fontFamily: "var(--font-display)" }}
                  >
                    {card.stat.value}
                  </span>
                  <span className="text-[12px]" style={{ color: "var(--t-muted)" }}>
                    {card.stat.label}
                    {card.subStat && ` · ${card.subStat}`}
                  </span>
                </div>
                <span
                  className="text-[12px] font-semibold transition-all duration-200 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0"
                  style={{ color: "var(--akp-gold)" }}
                >
                  Manage →
                </span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </main>
  );
}
