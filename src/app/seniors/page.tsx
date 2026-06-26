import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMember } from "@/lib/auth";
import SeniorsGrid from "@/components/SeniorsGrid";
import { SeniorIndex } from "@/types/profile";

export const dynamic = "force-dynamic";

export default async function SeniorsPage() {
  const [seniorsResult, member] = await Promise.all([
    createAdminClient()
      .from("seniors")
      .select(
        "slug, name, headshot_url, majors, minors, pledge_class, grad_year, destination_title, destination_company, tags, summary, linkedin_url, email, website"
      )
      .eq("visible", true)
      .order("grad_year", { ascending: false })
      .order("name"),
    getCurrentMember(),
  ]);

  const seniors: SeniorIndex[] = (seniorsResult.data ?? []).map((r) => ({
    slug: r.slug,
    name: r.name,
    headshot: r.headshot_url ?? "",
    majors: r.majors ?? [],
    minors: r.minors ?? [],
    pledgeClass: r.pledge_class,
    gradYear: r.grad_year,
    destinationTitle: r.destination_title,
    destinationCompany: r.destination_company,
    tags: r.tags ?? [],
    summary: r.summary,
    ...(r.linkedin_url ? { linkedIn: r.linkedin_url } : {}),
    ...(r.email ? { email: r.email } : {}),
    ...(r.website ? { website: r.website } : {}),
  }));

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
