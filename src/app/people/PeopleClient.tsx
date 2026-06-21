"use client";

import dynamic from "next/dynamic";
import { useRef, useState, useCallback, useMemo } from "react";
import type { Map as LeafletMap, LatLngBounds } from "leaflet";
import type { PersonPin } from "./PeopleMapInner";

const PeopleMapInner = dynamic(() => import("./PeopleMapInner"), {
  ssr: false,
  loading: () => (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{ background: "var(--s-1)" }}
    >
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-6 h-6 rounded-full border-2 animate-spin"
          style={{ borderColor: "var(--akp-navy)", borderTopColor: "transparent" }}
        />
        <span className="text-[13px]" style={{ color: "var(--t-muted)" }}>
          Loading map…
        </span>
      </div>
    </div>
  ),
});

export type Person = {
  id: string;
  full_name: string;
  headshot_url: string | null;
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
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

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
  return (
    <div
      ref={cardRef}
      onClick={onClick}
      className="flex gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-100 select-none"
      style={{
        background: selected ? "var(--s-1)" : "transparent",
        borderLeft: `2px solid ${selected ? "var(--akp-gold)" : "transparent"}`,
      }}
    >
      {/* Avatar */}
      <div
        className="shrink-0 w-9 h-9 rounded-full overflow-hidden flex items-center justify-center font-semibold text-[11px]"
        style={{
          background: selected ? "var(--akp-navy)" : "var(--s-2)",
          color: selected ? "var(--akp-gold)" : "var(--t-muted)",
          border: "1px solid var(--b-default)",
          transition: "background 0.1s",
        }}
      >
        {person.headshot_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={person.headshot_url} alt="" className="w-full h-full object-cover" />
        ) : (
          getInitials(person.full_name)
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p
            className="text-[13px] font-semibold truncate leading-snug"
            style={{ color: selected ? "var(--t-primary)" : "var(--t-primary)" }}
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

        {(person.title || person.company) && (
          <p className="text-[11px] truncate mt-0.5" style={{ color: "var(--t-secondary)" }}>
            {[person.title, person.company].filter(Boolean).join(" · ")}
          </p>
        )}

        {person.location_label && (
          <p className="text-[11px] mt-0.5 truncate" style={{ color: "var(--t-muted)" }}>
            {person.location_label}
          </p>
        )}

        <div className="flex items-center gap-1.5 mt-1.5">
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
      </div>
    </div>
  );
}

export default function PeopleClient({
  people,
  isAdmin,
}: {
  people: Person[];
  isAdmin: boolean;
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
          !p.location_label?.toLowerCase().includes(q)
        ) return false;
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
          title: p.title,
          company: p.company,
          location_label: p.location_label,
          headshot_url: p.headshot_url,
          member_type: p.member_type,
          grad_year: p.grad_year,
        })),
    [filtered]
  );

  const handleBoundsChange = useCallback((bounds: LatLngBounds) => {
    setMapBounds(bounds);
  }, []);

  const handleMarkerClick = useCallback((id: string) => {
    setSelectedId(id);
    requestAnimationFrame(() => {
      cardRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, []);

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
        style={{
          background: "var(--s-0)",
          borderRight: "1px solid var(--b-default)",
        }}
      >
        {/* Header */}
        <div
          className="px-4 py-3"
          style={{ borderBottom: "1px solid var(--b-subtle)" }}
        >
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
              placeholder="Search name, company…"
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

        {/* List */}
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
            style={{
              borderTop: "1px solid var(--b-subtle)",
              color: "var(--t-faint)",
            }}
          >
            {unlocated} member{unlocated !== 1 ? "s" : ""} without a map location
          </div>
        )}
      </aside>

      {/* ── Map ──────────────────────────────────────────────────────────── */}
      <div className="people-map relative">
        <PeopleMapInner
          pins={pins}
          flyTarget={flyTarget}
          onBoundsChange={handleBoundsChange}
          onMarkerClick={handleMarkerClick}
          mapRef={mapRef}
        />

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
    </main>
  );
}
