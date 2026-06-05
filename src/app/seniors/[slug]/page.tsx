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

  // "Sem N" or "Semester N"
  const semMatch = lower.match(/\bsem(?:ester)?\s+(\d+)\b/);
  if (semMatch) return Math.ceil(parseInt(semMatch[1]) / 2);

  // Explicit "Year N"
  const yearMatch = lower.match(/^year\s+(\d+)\b/);
  if (yearMatch) return parseInt(yearMatch[1]);

  // Academic year keywords
  if (lower.includes("freshman")) return 1;
  if (lower.includes("sophomore")) return 2;
  if (lower.includes("junior")) return 3;
  if (lower.includes("senior")) return 4;

  // Fall/Spring with calendar year — group by academic year
  // e.g. "Fall 2022" and "Spring 2023" both map to year starting 2022
  const calMatch = lower.match(/\b(19|20)(\d{2})\b/);
  if (calMatch) {
    const yr = parseInt(calMatch[0]);
    // Spring = second half of academic year (started previous fall)
    if (lower.includes("spring")) return yr * 10 + 1; // large numeric, kept in order
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

    // Start a new group when the year changes (or on first entry)
    if (yr !== currentYearNum) {
      const label =
        yr !== null && yr <= 4
          ? YEAR_NAMES[yr] ?? `Year ${yr}`
          : yr !== null
          ? `Year ${Math.ceil((yr % 10000) / 10)}` // calendar-year fallback
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
    <main className="flex-1">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="navy-texture relative overflow-hidden">
        <div
          className="pointer-events-none absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full opacity-8"
          style={{ background: "radial-gradient(circle, var(--akp-gold) 0%, transparent 70%)" }}
        />

        <div className="relative max-w-5xl mx-auto px-6 pt-10 pb-16">
          {/* Top nav row */}
          <div className="flex items-center justify-between mb-10">
            <Link
              href="/seniors"
              className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest uppercase transition-opacity hover:opacity-70"
              style={{ color: "var(--akp-gold)" }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              All Seniors
            </Link>
            {isAdmin && (
              <Link
                href={`/admin/edit-senior/${slug}`}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all hover:opacity-80"
                style={{
                  background: "rgba(201,168,76,0.15)",
                  color: "var(--akp-gold)",
                  border: "1px solid rgba(201,168,76,0.3)",
                }}
              >
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Profile
              </Link>
            )}
          </div>

          <div className="flex flex-col lg:flex-row gap-10 lg:gap-14 items-start">
            {/* ── Photo ── */}
            <div className="shrink-0">
              <div
                className="relative rounded-2xl overflow-hidden"
                style={{
                  width: 220, height: 275,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.35), 0 0 0 4px rgba(201,168,76,0.4)",
                }}
              >
                <Image src={headshotUrl} alt={profile.name} fill className="object-cover" sizes="220px" priority />
                <div
                  className="absolute inset-0"
                  style={{ background: "linear-gradient(to top, rgba(10,34,64,0.3) 0%, transparent 50%)" }}
                />
              </div>
            </div>

            {/* ── Identity ── */}
            <div className="flex-1 min-w-0 pt-1">
              <div className="flex flex-wrap items-center gap-2.5 mb-4">
                <span
                  className="text-[11px] font-bold tracking-[0.18em] uppercase px-3 py-1 rounded-full"
                  style={{
                    background: "rgba(201,168,76,0.15)",
                    color: "var(--akp-gold)",
                    border: "1px solid rgba(201,168,76,0.35)",
                  }}
                >
                  {profile.pledgeClass}
                </span>
                <span className="text-blue-300/70 text-xs">Class of {profile.gradYear}</span>
                {profile.hometown && (
                  <>
                    <span className="text-blue-300/30 text-xs">·</span>
                    <span className="text-blue-300/70 text-xs">{profile.hometown}</span>
                  </>
                )}
              </div>

              <h1
                className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-3"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {profile.name}
              </h1>

              <p className="text-blue-200/70 text-sm mb-5">{academicLine}</p>

              <div
                className="inline-block rounded-xl px-5 py-3 mb-5"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <p className="text-blue-200/60 text-xs mb-0.5">{profile.destinationTitle}</p>
                <p
                  className="font-semibold text-lg leading-tight"
                  style={{ color: "var(--akp-gold)", fontFamily: "var(--font-display)" }}
                >
                  {profile.destinationCompany}
                </p>
              </div>

              {profile.summary && (
                <p className="text-blue-100/80 leading-relaxed max-w-xl text-sm mb-5">
                  {profile.summary}
                </p>
              )}

              {profile.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-5">
                  {profile.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-3 py-1 rounded-full font-medium"
                      style={{
                        background: "rgba(201,168,76,0.12)",
                        color: "var(--akp-gold-light)",
                        border: "1px solid rgba(201,168,76,0.25)",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Contact links */}
              {hasContact && (
                <div className="flex flex-wrap gap-3">
                  {profile.linkedIn && (
                    <a
                      href={profile.linkedIn.startsWith("http") ? profile.linkedIn : `https://${profile.linkedIn}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all hover:opacity-80"
                      style={{
                        background: "rgba(10,34,64,0.5)",
                        color: "#93c5fd",
                        border: "1px solid rgba(147,197,253,0.2)",
                      }}
                    >
                      {/* LinkedIn icon */}
                      <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                      </svg>
                      LinkedIn
                    </a>
                  )}
                  {profile.email && (
                    <a
                      href={`mailto:${profile.email}`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all hover:opacity-80"
                      style={{
                        background: "rgba(10,34,64,0.5)",
                        color: "#93c5fd",
                        border: "1px solid rgba(147,197,253,0.2)",
                      }}
                    >
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
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all hover:opacity-80"
                      style={{
                        background: "rgba(10,34,64,0.5)",
                        color: "#93c5fd",
                        border: "1px solid rgba(147,197,253,0.2)",
                      }}
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
        <div className="h-px" style={{ background: "rgba(201,168,76,0.4)" }} />
        <div className="h-[3px]" style={{ background: "var(--akp-gold)" }} />
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-6 py-16 space-y-20">

        {/* Flags */}
        {profile.flags.length > 0 && (
          <div className="rounded-xl p-5 border text-sm" style={{ background: "#fffbeb", borderColor: "#fbbf24", color: "#92400e" }}>
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
            <SectionLabel>Timeline</SectionLabel>

            <div className="mt-10 space-y-10">
              {timelineGroups.map((group, gi) => (
                <div key={gi}>
                  {/* ── Year header ── */}
                  {group.label && (
                    <div className="flex items-center gap-4 mb-6">
                      <div
                        className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-extrabold"
                        style={{
                          background: "var(--akp-navy)",
                          color: "var(--akp-gold)",
                          boxShadow: "0 0 0 3px var(--akp-off-white), 0 0 0 5px rgba(10,34,64,0.15)",
                        }}
                      >
                        {group.yearNum !== null && group.yearNum <= 4 ? group.yearNum : ""}
                      </div>
                      <h3
                        className="text-lg font-extrabold shrink-0"
                        style={{ color: "var(--akp-navy)", fontFamily: "var(--font-display)" }}
                      >
                        {group.label}
                      </h3>
                      <div className="flex-1 h-px" style={{ background: "var(--akp-gray-200)" }} />
                    </div>
                  )}

                  {/* ── Semester entries within the year ── */}
                  <div className="pl-0 sm:pl-12 relative">
                    {/* Vertical line for the group */}
                    {group.entries.length > 1 && (
                      <div
                        className="hidden sm:block absolute left-[15px] top-3 bottom-3 w-px"
                        style={{ background: "var(--akp-gray-200)" }}
                      />
                    )}

                    <div className="space-y-5">
                      {group.entries.map((entry, ei) => (
                        <div key={ei} className="flex gap-0">
                          {/* Left: term label */}
                          <div
                            className="hidden sm:flex shrink-0 flex-col items-end pr-6 pt-0.5"
                            style={{ width: 160 }}
                          >
                            <span
                              className="text-[11px] font-bold tracking-wide uppercase text-right leading-snug"
                              style={{ color: "var(--akp-gold)" }}
                            >
                              {entry.term}
                            </span>
                          </div>

                          {/* Dot */}
                          <div className="hidden sm:flex flex-col items-center shrink-0" style={{ width: 32 }}>
                            <div
                              className="w-2 h-2 rounded-full shrink-0 mt-1.5 z-10"
                              style={{
                                background: "var(--akp-gold)",
                                boxShadow: "0 0 0 2px var(--akp-off-white), 0 0 0 4px rgba(201,168,76,0.2)",
                              }}
                            />
                          </div>

                          {/* Content card */}
                          <div className="flex-1 min-w-0">
                            <p className="sm:hidden text-[11px] font-bold tracking-wide uppercase mb-1.5" style={{ color: "var(--akp-gold)" }}>
                              {entry.term}
                            </p>
                            <div
                              className="rounded-xl p-4"
                              style={{
                                background: "var(--akp-white)",
                                border: "1px solid var(--akp-gray-200)",
                                boxShadow: "0 1px 4px rgba(10,34,64,0.04)",
                              }}
                            >
                              <ul className="space-y-2">
                                {entry.highlights.map((h, j) => (
                                  <li key={j} className="text-sm leading-relaxed flex gap-3" style={{ color: "var(--akp-gray-800)" }}>
                                    <span className="shrink-0 w-1.5 h-1.5 rounded-full mt-2" style={{ background: "var(--akp-gold)" }} />
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
                <SectionLabel>Recruiting</SectionLabel>
                <ul className="mt-6 space-y-3">
                  {profile.recruiting.map((r, i) => (
                    <li key={i} className="flex gap-4 rounded-xl p-4 text-sm leading-relaxed" style={{ background: "var(--akp-white)", border: "1px solid var(--akp-gray-200)" }}>
                      <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold mt-0.5" style={{ background: "var(--akp-navy)", color: "var(--akp-gold)" }}>
                        {i + 1}
                      </span>
                      <span style={{ color: "var(--akp-gray-800)" }}>{r}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {profile.programs.length > 0 && (
              <section className="md:col-span-2">
                <SectionLabel>Programs</SectionLabel>
                <div className="mt-6 flex flex-wrap gap-3">
                  {profile.programs.map((p) => (
                    <div key={p} className="rounded-xl px-4 py-2.5 text-sm font-semibold" style={{ background: "var(--akp-navy)", color: "var(--akp-gold-light)" }}>
                      {p}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ── Advice ────────────────────────────────────────────────────── */}
        {profile.advice.length > 0 && (
          <section>
            <SectionLabel>Advice for Younger Members</SectionLabel>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-5">
              {profile.advice.map((a, i) => (
                <div
                  key={i}
                  className="relative rounded-2xl p-7 overflow-hidden"
                  style={{ background: "var(--akp-navy)", boxShadow: "0 4px 24px rgba(10,34,64,0.15)" }}
                >
                  <div
                    className="absolute -top-3 left-4 text-9xl font-bold leading-none select-none pointer-events-none"
                    style={{ color: "rgba(201,168,76,0.1)", fontFamily: "var(--font-display)" }}
                    aria-hidden
                  >
                    "
                  </div>
                  <p className="relative text-base leading-relaxed italic" style={{ color: "rgba(225,235,255,0.9)", fontFamily: "var(--font-display)" }}>
                    {a}
                  </p>
                  <div className="mt-5 h-px" style={{ background: "rgba(201,168,76,0.25)" }} />
                  <p className="mt-3 text-xs font-bold tracking-widest uppercase" style={{ color: "var(--akp-gold)" }}>
                    {profile.name}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Footer nav ── */}
        <div className="pt-8 border-t flex items-center justify-between" style={{ borderColor: "var(--akp-gray-200)" }}>
          <Link
            href="/seniors"
            className="inline-flex items-center gap-2 text-sm font-semibold transition-opacity hover:opacity-70"
            style={{ color: "var(--akp-navy)" }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to all seniors
          </Link>
          {isAdmin && (
            <Link
              href={`/admin/edit-senior/${slug}`}
              className="inline-flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-70"
              style={{ color: "var(--akp-gray-600)" }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <h2 className="text-2xl font-bold shrink-0" style={{ color: "var(--akp-navy)", fontFamily: "var(--font-display)" }}>
        {children}
      </h2>
      <div className="flex-1 h-px" style={{ background: "var(--akp-gray-200)" }} />
    </div>
  );
}
