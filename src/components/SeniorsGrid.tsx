"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { SeniorIndex } from "@/types/profile";

type Props = { seniors: SeniorIndex[] };

export default function SeniorsGrid({ seniors }: Props) {
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [activeYear, setActiveYear] = useState<number | null>(null);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    seniors.forEach((s) => s.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [seniors]);

  const allYears = useMemo(() => {
    const set = new Set<number>();
    seniors.forEach((s) => set.add(s.gradYear));
    return Array.from(set).sort();
  }, [seniors]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return seniors.filter((s) => {
      const matchesText =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.destinationCompany.toLowerCase().includes(q) ||
        s.destinationTitle.toLowerCase().includes(q) ||
        s.majors.some((m) => m.toLowerCase().includes(q));
      const matchesTag = !activeTag || s.tags.includes(activeTag);
      const matchesYear = !activeYear || s.gradYear === activeYear;
      return matchesText && matchesTag && matchesYear;
    });
  }, [seniors, query, activeTag, activeYear]);

  return (
    <div>
      {/* ── Search ── */}
      <div className="relative mb-5">
        <svg
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
          style={{ color: "var(--t-muted)" }}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <circle cx="11" cy="11" r="8" />
          <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          placeholder="Search by name, company, or major…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="input pl-10"
          style={{ maxWidth: 400 }}
        />
      </div>

      {/* ── Filter pills ── */}
      <div className="space-y-2.5 mb-10">
        {allYears.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] mr-1" style={{ color: "var(--t-muted)" }}>
              Class
            </span>
            {["All", ...allYears.map(String)].map((year) => {
              const isActive = year === "All" ? activeYear === null : activeYear === parseInt(year);
              return (
                <button
                  key={year}
                  onClick={() =>
                    setActiveYear(year === "All" ? null : activeYear === parseInt(year) ? null : parseInt(year))
                  }
                  className={`pill ${isActive ? "pill-active" : ""}`}
                >
                  {year === "All" ? "All Classes" : `Class of ${year}`}
                </button>
              );
            })}
          </div>
        )}

        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] mr-1" style={{ color: "var(--t-muted)" }}>
              Track
            </span>
            {["All", ...allTags].map((tag) => {
              const isActive = tag === "All" ? activeTag === null : activeTag === tag;
              return (
                <button
                  key={tag}
                  onClick={() => setActiveTag(tag === "All" ? null : tag === activeTag ? null : tag)}
                  className={`pill ${isActive ? "pill-active" : ""}`}
                >
                  {tag === "All" ? "All Tracks" : tag}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Results count ── */}
      <p className="text-[12px] font-medium mb-6" style={{ color: "var(--t-muted)" }}>
        {filtered.length === seniors.length
          ? `${seniors.length} profile${seniors.length !== 1 ? "s" : ""}`
          : `${filtered.length} of ${seniors.length} profiles`}
      </p>

      {/* ── Grid ── */}
      {filtered.length === 0 ? (
        <div
          className="text-center py-24 rounded-2xl"
          style={{ background: "var(--s-0)", border: "1px dashed var(--b-default)" }}
        >
          <p className="text-base font-semibold mb-1" style={{ color: "var(--t-primary)" }}>No results</p>
          <p className="text-sm" style={{ color: "var(--t-muted)" }}>Try adjusting your search or clearing the filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((senior, i) => (
            <SeniorCard key={senior.slug} senior={senior} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function SeniorCard({ senior, index }: { senior: SeniorIndex; index: number }) {
  const headshotUrl = `/seniors-content/${senior.slug}/${senior.headshot}`;
  const academicLine = [
    ...senior.majors,
    ...senior.minors.map((m) => `${m} Minor`),
  ].join(" · ");

  return (
    <Link
      href={`/seniors/${senior.slug}`}
      className="group block animate-fade-up"
      style={{ animationDelay: `${Math.min(index * 50, 400)}ms` }}
    >
      <article
        className="card card-interactive overflow-hidden flex flex-col"
        style={{ borderRadius: "var(--r-xl)" }}
      >
        {/* Photo — 4:3 aspect, not full card */}
        <div className="relative overflow-hidden" style={{ aspectRatio: "4 / 3" }}>
          <Image
            src={headshotUrl}
            alt={senior.name}
            fill
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-103"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
          {/* Subtle bottom fade into card */}
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.18) 100%)",
            }}
          />
          {/* Pledge class badge */}
          <div className="absolute top-3 left-3 z-10">
            <span
              className="text-[10px] font-bold tracking-[0.12em] uppercase px-2.5 py-1 rounded-full"
              style={{
                background: "rgba(255,255,255,0.92)",
                color: "var(--akp-navy)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(255,255,255,0.5)",
              }}
            >
              {senior.pledgeClass}
            </span>
          </div>
        </div>

        {/* Info panel — always visible */}
        <div className="flex flex-col gap-3 p-5 flex-1">
          {/* Name + academic */}
          <div>
            <h2
              className="text-base font-bold leading-snug mb-0.5"
              style={{ color: "var(--t-primary)", fontFamily: "var(--font-display)" }}
            >
              {senior.name}
            </h2>
            {academicLine && (
              <p className="text-[12px] leading-relaxed" style={{ color: "var(--t-muted)" }}>
                {academicLine}
              </p>
            )}
          </div>

          {/* Tags */}
          {senior.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {senior.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="badge badge-neutral text-[10px]">
                  {tag}
                </span>
              ))}
              {senior.tags.length > 3 && (
                <span className="badge badge-neutral text-[10px]">+{senior.tags.length - 3}</span>
              )}
            </div>
          )}

          {/* Destination — anchored to bottom */}
          <div
            className="mt-auto pt-3 flex items-end justify-between gap-2"
            style={{ borderTop: "1px solid var(--b-subtle)" }}
          >
            <div>
              <p className="text-[11px] mb-0.5" style={{ color: "var(--t-muted)" }}>
                {senior.destinationTitle}
              </p>
              <p
                className="text-[13px] font-semibold leading-snug"
                style={{ color: "var(--t-primary)" }}
              >
                {senior.destinationCompany}
              </p>
            </div>
            <span
              className="text-[11px] font-semibold shrink-0 transition-all duration-200 opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0"
              style={{ color: "var(--akp-gold)" }}
            >
              View →
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
