"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import type { Map as LeafletMap } from "leaflet";

// ── Fix broken default marker icons in webpack/turbopack bundlers ─────────────
// Leaflet's default icon URLs are resolved relative to the CSS file at runtime,
// which breaks in bundlers. Point them at unpkg instead (tiny, stable CDN).
// Must run before any map renders, so top-level module scope is correct here.
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ── Tile provider ─────────────────────────────────────────────────────────────
const TILE_URL =
  process.env.NEXT_PUBLIC_MAP_TILE_URL ??
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION ??
  '© <a href="https://openstreetmap.org">OpenStreetMap</a> contributors';

// ── Types ─────────────────────────────────────────────────────────────────────

export type PersonPin = {
  id: string;
  full_name: string;
  lat: number;
  lng: number;
  title: string | null;
  company: string | null;
  location_label: string | null;
  headshot_url: string | null;
  member_type: string | null;
  grad_year: number | null;
};

// ── Viewport-change emitter ───────────────────────────────────────────────────
// Calls onBoundsChange whenever the user pans or zooms.
function ViewportWatcher({
  onBoundsChange,
}: {
  onBoundsChange: (bounds: L.LatLngBounds) => void;
}) {
  const map = useMapEvents({
    moveend: () => onBoundsChange(map.getBounds()),
    zoomend: () => onBoundsChange(map.getBounds()),
  });
  // Fire once on mount so the initial viewport is set
  useEffect(() => {
    onBoundsChange(map.getBounds());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

// ── FlyTo helper ─────────────────────────────────────────────────────────────
// Receives a fly-to target from outside and executes it on the map.
function FlyToController({
  target,
}: {
  target: { lat: number; lng: number; zoom?: number } | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.flyTo([target.lat, target.lng], target.zoom ?? 12, { duration: 0.8 });
  }, [map, target]);
  return null;
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function PeopleMapInner({
  pins,
  flyTarget,
  onBoundsChange,
  onMarkerClick,
  mapRef,
}: {
  pins: PersonPin[];
  flyTarget: { lat: number; lng: number; zoom?: number } | null;
  onBoundsChange: (bounds: L.LatLngBounds) => void;
  onMarkerClick: (id: string) => void;
  mapRef?: React.MutableRefObject<LeafletMap | null>;
}) {
  return (
    <MapContainer
      center={[38.5, -95.5]}   // centre of continental US
      zoom={4}
      scrollWheelZoom
      style={{ height: "100%", width: "100%" }}
      ref={mapRef}
    >
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />

      <ViewportWatcher onBoundsChange={onBoundsChange} />
      <FlyToController target={flyTarget} />

      <MarkerClusterGroup chunkedLoading>
        {pins.map((pin) => (
          <Marker
            key={pin.id}
            position={[pin.lat, pin.lng]}
            eventHandlers={{ click: () => onMarkerClick(pin.id) }}
          >
            <Popup>
              <div style={{ minWidth: 180, fontFamily: "system-ui, sans-serif" }}>
                {pin.headshot_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={pin.headshot_url}
                    alt={pin.full_name}
                    style={{
                      width: "100%",
                      height: 80,
                      objectFit: "cover",
                      borderRadius: 6,
                      marginBottom: 8,
                    }}
                  />
                )}
                <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#0a2240" }}>
                  {pin.full_name}
                </p>
                {pin.title && pin.company && (
                  <p style={{ margin: "3px 0 0", fontSize: 12, color: "#444" }}>
                    {pin.title} · {pin.company}
                  </p>
                )}
                {pin.location_label && (
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "#888" }}>
                    📍 {pin.location_label}
                  </p>
                )}
                {(pin.member_type || pin.grad_year) && (
                  <p style={{ margin: "4px 0 0", fontSize: 11, color: "#c9a84c", fontWeight: 600 }}>
                    {pin.member_type === "alumni" ? "Alumni" : "Current"}
                    {pin.grad_year ? ` · ${pin.grad_year}` : ""}
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  );
}
