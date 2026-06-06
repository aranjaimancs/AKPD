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
    <div
      className="min-h-screen px-4 py-10 sm:px-8"
      style={{ background: "var(--akp-off-white)" }}
    >
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <a
              href="/admin"
              className="inline-block text-xs font-semibold mb-2 transition-opacity hover:opacity-70"
              style={{ color: "var(--akp-gold)" }}
            >
              ← Admin
            </a>
            <p
              className="text-xs font-bold uppercase tracking-widest mb-1"
              style={{ color: "var(--akp-gold)" }}
            >
              Admin
            </p>
            <h1
              className="text-3xl font-extrabold"
              style={{ color: "var(--akp-navy)", fontFamily: "var(--font-display)" }}
            >
              Senior Profiles
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--akp-gray-600)" }}>
              {seniors.length} profile{seniors.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/admin/add-senior"
              className="text-sm font-semibold px-4 py-2 rounded-xl transition-opacity hover:opacity-80"
              style={{ background: "var(--akp-gold)", color: "var(--akp-navy)" }}
            >
              Add Senior →
            </a>
          </div>
        </div>

        {/* Table */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "var(--akp-white)",
            border: "1.5px solid var(--akp-navy)",
            boxShadow: "0 2px 8px rgba(10,34,64,0.08)",
          }}
        >
          {seniors.length === 0 ? (
            <div
              className="px-8 py-16 text-center"
              style={{ color: "var(--akp-gray-400)" }}
            >
              <p className="text-lg font-bold mb-2" style={{ color: "var(--akp-navy)" }}>
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
                <tr style={{ borderBottom: "1px solid var(--akp-gray-200)" }}>
                  <th
                    className="px-5 py-3 text-left text-xs font-bold uppercase tracking-widest"
                    style={{ color: "var(--akp-gray-400)" }}
                  >
                    Senior
                  </th>
                  <th
                    className="px-5 py-3 text-left text-xs font-bold uppercase tracking-widest hidden sm:table-cell"
                    style={{ color: "var(--akp-gray-400)" }}
                  >
                    Grad
                  </th>
                  <th
                    className="px-5 py-3 text-left text-xs font-bold uppercase tracking-widest hidden md:table-cell"
                    style={{ color: "var(--akp-gray-400)" }}
                  >
                    Company / Title
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-widest" style={{ color: "var(--akp-gray-400)" }}>
                    &nbsp;
                  </th>
                </tr>
              </thead>
              <tbody>
                {seniors.map((senior, i) => (
                  <tr
                    key={senior.slug}
                    style={{
                      borderTop: i > 0 ? "1px solid var(--akp-gray-200)" : undefined,
                    }}
                  >
                    {/* Headshot + name */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-full overflow-hidden shrink-0 flex items-center justify-center font-bold text-sm"
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
                          <p className="font-bold" style={{ color: "var(--akp-navy)" }}>
                            {senior.name}
                          </p>
                          <p className="text-xs" style={{ color: "var(--akp-gray-400)" }}>
                            {senior.pledgeClass}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Grad year */}
                    <td className="px-5 py-3 hidden sm:table-cell" style={{ color: "var(--akp-gray-600)" }}>
                      {senior.gradYear}
                    </td>

                    {/* Company / Title */}
                    <td className="px-5 py-3 hidden md:table-cell">
                      <p className="font-semibold" style={{ color: "var(--akp-navy)" }}>
                        {senior.destinationCompany}
                      </p>
                      <p className="text-xs" style={{ color: "var(--akp-gray-400)" }}>
                        {senior.destinationTitle}
                      </p>
                    </td>

                    {/* Edit button */}
                    <td className="px-5 py-3 text-right">
                      <a
                        href={`/admin/edit-senior/${senior.slug}`}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
                        style={{ background: "rgba(201,168,76,0.12)", color: "var(--akp-gold)" }}
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
    </div>
  );
}
