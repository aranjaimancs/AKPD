import fs from "fs";
import path from "path";
import { requireAdmin } from "@/lib/auth";
import type { SeniorIndex } from "@/types/profile";

export const dynamic = "force-dynamic";

function getSeniors(): SeniorIndex[] {
  const indexPath = path.join(process.cwd(), "src", "data", "seniors.json");
  if (!fs.existsSync(indexPath)) return [];
  return JSON.parse(fs.readFileSync(indexPath, "utf8")) as SeniorIndex[];
}

export default async function AdminSeniorsPage() {
  await requireAdmin();
  const seniors = getSeniors();

  return (
    <main className="flex-1" style={{ background: "var(--s-page)", minHeight: "100vh" }}>
      {/* ── Breadcrumb bar ── */}
      <div style={{ background: "var(--s-0)", borderBottom: "1px solid var(--b-default)" }}>
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-2">
          <a href="/admin" className="text-[13px] transition-opacity hover:opacity-70" style={{ color: "var(--t-muted)" }}>Admin</a>
          <span style={{ color: "var(--b-strong)" }}>/</span>
          <span className="text-[13px] font-semibold" style={{ color: "var(--t-primary)" }}>Senior Profiles</span>
          <span className="ml-auto text-[12px]" style={{ color: "var(--t-faint)" }}>{seniors.length} profile{seniors.length !== 1 ? "s" : ""}</span>
          <a href="/admin/add-senior" className="btn btn-primary btn-sm">Add Senior →</a>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "var(--s-0)",
            border: "1px solid var(--b-default)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          {seniors.length === 0 ? (
            <div className="px-8 py-16 text-center">
              <p className="text-base font-bold mb-2" style={{ color: "var(--t-primary)" }}>
                No seniors yet.
              </p>
              <p className="text-sm">
                <a
                  href="/admin/add-senior"
                  style={{ color: "var(--akp-gold)", fontWeight: 600 }}
                >
                  Add the first one →
                </a>
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "var(--s-1)", borderBottom: "1px solid var(--b-default)" }}>
                  <th
                    className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-[0.08em]"
                    style={{ color: "var(--t-muted)" }}
                  >
                    Senior
                  </th>
                  <th
                    className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-[0.08em] hidden sm:table-cell"
                    style={{ color: "var(--t-muted)" }}
                  >
                    Grad
                  </th>
                  <th
                    className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-[0.08em] hidden md:table-cell"
                    style={{ color: "var(--t-muted)" }}
                  >
                    Company / Title
                  </th>
                  <th className="px-5 py-3 text-right text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--t-muted)" }}>
                    &nbsp;
                  </th>
                </tr>
              </thead>
              <tbody>
                {seniors.map((senior, i) => (
                  <tr
                    key={senior.slug}
                    style={{
                      borderTop: i > 0 ? "1px solid var(--b-subtle)" : undefined,
                    }}
                  >
                    {/* Headshot + name */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-full overflow-hidden shrink-0 flex items-center justify-center font-bold text-xs"
                          style={{ background: "var(--akp-navy)", color: "var(--akp-gold)" }}
                        >
                          {senior.headshot ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={`/seniors/${senior.slug}/${senior.headshot}`}
                              alt={senior.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            senior.name
                              .split(" ")
                              .slice(0, 2)
                              .map((w) => w[0])
                              .join("")
                              .toUpperCase()
                          )}
                        </div>
                        <div>
                          <p className="font-semibold" style={{ color: "var(--t-primary)" }}>
                            {senior.name}
                          </p>
                          <p className="text-xs" style={{ color: "var(--t-muted)" }}>
                            {senior.pledgeClass}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Grad year */}
                    <td className="px-5 py-3.5 hidden sm:table-cell" style={{ color: "var(--t-secondary)" }}>
                      {senior.gradYear}
                    </td>

                    {/* Company / Title */}
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <p className="font-semibold" style={{ color: "var(--t-primary)" }}>
                        {senior.destinationCompany}
                      </p>
                      <p className="text-xs" style={{ color: "var(--t-muted)" }}>
                        {senior.destinationTitle}
                      </p>
                    </td>

                    {/* Edit button */}
                    <td className="px-5 py-3.5 text-right">
                      <a
                        href={`/admin/edit-senior/${senior.slug}`}
                        className="btn btn-ghost btn-sm"
                      >
                        Edit
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}
