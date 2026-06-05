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
      {/* ── Filter bar ── */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: "var(--akp-gray-400)" }}
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
            className="w-full rounded-xl border pl-10 pr-4 py-3 text-sm bg-white focus:outline-none focus:ring-2"
            style={{
              borderColor: "var(--akp-gray-200)",
              color: "var(--akp-gray-800)",
              boxShadow: "0 1px 4px rgba(10,34,64,0.04)",
            }}
          />
        </div>
      </div>

      {/* ── Filter rows ── */}
      <div className="space-y-3 mb-10">
        {/* Class year pills */}
        {allYears.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="text-[10px] font-bold tracking-[0.15em] uppercase mr-1"
              style={{ color: "var(--akp-gray-400)" }}
            >
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
                  className="px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200"
                  style={
                    isActive
                      ? {
                          background: "var(--akp-navy)",
                          color: "var(--akp-gold)",
                          boxShadow: "0 2px 8px rgba(10,34,64,0.25)",
                        }
                      : {
                          background: "var(--akp-white)",
                          color: "var(--akp-gray-600)",
                          border: "1px solid var(--akp-gray-200)",
                        }
                  }
                >
                  {year === "All" ? "All Classes" : `Class of ${year}`}
                </button>
              );
            })}
          </div>
        )}

        {/* Track / tag pills */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="text-[10px] font-bold tracking-[0.15em] uppercase mr-1"
              style={{ color: "var(--akp-gray-400)" }}
            >
              Track
            </span>
            {["All", ...allTags].map((tag) => {
              const isActive = tag === "All" ? activeTag === null : activeTag === tag;
              return (
                <button
                  key={tag}
                  onClick={() => setActiveTag(tag === "All" ? null : tag === activeTag ? null : tag)}
                  className="px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200"
                  style={
                    isActive
                      ? {
                          background: "var(--akp-navy)",
                          color: "var(--akp-gold)",
                          boxShadow: "0 2px 8px rgba(10,34,64,0.25)",
                        }
                      : {
                          background: "var(--akp-white)",
                          color: "var(--akp-gray-600)",
                          border: "1px solid var(--akp-gray-200)",
                        }
                  }
                >
                  {tag === "All" ? "All Tracks" : tag}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Results label ── */}
      <p
        className="text-xs font-semibold tracking-widest uppercase mb-6"
        style={{ color: "var(--akp-gray-400)" }}
      >
        {filtered.length === seniors.length
          ? `${seniors.length} Member${seniors.length !== 1 ? "s" : ""}`
          : `${filtered.length} of ${seniors.length} Members`}
      </p>

      {/* ── Grid ── */}
      {filtered.length === 0 ? (
        <div className="text-center py-24" style={{ color: "var(--akp-gray-400)" }}>
          <p className="text-lg mb-1">No results</p>
          <p className="text-sm">Try adjusting your search or clearing the filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <article
        className="relative overflow-hidden rounded-2xl card-shadow card-transition group-hover:card-shadow-hover group-hover:-translate-y-2"
        style={{ aspectRatio: "3 / 4" }}
      >
        {/* Photo */}
        <Image
          src={headshotUrl}
          alt={senior.name}
          fill
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />

        {/* Pledge class badge — top left */}
        <div className="absolute top-4 left-4 z-20">
          <span
            className="text-[10px] font-bold tracking-[0.15em] uppercase px-3 py-1 rounded-full"
            style={{
              background: "rgba(10,34,64,0.75)",
              color: "var(--akp-gold)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(201,168,76,0.3)",
            }}
          >
            {senior.pledgeClass}
          </span>
        </div>

        {/* Gradient overlay — always present, deepens on hover */}
        <div
          className="absolute inset-0 z-10 transition-opacity duration-500"
          style={{
            background:
              "linear-gradient(to top, rgba(8,26,52,0.97) 0%, rgba(8,26,52,0.82) 38%, rgba(8,26,52,0.35) 62%, transparent 100%)",
          }}
        />

        {/* Content layer */}
        <div className="absolute inset-0 z-20 flex flex-col justify-end p-6">
          {/* Tags — slide up on hover */}
          {senior.tags.length > 0 && (
            <div
              className="flex flex-wrap gap-1.5 mb-3 translate-y-3 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100"
            >
              {senior.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full"
                  style={{
                    background: "rgba(201,168,76,0.18)",
                    color: "var(--akp-gold-light)",
                    border: "1px solid rgba(201,168,76,0.3)",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Summary — slide up on hover */}
          {senior.summary && (
            <p
              className="text-xs leading-relaxed text-blue-100/80 mb-3 line-clamp-2 translate-y-3 opacity-0 transition-all duration-300 delay-75 group-hover:translate-y-0 group-hover:opacity-100"
            >
              {senior.summary}
            </p>
          )}

          {/* Name */}
          <h2
            className="text-2xl font-bold text-white leading-tight mb-1"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {senior.name}
          </h2>

          {/* Academics */}
          <p className="text-xs text-blue-200/70 mb-3">{academicLine}</p>

          {/* Divider */}
          <div
            className="h-px mb-3 transition-all duration-300 group-hover:opacity-100 opacity-40"
            style={{ background: "var(--akp-gold)" }}
          />

          {/* Destination */}
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-xs text-white/60 mb-0.5">{senior.destinationTitle}</p>
              <p
                className="text-sm font-semibold leading-snug"
                style={{ color: "var(--akp-gold)" }}
              >
                {senior.destinationCompany}
              </p>
            </div>
            {/* Arrow — hover only */}
            <span
              className="shrink-0 text-xs font-bold tracking-wide translate-x-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
              style={{ color: "var(--akp-gold)" }}
            >
              View →
            </span>
          </div>
        </div>

        {/* Gold border on hover */}
        <div
          className="absolute inset-0 rounded-2xl z-30 pointer-events-none opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ border: "2px solid rgba(201,168,76,0.55)" }}
        />
      </article>
    </Link>
  );
}
