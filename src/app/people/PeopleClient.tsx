"use client";

import dynamic from "next/dynamic";
import { useRef, useState, useCallback } from "react";
import type { Map as LeafletMap, LatLngBounds } from "leaflet";
import type { PersonPin } from "./PeopleMapInner";

// Dynamic import with ssr:false — Leaflet references window at module evaluation
// time, which crashes the Node.js SSR renderer. This is the required pattern.
const PeopleMapInner = dynamic(() => import("./PeopleMapInner"), {
  ssr: false,
  loading: () => (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{ background: "var(--akp-off-white)" }}
    >
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
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

export default function PeopleClient({
  people,
  isAdmin,
}: {
  people: Person[];
  isAdmin: boolean;
}) {
  const mapRef = useRef<LeafletMap | null>(null);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [, setMapBounds] = useState<LatLngBounds | null>(null);

  const handleBoundsChange = useCallback((bounds: LatLngBounds) => {
    setMapBounds(bounds);
  }, []);

  const handleMarkerClick = useCallback((id: string) => {
    // Step 4: will scroll the list card into view
    console.log("marker clicked:", id);
  }, []);

  // People who have coordinates → map pins
  const pins: PersonPin[] = people
    .filter((p) => p.latitude !== null && p.longitude !== null)
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
    }));

  const withoutCoords = people.filter((p) => p.latitude === null || p.longitude === null);

  return (
    <main className="flex-1 flex flex-col overflow-hidden">
      {/* Map — full height below the navbar (56px) */}
      <div style={{ height: "calc(100vh - 56px)", position: "relative" }}>
        <PeopleMapInner
          pins={pins}
          flyTarget={flyTarget}
          onBoundsChange={handleBoundsChange}
          onMarkerClick={handleMarkerClick}
          mapRef={mapRef}
        />

        {/* Unlocated count badge — bottom-left overlay */}
        {withoutCoords.length > 0 && (
          <div
            className="absolute bottom-6 left-4 z-[1000] px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{
              background: "rgba(10,34,64,0.85)",
              color: "rgba(201,168,76,0.9)",
              backdropFilter: "blur(4px)",
            }}
          >
            {withoutCoords.length} member{withoutCoords.length !== 1 ? "s" : ""} not yet on map
          </div>
        )}

        {/* Admin hint — top-right overlay */}
        {isAdmin && pins.length === 0 && (
          <div
            className="absolute top-4 right-4 z-[1000] max-w-xs px-4 py-3 rounded-xl text-sm"
            style={{
              background: "rgba(255,255,255,0.95)",
              border: "1px solid var(--akp-gray-200)",
              boxShadow: "0 4px 16px rgba(10,34,64,0.12)",
              color: "var(--akp-gray-700)",
            }}
          >
            <strong style={{ color: "var(--akp-navy)" }}>No pins yet.</strong> Add people with
            a location in the{" "}
            <a
              href="/admin/people"
              style={{ color: "var(--akp-gold)", fontWeight: 600 }}
            >
              People admin page
            </a>{" "}
            and they'll appear here.
          </div>
        )}
      </div>
    </main>
  );
}
