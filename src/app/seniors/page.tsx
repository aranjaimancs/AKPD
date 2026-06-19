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
      {/* ── Title bar ── */}
      <div style={{ background: "var(--s-0)", borderBottom: "1px solid var(--b-default)" }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1
              className="text-[17px] font-bold"
              style={{ color: "var(--t-primary)", fontFamily: "var(--font-display)", letterSpacing: "-0.01em" }}
            >
              Senior Profiles
            </h1>
            {seniors.length > 0 && (
              <span className="text-[13px]" style={{ color: "var(--t-faint)" }}>
                {seniors.length} profiles · {companies} companies · {allTags.size} tracks
              </span>
            )}
          </div>
          {isAdmin && (
            <Link href="/admin/add-senior" className="btn btn-primary btn-sm">
              + Add Senior
            </Link>
          )}
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="max-w-6xl mx-auto px-6 py-10">
        <SeniorsGrid seniors={seniors} />
      </div>
    </main>
  );
}
