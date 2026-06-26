"use client";

import dynamic from "next/dynamic";
import { useRef, useState, useCallback, useMemo } from "react";
import type { Map as LeafletMap, LatLngBounds } from "leaflet";
import type { PersonPin } from "./PeopleMapInner";
import WelcomeTour from "@/components/WelcomeTour";

const PeopleMapInner = dynamic(() => import("./PeopleMapInner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center" style={{ background: "var(--s-1)" }}>
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-6 h-6 rounded-full border-2 animate-spin"
          style={{ borderColor: "var(--akp-navy)", borderTopColor: "transparent" }}
        />
        <span className="text-[13px]" style={{ color: "var(--t-muted)" }}>Loading map…</span>
      </div>
    </div>
  ),
});

// ── Types ─────────────────────────────────────────────────────────────────────

export type Person = {
  id: string;
  full_name: string;
  headshot_url: string | null;
  headline: string | null;
  title: string | null;
  company: string | null;
  industry: string | null;
  location_label: string | null;
  latitude: number | null;
  longitude: number | null;
  grad_year: number | null;
  member_type: string | null;
  pledge_class: string | null;
  interests: string[] | null;
  bio: string | null;
  linkedin_url: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

// ── PersonCard (left sidebar) ─────────────────────────────────────────────────

function PersonCard({
  person,
  selected,
  inViewport,
  onClick,
  cardRef,
}: {
  person: Person;
  selected: boolean;
  inViewport: boolean;
  onClick: () => void;
  cardRef: (el: HTMLDivElement | null) => void;
}) {
  const interests = person.interests ?? [];
  const visibleInterests = interests.slice(0, 3);
  const extraCount = interests.length - visibleInterests.length;

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      className="flex gap-3 px-3 py-3 rounded-lg cursor-pointer select-none transition-all duration-150"
      style={{
        background: selected ? "var(--s-1)" : "transparent",
        borderLeft: `2.5px solid ${selected ? "var(--akp-gold)" : "transparent"}`,
      }}
    >
      {/* Avatar — 48px, photo-first */}
      <div
        className="shrink-0 w-12 h-12 rounded-full overflow-hidden flex items-center justify-center font-semibold text-[13px]"
        style={{
          background: "var(--akp-navy)",
          color: "var(--akp-gold)",
          border: `2px solid ${selected ? "var(--akp-gold)" : "var(--b-default)"}`,
          boxShadow: selected ? "0 0 0 3px rgba(201,168,76,0.15)" : "none",
          transition: "border-color 0.15s, box-shadow 0.15s",
          flexShrink: 0,
        }}
      >
        {person.headshot_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={person.headshot_url}
            alt={person.full_name}
            className="w-full h-full object-cover"
          />
        ) : (
          getInitials(person.full_name)
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        {/* Name + viewport dot */}
        <div className="flex items-center gap-1.5">
          <p
            className="text-[13px] font-semibold truncate leading-snug"
            style={{ color: "var(--t-primary)" }}
          >
            {person.full_name}
          </p>
          {inViewport && person.latitude != null && (
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: "#22c55e" }}
              title="Visible on map"
            />
          )}
        </div>

        {/* Headline (user-set) or admin title · company fallback */}
        {(person.headline || person.title || person.company) && (
          <p className="text-[12px] truncate mt-0.5" style={{ color: "var(--t-secondary)" }}>
            {person.headline ?? [person.title, person.company].filter(Boolean).join(" · ")}
          </p>
        )}

        {/* Location */}
        {person.location_label && (
          <p className="text-[11px] mt-0.5 truncate" style={{ color: "var(--t-muted)" }}>
            {person.location_label}
          </p>
        )}

        {/* Badges row */}
        <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
          {person.member_type && (
            <span
              className="badge"
              style={
                person.member_type === "alumni"
                  ? { background: "rgba(201,168,76,0.1)", color: "var(--akp-gold)", fontSize: 10 }
                  : { background: "rgba(10,34,64,0.07)", color: "var(--t-secondary)", fontSize: 10 }
              }
            >
              {person.member_type === "alumni" ? "Alumni" : "Current"}
            </span>
          )}
          {person.grad_year && (
            <span className="text-[10px]" style={{ color: "var(--t-faint)" }}>
              &apos;{String(person.grad_year).slice(2)}
            </span>
          )}
        </div>

        {/* Interest pills */}
        {visibleInterests.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {visibleInterests.map((interest) => (
              <span
                key={interest}
                className="badge"
                style={{
                  fontSize: 9,
                  padding: "2px 6px",
                  background: "var(--s-2)",
                  color: "var(--t-secondary)",
                  border: "1px solid var(--b-subtle)",
                }}
              >
                {interest}
              </span>
            ))}
            {extraCount > 0 && (
              <span
                className="badge"
                style={{
                  fontSize: 9,
                  padding: "2px 6px",
                  background: "var(--s-2)",
                  color: "var(--t-muted)",
                  border: "1px solid var(--b-subtle)",
                }}
              >
                +{extraCount}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Profile detail card (floating in map area) ────────────────────────────────

function ProfileDetailCard({
  person,
  onClose,
}: {
  person: Person;
  onClose: () => void;
}) {
  const interests = person.interests ?? [];

  const linkedinHref = person.linkedin_url
    ? person.linkedin_url.startsWith("http")
      ? person.linkedin_url
      : `https://${person.linkedin_url}`
    : null;

  return (
    <div
      className="absolute bottom-4 left-4 z-[1001] w-[296px] animate-fadeUp"
      style={{
        pointerEvents: "auto",
      }}
    >
      <div
        className="card overflow-hidden"
        style={{ boxShadow: "var(--shadow-xl)" }}
      >
        {/* Gold stripe */}
        <div className="h-0.5 w-full" style={{ background: "linear-gradient(90deg, var(--akp-navy), var(--akp-gold))" }} />

        {/* Header */}
        <div className="p-4 pb-3">
          <div className="flex items-start gap-3">
            {/* Photo */}
            <div
              className="shrink-0 w-14 h-14 rounded-full overflow-hidden flex items-center justify-center font-bold text-[15px]"
              style={{
                background: "var(--akp-navy)",
                color: "var(--akp-gold)",
                border: "2.5px solid var(--akp-gold)",
                boxShadow: "0 0 0 3px rgba(201,168,76,0.15)",
              }}
            >
              {person.headshot_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={person.headshot_url}
                  alt={person.full_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                getInitials(person.full_name)
              )}
            </div>

            {/* Name + role */}
            <div className="flex-1 min-w-0 pt-0.5">
              <p
                className="font-bold text-[15px] leading-snug"
                style={{ color: "var(--t-primary)", fontFamily: "var(--font-display)" }}
              >
                {person.full_name}
              </p>
              {/* Headline takes priority; fall back to title · company */}
              {(person.headline || person.title || person.company) && (
                <p className="text-[12px] mt-0.5 leading-snug" style={{ color: "var(--t-secondary)" }}>
                  {person.headline ?? [person.title, person.company].filter(Boolean).join(" · ")}
                </p>
              )}
              {/* Type + year */}
              <div className="flex items-center gap-1.5 mt-1.5">
                {person.member_type && (
                  <span
                    className="badge"
                    style={
                      person.member_type === "alumni"
                        ? { background: "rgba(201,168,76,0.12)", color: "var(--akp-gold)", fontSize: 10 }
                        : { background: "rgba(10,34,64,0.07)", color: "var(--t-secondary)", fontSize: 10 }
                    }
                  >
                    {person.member_type === "alumni" ? "Alumni" : "Current"}
                  </span>
                )}
                {person.pledge_class && (
                  <span className="text-[10px]" style={{ color: "var(--t-muted)" }}>
                    {person.pledge_class}
                  </span>
                )}
                {person.grad_year && (
                  <span className="text-[10px]" style={{ color: "var(--t-faint)" }}>
                    &apos;{String(person.grad_year).slice(2)}
                  </span>
                )}
              </div>
            </div>

            {/* Close */}
            <button
              onClick={onClose}
              className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md"
              style={{ color: "var(--t-muted)" }}
              aria-label="Close"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Divider */}
        <div style={{ borderTop: "1px solid var(--b-subtle)" }} />

        {/* Body */}
        <div className="px-4 py-3 flex flex-col gap-3">
          {/* Location */}
          {person.location_label && (
            <div className="flex items-center gap-2">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--t-muted)", flexShrink: 0 }}>
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <p className="text-[12px]" style={{ color: "var(--t-secondary)" }}>
                {person.location_label}
              </p>
            </div>
          )}

          {/* Industry */}
          {person.industry && (
            <div className="flex items-center gap-2">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--t-muted)" }}>
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
              </svg>
              <p className="text-[12px]" style={{ color: "var(--t-secondary)" }}>
                {person.industry}
              </p>
            </div>
          )}

          {/* Bio */}
          {person.bio && (
            <p
              className="text-[12px] leading-relaxed"
              style={{
                color: "var(--t-secondary)",
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {person.bio}
            </p>
          )}

          {/* Interests */}
          {interests.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {interests.map((interest) => (
                <span
                  key={interest}
                  className="badge"
                  style={{
                    fontSize: 10,
                    padding: "2px 7px",
                    background: "var(--i-gold-bg)",
                    color: "var(--akp-gold)",
                    border: "1px solid var(--i-gold-border)",
                  }}
                >
                  {interest}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Footer — LinkedIn */}
        {linkedinHref && (
          <>
            <div style={{ borderTop: "1px solid var(--b-subtle)" }} />
            <div className="px-4 py-3">
              <a
                href={linkedinHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-[12px] font-semibold"
                style={{ color: "#0077b5" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z" />
                  <circle cx="4" cy="4" r="2" />
                </svg>
                View LinkedIn profile →
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PeopleClient({
  people,
  isAdmin,
  showTour = false,
}: {
  people: Person[];
  isAdmin: boolean;
  showTour?: boolean;
}) {
  const mapRef = useRef<LeafletMap | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [mapBounds, setMapBounds] = useState<LatLngBounds | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "alumni" | "current">("all");
  const [filterIndustry, setFilterIndustry] = useState("all");
  const [filterInterest, setFilterInterest] = useState("all");

  const selectedPerson = useMemo(
    () => (selectedId ? people.find((p) => p.id === selectedId) ?? null : null),
    [selectedId, people]
  );

  const industries = useMemo(() => {
    const set = new Set(people.map((p) => p.industry).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [people]);

  const allInterests = useMemo(() => {
    const set = new Set(people.flatMap((p) => p.interests ?? []).filter(Boolean));
    return Array.from(set).sort();
  }, [people]);

  const filtered = useMemo(() => {
    return people.filter((p) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !p.full_name.toLowerCase().includes(q) &&
          !p.company?.toLowerCase().includes(q) &&
          !p.title?.toLowerCase().includes(q) &&
          !p.location_label?.toLowerCase().includes(q) &&
          !(p.interests ?? []).some((i) => i.toLowerCase().includes(q))
        )
          return false;
      }
      if (filterType !== "all" && p.member_type !== filterType) return false;
      if (filterIndustry !== "all" && p.industry !== filterIndustry) return false;
      if (filterInterest !== "all" && !(p.interests ?? []).includes(filterInterest)) return false;
      return true;
    });
  }, [people, search, filterType, filterIndustry, filterInterest]);

  const pins: PersonPin[] = useMemo(
    () =>
      filtered
        .filter((p) => p.latitude != null && p.longitude != null)
        .map((p) => ({
          id: p.id,
          full_name: p.full_name,
          lat: p.latitude!,
          lng: p.longitude!,
          headline: p.headline,
          title: p.title,
          company: p.company,
          location_label: p.location_label,
          headshot_url: p.headshot_url,
          member_type: p.member_type,
          grad_year: p.grad_year,
          pledge_class: p.pledge_class,
          interests: p.interests,
          bio: p.bio,
          linkedin_url: p.linkedin_url,
        })),
    [filtered]
  );

  const handleBoundsChange = useCallback((bounds: LatLngBounds) => {
    setMapBounds(bounds);
  }, []);

  // Marker click: select + fly to location + scroll sidebar card into view
  const handleMarkerClick = useCallback((id: string, lat: number, lng: number) => {
    setSelectedId(id);
    setFlyTarget({ lat, lng, zoom: 13 });
    requestAnimationFrame(() => {
      cardRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, []);

  // Card click: select + fly to location
  const handleCardClick = useCallback((p: Person) => {
    setSelectedId(p.id);
    if (p.latitude != null && p.longitude != null) {
      setFlyTarget({ lat: p.latitude, lng: p.longitude, zoom: 13 });
    }
  }, []);

  const isInViewport = useCallback(
    (p: Person) => {
      if (!mapBounds || p.latitude == null || p.longitude == null) return false;
      return mapBounds.contains([p.latitude, p.longitude]);
    },
    [mapBounds]
  );

  const locatedCount = people.filter((p) => p.latitude != null && p.longitude != null).length;
  const unlocated = people.length - locatedCount;

  return (
    <main
      style={{
        display: "flex",
        height: "calc(100vh - 56px)",
        overflow: "hidden",
        flexDirection: "column",
      }}
      className="md-people-row"
    >
      <style>{`
        @media (min-width: 768px) {
          .md-people-row { flex-direction: row !important; }
          .people-panel  { order: 1; width: 300px; flex: none; height: 100%; }
          .people-map    { order: 2; flex: 1; height: 100%; }
        }
        @media (max-width: 767px) {
          .people-panel  { order: 2; flex: 1; min-height: 0; }
          .people-map    { order: 1; flex: none; height: 45vh; }
        }
      `}</style>

      {/* ── Left panel ───────────────────────────────────────────────────── */}
      <aside
        className="people-panel flex flex-col overflow-hidden"
        style={{ background: "var(--s-0)", borderRight: "1px solid var(--b-default)" }}
      >
        {/* Header / filters */}
        <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--b-subtle)" }}>
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] mb-3" style={{ color: "var(--t-muted)" }}>
            People Directory
          </p>

          {/* Search */}
          <div className="relative mb-2.5">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
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
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, company, interest…"
              className="input pl-9"
              style={{ fontSize: 13 }}
            />
          </div>

          {/* Type filter */}
          <div className="flex gap-1 mb-2.5">
            {(["all", "alumni", "current"] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setFilterType(opt)}
                className={`pill ${filterType === opt ? "pill-active" : ""}`}
                style={{ fontSize: 11 }}
              >
                {opt === "all" ? "All" : opt.charAt(0).toUpperCase() + opt.slice(1)}
              </button>
            ))}
          </div>

          {/* Industry filter */}
          {industries.length > 0 && (
            <select
              value={filterIndustry}
              onChange={(e) => setFilterIndustry(e.target.value)}
              className="input mb-2.5"
              style={{ fontSize: 12 }}
            >
              <option value="all">All industries</option>
              {industries.map((ind) => (
                <option key={ind} value={ind}>{ind}</option>
              ))}
            </select>
          )}

          {/* Interests filter */}
          {allInterests.length > 0 && (
            <select
              value={filterInterest}
              onChange={(e) => setFilterInterest(e.target.value)}
              className="input"
              style={{ fontSize: 12 }}
            >
              <option value="all">All interests</option>
              {allInterests.map((interest) => (
                <option key={interest} value={interest}>{interest}</option>
              ))}
            </select>
          )}

          {/* Count */}
          <p className="text-[11px] mt-2.5" style={{ color: "var(--t-muted)" }}>
            {filtered.length} member{filtered.length !== 1 ? "s" : ""}
            {filtered.length !== people.length && ` of ${people.length}`}
          </p>
        </div>

        {/* Person list */}
        <div className="flex-1 overflow-y-auto px-1.5 py-2">
          {filtered.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-12 gap-2 text-center"
              style={{ color: "var(--t-muted)" }}
            >
              <p className="text-[13px] font-medium">No results</p>
              <p className="text-[12px]">Try a different search or filter.</p>
            </div>
          ) : (
            filtered.map((p) => (
              <PersonCard
                key={p.id}
                person={p}
                selected={selectedId === p.id}
                inViewport={isInViewport(p)}
                onClick={() => handleCardClick(p)}
                cardRef={(el) => { cardRefs.current[p.id] = el; }}
              />
            ))
          )}
        </div>

        {/* Footer */}
        {unlocated > 0 && (
          <div
            className="px-4 py-2 text-[11px] text-center"
            style={{ borderTop: "1px solid var(--b-subtle)", color: "var(--t-faint)" }}
          >
            {unlocated} member{unlocated !== 1 ? "s" : ""} without a map location
          </div>
        )}
      </aside>

      {/* ── Map ──────────────────────────────────────────────────────────── */}
      {/* `isolate` creates a stacking context that contains all Leaflet z-indices
          (tiles z-200, controls z-1000, etc.) so they don't compete with fixed
          overlays like WelcomeTour in the root stacking context. */}
      <div className="people-map relative isolate">
        <PeopleMapInner
          pins={pins}
          selectedId={selectedId}
          flyTarget={flyTarget}
          onBoundsChange={handleBoundsChange}
          onMarkerClick={handleMarkerClick}
          mapRef={mapRef}
        />

        {/* Profile detail card — slides up from bottom-left when someone is selected */}
        {selectedPerson && (
          <ProfileDetailCard
            person={selectedPerson}
            onClose={() => setSelectedId(null)}
          />
        )}

        {isAdmin && locatedCount === 0 && (
          <div
            className="absolute top-3 right-3 z-[1000] max-w-xs px-4 py-3 rounded-xl text-[13px]"
            style={{
              background: "rgba(250,250,248,0.96)",
              border: "1px solid var(--b-default)",
              boxShadow: "var(--shadow-md)",
              color: "var(--t-primary)",
            }}
          >
            <strong>No pins yet.</strong>{" "}
            Add people with a location in the{" "}
            <a href="/admin/people" style={{ color: "var(--akp-gold)", fontWeight: 600 }}>
              People admin page
            </a>
            .
          </div>
        )}
      </div>

      <WelcomeTour show={showTour} />
    </main>
  );
}
