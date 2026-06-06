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

export default async function AdminHubPage() {
  await requireAdmin();
  const counts = await fetchCounts();

  const cards = [
    {
      icon: "👥",
      title: "Members",
      description: "Who can access the site and their roles.",
      stats: `${counts.membersTotal} members · ${counts.adminsTotal} admins`,
      href: "/admin/members",
    },
    {
      icon: "🎓",
      title: "Seniors",
      description: "Senior profiles, timelines, and recruiting stories.",
      stats: `${counts.seniorsTotal} profiles`,
      href: "/admin/seniors",
    },
    {
      icon: "🗺️",
      title: "People Directory",
      description: "Alumni network map and profiles.",
      stats: `${counts.peopleTotal} people · ${counts.onMapTotal} on map`,
      href: "/admin/people",
    },
    {
      icon: "📚",
      title: "Recruitment Resources",
      description: "Field guides, prep docs, and career track resources.",
      stats: `${counts.fieldsTotal} fields · ${counts.resourcesTotal} resources`,
      href: "/admin/recruitment",
    },
  ];

  return (
    <main className="flex-1" style={{ background: "var(--akp-off-white)", minHeight: "100vh" }}>
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
              Alpha Kappa Psi · Admin
            </span>
          </div>

          <h1
            className="text-5xl sm:text-6xl font-extrabold leading-[1.05] text-white mb-6"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Admin
            <br />
            <span style={{ color: "var(--akp-gold)" }}>Dashboard.</span>
          </h1>
          <p className="text-blue-200 text-lg max-w-lg leading-relaxed">
            Everything in one place.
          </p>
        </div>
        <div className="h-[3px]" style={{ background: "var(--akp-gold)" }} />
      </div>

      {/* ── Card grid ── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {cards.map((card) => (
            <a
              key={card.href}
              href={card.href}
              className="group flex flex-col rounded-2xl p-6 transition-all duration-200"
              style={{
                background: "var(--akp-white)",
                border: "1.5px solid var(--akp-navy)",
                boxShadow: "var(--card-shadow, 0 2px 8px rgba(10,34,64,0.08))",
                textDecoration: "none",
              }}
              onMouseEnter={() => {}}
            >
              {/* Icon square */}
              <div
                className="w-11 h-11 flex items-center justify-center rounded-xl mb-4 text-xl shrink-0"
                style={{ background: "var(--akp-navy)" }}
              >
                {card.icon}
              </div>

              {/* Title + description */}
              <p
                className="text-lg font-extrabold mb-1"
                style={{ color: "var(--akp-navy)", fontFamily: "var(--font-display)" }}
              >
                {card.title}
              </p>
              <p className="text-sm leading-relaxed flex-1" style={{ color: "var(--akp-gray-600)" }}>
                {card.description}
              </p>

              {/* Stats */}
              <p className="mt-4 text-xs font-semibold" style={{ color: "var(--akp-gray-400)" }}>
                {card.stats}
              </p>

              {/* Manage link */}
              <div className="mt-4 flex justify-end">
                <span
                  className="text-sm font-bold transition-opacity group-hover:opacity-70"
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
