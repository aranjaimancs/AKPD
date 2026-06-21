import fs from "fs";
import path from "path";
import Image from "next/image";
import Link from "next/link";
import { Profile, TimelineEntry } from "@/types/profile";
import { notFound } from "next/navigation";
import { getCurrentMember } from "@/lib/auth";

export const dynamic = "force-dynamic";

function getProfile(slug: string): Profile | null {
  const filePath = path.join(
    process.cwd(), "content", "seniors", slug, "profile.generated.json"
  );
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as Profile;
}

// ── Timeline year-grouping ────────────────────────────────────────────────────

type YearGroup = { yearNum: number | null; label: string; entries: TimelineEntry[] };

function parseYearNum(term: string): number | null {
  const lower = term.toLowerCase().trim();
  const semMatch = lower.match(/\bsem(?:ester)?\s+(\d+)\b/);
  if (semMatch) return Math.ceil(parseInt(semMatch[1]) / 2);
  const yearMatch = lower.match(/^year\s+(\d+)\b/);
  if (yearMatch) return parseInt(yearMatch[1]);
  if (lower.includes("freshman")) return 1;
  if (lower.includes("sophomore")) return 2;
  if (lower.includes("junior")) return 3;
  if (lower.includes("senior")) return 4;
  const calMatch = lower.match(/\b(19|20)(\d{2})\b/);
  if (calMatch) {
    const yr = parseInt(calMatch[0]);
    if (lower.includes("spring")) return yr * 10 + 1;
    return yr * 10;
  }
  return null;
}

