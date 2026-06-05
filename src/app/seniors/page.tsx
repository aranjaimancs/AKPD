import fs from "fs";
import path from "path";
import Link from "next/link";
import { SeniorIndex } from "@/types/profile";
import { getCurrentMember } from "@/lib/auth";
import SeniorsGrid from "@/components/SeniorsGrid";

export const dynamic = "force-dynamic";

function getSeniors(): SeniorIndex[] {
  const indexPath = path.join(process.cwd(), "src", "data", "seniors.json");
  if (!fs.existsSync(indexPath)) return [];
  return JSON.parse(fs.readFileSync(indexPath, "utf8")) as SeniorIndex[];
}

export default async function SeniorsPage() {
  const [seniors, member] = await Promise.all([
    Promise.resolve(getSeniors()),
    getCurrentMember(),
  ]);

  const isAdmin = member?.role === "admin";
  const companies = new Set(seniors.map((s) => s.destinationCompany)).size;
  const allTags = new Set(seniors.flatMap((s) => s.tags));

  return (
    <main className="flex-1">
      {/* ── Hero ── */}
      <div className="navy-texture relative overflow-hidden">
        <div
          className="pointer-events-none absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full opacity-10"
          style={{
            background: "radial-gradient(circle, var(--akp-gold) 0%, transparent 70%)",
          }}
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
            Senior
            <br />
            <span style={{ color: "var(--akp-gold)" }}>Profiles.</span>
          </h1>

          <p className="text-blue-200 text-lg max-w-lg leading-relaxed mb-10">
            Timelines, recruiting paths, and hard-won advice from our
            graduating members — so the next class doesn't have to figure it
            out alone.
          </p>

          {/* Add Senior — admins only */}
          {isAdmin && (
            <Link
              href="/admin/add-senior"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold mb-12 transition-all duration-200 hover:opacity-90 hover:-translate-y-0.5"
              style={{ background: "var(--akp-gold)", color: "var(--akp-navy)" }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Senior
            </Link>
          )}

          {/* Stats row */}
          {seniors.length > 0 && (
            <div className="flex flex-wrap gap-x-10 gap-y-4">
              {[
                { value: seniors.length, label: "Seniors" },
                { value: companies, label: "Companies" },
                { value: allTags.size, label: "Tracks" },
              ].map(({ value, label }) => (
                <div key={label}>
                  <div
                    className="text-3xl font-bold text-white"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {value}
                  </div>
                  <div
                    className="text-xs font-semibold tracking-widest uppercase mt-0.5"
                    style={{ color: "var(--akp-gold)" }}
                  >
                    {label}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="h-1" style={{ background: "var(--akp-gold)" }} />
      </div>

      {/* ── Grid ── */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <SeniorsGrid seniors={seniors} />
      </div>
    </main>
  );
}
