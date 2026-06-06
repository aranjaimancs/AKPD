"use client";

import dynamic from "next/dynamic";
import { useRef, useState, useCallback, useMemo } from "react";
import type { Map as LeafletMap, LatLngBounds } from "leaflet";
import type { PersonPin } from "./PeopleMapInner";

// Dynamic import with ssr:false — Leaflet references window at module evaluation
// time, which crashes the Node.js SSR renderer.
const PeopleMapInner = dynamic(() => import("./PeopleMapInner"), {
  ssr: false,
  loading: () => (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{ background: "var(--akp-off-white)" }}
    >
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: "var(--akp-gold)", borderTopColor: "transparent" }}
        />
        <span className="text-sm font-medium" style={{ color: "var(--akp-gray-400)" }}>
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
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

// ── Person card ───────────────────────────────────────────────────────────────

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
      className="flex gap-3 p-3 rounded-xl cursor-pointer transition-colors duration-100 select-none"
      style={{
        background: selected ? "rgba(10,34,64,0.06)" : "transparent",
        borderLeft: `3px solid ${selected ? "var(--akp-gold)" : "transparent"}`,
        marginLeft: "-1px",
      }}
    >
      {/* Headshot / initials */}
      <div
        className="shrink-0 w-11 h-11 rounded-full overflow-hidden flex items-center justify-center font-bold text-sm"
        style={{ background: "var(--akp-navy)", color: "var(--akp-gold)" }}
      >
        {person.headshot_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={person.headshot_url} alt="" className="w-full h-full object-cover" />
        ) : (
          initials(person.full_name)
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-bold truncate" style={{ color: "var(--akp-navy)" }}>
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
          <p className="text-xs truncate mt-0.5" style={{ color: "var(--akp-gray-600)" }}>
            {[person.title, person.company].filter(Boolean).join(" · ")}
          </p>
        )}

        {person.location_label && (
          <p className="text-xs mt-0.5 truncate" style={{ color: "var(--akp-gray-400)" }}>
            📍 {person.location_label}
          </p>
        )}

        <div className="flex items-center gap-1.5 mt-1">
          {person.member_type && (
            <span
              className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
              style={
                person.member_type === "alumni"
                  ? { background: "rgba(201,168,76,0.12)", color: "var(--akp-gold)" }
                  : { background: "rgba(10,34,64,0.08)", color: "var(--akp-navy)" }
              }
            >
              {person.member_type === "alumni" ? "Alumni" : "Current"}
            </span>
          )}
          {person.grad_year && (
            <span className="text-[10px]" style={{ color: "var(--akp-gray-400)" }}>
              &apos;{String(person.grad_year).slice(2)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Filter pill group ─────────────────────────────────────────────────────────

function PillGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 flex-wrap">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide transition-all"
          style={
            value === opt.value
              ? { background: "var(--akp-navy)", color: "var(--akp-gold)" }
              : { background: "var(--akp-gray-100)", color: "var(--akp-gray-600)" }
          }
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── Main client ───────────────────────────────────────────────────────────────

export default function PeopleClient({
  people,
  isAdmin,
}: {
  people: Person[];
  isAdmin: boolean;
}) {
  const mapRef = useRef<LeafletMap | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [flyTarget, setFlyTarget] = useState<{
    lat: number;
    lng: number;
    zoom?: number;
  } | null>(null);
  const [mapBounds, setMapBounds] = useState<LatLngBounds | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "alumni" | "current">("all");
  const [filterIndustry, setFilterIndustry] = useState("all");

  const industries = useMemo(() => {
    const set = new Set(people.map((p) => p.industry).filter(Boolean) as string[]);
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
        )
          return false;
      }
      if (filterType !== "all" && p.member_type !== filterType) return false;
      if (filterIndustry !== "all" && p.industry !== filterIndustry) return false;
      return true;
    });
  }, [people, search, filterType, filterIndustry]);

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
    /*
     * Layout strategy:
     *   Mobile  (< md): flex-col — map is 45 vh on top, panel fills the rest
     *   Desktop (≥ md): flex-row — panel is 320 px on the left, map fills the rest
     *
     * DOM order: panel first (so tab order is logical on desktop).
     * We swap visual order on mobile with CSS `order`.
     */
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
          .people-panel  { order: 1; width: 320px; flex: none; height: 100%; }
          .people-map    { order: 2; flex: 1;       height: 100%; }
        }
        @media (max-width: 767px) {
          .people-panel  { order: 2; flex: 1; min-height: 0; }
          .people-map    { order: 1; flex: none; height: 45vh; }
        }
      `}</style>

      {/* ── Left panel ───────────────────────────────────────────────────── */}
      <aside
        className="people-panel flex flex-col overflow-hidden"
        style={{ borderRight: "1px solid var(--akp-gray-200)", background: "var(--akp-white)" }}
      >
        {/* Search + filters */}
        <div
          className="p-3 flex flex-col gap-2.5"
          style={{ borderBottom: "1px solid var(--akp-gray-200)" }}
        >
          <div className="relative">
            <span
              className="absolute left-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none"
              style={{ color: "var(--akp-gray-400)" }}
            >
              🔍
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, company, location…"
              className="w-full rounded-xl pl-8 pr-3 py-2 text-sm outline-none"
              style={{
                background: "var(--akp-off-white)",
                border: "1px solid var(--akp-gray-200)",
                color: "var(--akp-gray-800)",
              }}
            />
          </div>

          <PillGroup
            options={[
              { label: "All", value: "all" as const },
              { label: "Alumni", value: "alumni" as const },
              { label: "Current", value: "current" as const },
            ]}
            value={filterType}
            onChange={setFilterType}
          />

          {industries.length > 0 && (
            <select
              value={filterIndustry}
              onChange={(e) => setFilterIndustry(e.target.value)}
              className="w-full rounded-xl px-3 py-1.5 text-xs outline-none"
              style={{
                background: "var(--akp-off-white)",
                border: "1px solid var(--akp-gray-200)",
                color:
                  filterIndustry === "all"
                    ? "var(--akp-gray-400)"
                    : "var(--akp-gray-800)",
              }}
            >
              <option value="all">All industries</option>
              {industries.map((ind) => (
                <option key={ind} value={ind}>
                  {ind}
                </option>
              ))}
            </select>
          )}

          {/* Stats row */}
          <div className="flex items-center justify-between">
            <p className="text-[11px]" style={{ color: "var(--akp-gray-400)" }}>
              {filtered.length} member{filtered.length !== 1 ? "s" : ""}
              {filtered.length !== people.length && ` of ${people.length}`}
            </p>
            {isAdmin && (
              <a
                href="/admin/people"
                className="text-[11px] font-semibold"
                style={{ color: "var(--akp-gold)" }}
              >
                Manage →
              </a>
            )}
          </div>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto p-2 pl-3">
          {filtered.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-16 gap-2"
              style={{ color: "var(--akp-gray-400)" }}
            >
              <span className="text-2xl">🔍</span>
              <p className="text-sm font-medium">No results</p>
              <p className="text-xs text-center">Try a different search or filter.</p>
            </div>
          ) : (
            filtered.map((p) => (
              <PersonCard
                key={p.id}
                person={p}
                selected={selectedId === p.id}
                inViewport={isInViewport(p)}
                onClick={() => handleCardClick(p)}
                cardRef={(el) => {
                  cardRefs.current[p.id] = el;
                }}
              />
            ))
          )}
        </div>

        {/* Unlocated footer */}
        {unlocated > 0 && (
          <div
            className="px-4 py-2 text-[11px] text-center"
            style={{
              borderTop: "1px solid var(--akp-gray-200)",
              color: "var(--akp-gray-400)",
            }}
          >
            {unlocated} member{unlocated !== 1 ? "s" : ""} not yet on map
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

        {/* Admin hint overlay */}
        {isAdmin && locatedCount === 0 && (
          <div
            className="absolute top-3 right-3 z-[1000] max-w-xs px-4 py-3 rounded-xl text-sm"
            style={{
              background: "rgba(255,255,255,0.95)",
              border: "1px solid var(--akp-gray-200)",
              boxShadow: "0 4px 16px rgba(10,34,64,0.12)",
              color: "var(--akp-gray-800)",
            }}
          >
            <strong style={{ color: "var(--akp-navy)" }}>No pins yet.</strong>{" "}
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