function groupTimeline(timeline: TimelineEntry[]): YearGroup[] {
  const YEAR_NAMES = ["", "Freshman Year", "Sophomore Year", "Junior Year", "Senior Year"];
  const groups: YearGroup[] = [];
  let currentGroup: YearGroup | null = null;
  let currentYearNum: number | null = undefined as unknown as null;

  for (const entry of timeline) {
    const yr = parseYearNum(entry.term);
    if (yr !== currentYearNum) {
      const label =
        yr !== null && yr <= 4
          ? YEAR_NAMES[yr] ?? `Year ${yr}`
          : yr !== null
          ? `Year ${Math.ceil((yr % 10000) / 10)}`
          : "";
      currentGroup = { yearNum: yr, label, entries: [] };
      groups.push(currentGroup);
      currentYearNum = yr;
    }
    currentGroup!.entries.push(entry);
  }
  return groups;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const profile = getProfile(slug);
  if (!profile) notFound();

  const member = await getCurrentMember();
  const isAdmin = member?.role === "admin";

  const headshotUrl = `/seniors-content/${slug}/${profile.headshot}`;
  const academicLine = [
    ...profile.majors,
    ...profile.minors.map((m) => `${m} Minor`),
  ].join(" · ");

  const timelineGroups = groupTimeline(profile.timeline);
  const hasContact = profile.linkedIn || profile.email || profile.website;

  return (
    <main className="flex-1" style={{ background: "var(--s-page)" }}>

      {/* ── Profile header ───────────────────────────────────────────────── */}
      <div style={{ background: "var(--s-0)", borderBottom: "1px solid var(--b-default)" }}>
        <div className="max-w-5xl mx-auto px-6 py-6">
          {/* Nav row */}
          <div
            className="flex items-center justify-between mb-6 pb-4"
            style={{ borderBottom: "1px solid var(--b-subtle)" }}
          >
            <Link
              href="/seniors"
              className="inline-flex items-center gap-1.5 text-[13px] font-medium transition-opacity hover:opacity-70"
              style={{ color: "var(--t-secondary)" }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              All Seniors
            </Link>
            {isAdmin && (
              <Link href={`/admin/edit-senior/${slug}`} className="btn btn-ghost btn-sm">
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Profile
              </Link>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-8 items-start">
            {/* Photo */}
            <div className="shrink-0">
              <div
                className="relative rounded-2xl overflow-hidden"
                style={{
                  width: 160,
                  height: 200,
                  boxShadow: "var(--shadow-lg)",
                  border: "1px solid var(--b-default)",
                }}
              >
                <Image
                  src={headshotUrl}
                  alt={profile.name}
                  fill
                  className="object-cover"
                  sizes="160px"
                  priority
                />
              </div>
            </div>

            {/* Identity */}
            <div className="flex-1 min-w-0 pt-1">
              {/* Meta badges */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="badge badge-navy">{profile.pledgeClass}</span>
                <span className="text-[12px]" style={{ color: "var(--t-muted)" }}>
                  Class of {profile.gradYear}
                </span>
                {profile.hometown && (
                  <>
                    <span style={{ color: "var(--b-strong)" }}>·</span>
                    <span className="text-[12px]" style={{ color: "var(--t-muted)" }}>{profile.hometown}</span>
                  </>
                )}
              </div>

              <h1
                className="text-3xl sm:text-4xl font-bold leading-tight mb-1"
                style={{
                  color: "var(--t-primary)",
                  fontFamily: "var(--font-display)",
                  letterSpacing: "-0.02em",
                }}
              >
                {profile.name}
              </h1>

              <p className="text-sm mb-4" style={{ color: "var(--t-muted)" }}>{academicLine}</p>

              {/* Destination */}
              <div
                className="inline-flex flex-col gap-0.5 rounded-xl px-4 py-2.5 mb-4"
                style={{
                  background: "var(--s-1)",
                  border: "1px solid var(--b-default)",
                }}
              >
                <p className="text-[11px] font-medium" style={{ color: "var(--t-muted)" }}>
                  {profile.destinationTitle}
                </p>
                <p
                  className="text-base font-semibold leading-tight"
                  style={{ color: "var(--t-primary)", fontFamily: "var(--font-display)" }}
                >
                  {profile.destinationCompany}
                </p>
              </div>

              {/* Summary */}
              {profile.summary && (
                <p className="text-sm leading-relaxed mb-4 max-w-lg" style={{ color: "var(--t-secondary)" }}>
                  {profile.summary}
                </p>
              )}

              {/* Tags */}
              {profile.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {profile.tags.map((tag) => (
                    <span key={tag} className="badge badge-navy">{tag}</span>
                  ))}
                </div>
              )}

              {/* Contact links */}
              {hasContact && (
                <div className="flex flex-wrap gap-2">
                  {profile.linkedIn && (
                    <a
                      href={profile.linkedIn.startsWith("http") ? profile.linkedIn : `https://${profile.linkedIn}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-ghost btn-sm"
                    >
                      <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                      </svg>
                      LinkedIn
                    </a>
                  )}
                  {profile.email && (
                    <a href={`mailto:${profile.email}`} className="btn btn-ghost btn-sm">
                      <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Email
                    </a>
                  )}
                  {profile.website && (
                    <a
                      href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-ghost btn-sm"
                    >
                      <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
                      </svg>
                      Website
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-6 py-14 space-y-16">

        {/* Flags */}
        {profile.flags.length > 0 && (
          <div
            className="rounded-xl p-4 text-sm"
            style={{ background: "#fffbeb", border: "1px solid #fbbf24", color: "#92400e" }}
          >
            <p className="font-semibold mb-2">Review requested by compiler</p>
            <ul className="space-y-1">
              {profile.flags.map((flag, i) => (
                <li key={i} className="flex gap-2"><span>•</span>{flag}</li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Timeline ──────────────────────────────────────────────────── */}
        {profile.timeline.length > 0 && (
          <section>
            <div className="section-label mb-10">
              <h2>Timeline</h2>
            </div>

            <div className="space-y-10">
              {timelineGroups.map((group, gi) => (
                <div key={gi}>
                  {/* Year header */}
                  {group.label && (
                    <div className="flex items-center gap-3 mb-5">
                      <div
                        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold"
                        style={{
                          background: "var(--akp-navy)",
                          color: "var(--akp-gold)",
                        }}
                      >
                        {group.yearNum !== null && group.yearNum <= 4 ? group.yearNum : ""}
                      </div>
                      <h3
                        className="text-sm font-bold"
                        style={{ color: "var(--t-primary)", fontFamily: "var(--font-display)" }}
                      >
                        {group.label}
                      </h3>
                      <div className="flex-1 h-px" style={{ background: "var(--b-subtle)" }} />
                    </div>
                  )}

                  {/* Semester entries */}
                  <div className="pl-0 sm:pl-10 relative space-y-4">
                    {group.entries.length > 1 && (
                      <div
                        className="hidden sm:block absolute left-[12px] top-3 bottom-3 w-px"
                        style={{ background: "var(--b-subtle)" }}
                      />
                    )}

                    {group.entries.map((entry, ei) => (
                      <div key={ei} className="flex gap-0">
                        {/* Term label */}
                        <div
                          className="hidden sm:flex shrink-0 flex-col items-end pr-5 pt-0.5"
                          style={{ width: 140 }}
                        >
                          <span
                            className="text-[11px] font-semibold tracking-wide uppercase text-right leading-snug"
                            style={{ color: "var(--t-muted)" }}
                          >
                            {entry.term}
                          </span>
                        </div>

                        {/* Dot */}
                        <div className="hidden sm:flex flex-col items-center shrink-0" style={{ width: 26 }}>
                          <div
                            className="w-2 h-2 rounded-full shrink-0 mt-1.5 z-10"
                            style={{
                              background: "var(--akp-gold)",
                              boxShadow: "0 0 0 3px var(--s-page)",
                            }}
                          />
                        </div>

                        {/* Content card */}
                        <div className="flex-1 min-w-0">
                          <p
                            className="sm:hidden text-[11px] font-semibold uppercase tracking-wide mb-1.5"
                            style={{ color: "var(--t-muted)" }}
                          >
                            {entry.term}
                          </p>
                          <div className="card p-4">
                            <ul className="space-y-2">
                              {entry.highlights.map((h, j) => (
                                <li
                                  key={j}
                                  className="text-sm leading-relaxed flex gap-3"
                                  style={{ color: "var(--t-primary)" }}
                                >
                                  <span
                                    className="shrink-0 w-1 h-1 rounded-full mt-2.5"
                                    style={{ background: "var(--akp-gold)" }}
                                  />
                                  {h}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Recruiting + Programs ──────────────────────────────────────── */}
        {(profile.recruiting.length > 0 || profile.programs.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-10">
            {profile.recruiting.length > 0 && (
              <section className="md:col-span-3">
                <div className="section-label mb-6">
                  <h2>Recruiting</h2>
                </div>
                <ul className="space-y-3">
                  {profile.recruiting.map((r, i) => (
                    <li
                      key={i}
                      className="card flex gap-4 p-4 text-sm leading-relaxed"
                    >
                      <span
                        className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5"
                        style={{ background: "var(--s-1)", color: "var(--t-secondary)" }}
                      >
                        {i + 1}
                      </span>
                      <span style={{ color: "var(--t-primary)" }}>{r}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {profile.programs.length > 0 && (
              <section className="md:col-span-2">
                <div className="section-label mb-6">
                  <h2>Programs</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {profile.programs.map((p) => (
                    <span key={p} className="badge badge-navy text-[12px] px-3 py-1.5 rounded-lg">
                      {p}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ── Advice ────────────────────────────────────────────────────── */}
        {profile.advice.length > 0 && (
          <section>
            <div className="section-label mb-8">
              <h2>Advice for Younger Members</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {profile.advice.map((a, i) => (
                <div
                  key={i}
                  className="relative rounded-2xl p-7 overflow-hidden navy-texture"
                >
                  <div
                    className="absolute -top-2 left-4 text-8xl font-bold leading-none select-none pointer-events-none"
                    style={{ color: "rgba(201,168,76,0.08)", fontFamily: "var(--font-display)" }}
                    aria-hidden
                  >
                    "
                  </div>
                  <p
                    className="relative text-[14px] leading-relaxed italic"
                    style={{ color: "rgba(225,235,255,0.88)", fontFamily: "var(--font-display)" }}
                  >
                    {a}
                  </p>
                  <div className="mt-5 pt-3" style={{ borderTop: "1px solid rgba(201,168,76,0.15)" }}>
                    <p className="text-[11px] font-bold tracking-[0.1em] uppercase" style={{ color: "rgba(201,168,76,0.7)" }}>
                      {profile.name}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Footer nav ── */}
        <div
          className="pt-8 flex items-center justify-between"
          style={{ borderTop: "1px solid var(--b-subtle)" }}
        >
          <Link
            href="/seniors"
            className="inline-flex items-center gap-2 text-sm font-medium transition-opacity hover:opacity-70"
            style={{ color: "var(--t-secondary)" }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to all seniors
          </Link>
          {isAdmin && (
            <Link
              href={`/admin/edit-senior/${slug}`}
              className="btn btn-ghost btn-sm"
            >
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Profile
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
