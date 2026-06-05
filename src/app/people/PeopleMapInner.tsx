"use client";

// leaflet.markercluster augments the L namespace with L.markerClusterGroup().
// It is a plain JS side-effect import — no auto-CSS, no module-factory issues.
import "leaflet.markercluster";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { Map as LeafletMap, LatLngBounds } from "leaflet";

// ── Fix broken default marker icons in bundlers ───────────────────────────────
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)
  ._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
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

// ── Popup HTML builder ────────────────────────────────────────────────────────
function buildPopupHtml(pin: PersonPin): string {
  const img = pin.headshot_url
    ? `<img src="${pin.headshot_url}" alt="" style="width:100%;height:80px;object-fit:cover;border-radius:6px;margin-bottom:8px;">`
    : "";
  const job =
    pin.title && pin.company
      ? `<p style="margin:3px 0 0;font-size:12px;color:#444;">${pin.title} · ${pin.company}</p>`
      : "";
  const loc = pin.location_label
    ? `<p style="margin:2px 0 0;font-size:11px;color:#888;">📍 ${pin.location_label}</p>`
    : "";
  const badge =
    pin.member_type || pin.grad_year
      ? `<p style="margin:5px 0 0;font-size:11px;font-weight:600;color:#c9a84c;">
           ${pin.member_type === "alumni" ? "Alumni" : "Current"}${
             pin.grad_year ? ` · ${pin.grad_year}` : ""
           }
         </p>`
      : "";
  return `<div style="min-width:180px;font-family:system-ui,sans-serif;">
    ${img}
    <p style="margin:0;font-weight:700;font-size:14px;color:#0a2240;">${pin.full_name}</p>
    ${job}${loc}${badge}
  </div>`;
}

// ── Imperative cluster layer ──────────────────────────────────────────────────
// Manages the leaflet.markercluster layer imperatively so we never import
// react-leaflet-cluster (which auto-imports CSS causing Turbopack failures).
function ClusterLayer({
  pins,
  onMarkerClick,
}: {
  pins: PersonPin[];
  onMarkerClick: (id: string) => void;
}) {
  const map = useMap();
  // Keep a stable ref to the callback so the effect doesn't re-run on every
  // render when the parent passes a new function reference.
  const onClickRef = useRef(onMarkerClick);
  onClickRef.current = onMarkerClick;

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const group = (L as any).markerClusterGroup({ chunkedLoading: true });

    for (const pin of pins) {
      const marker = L.marker([pin.lat, pin.lng]);
      marker.bindPopup(buildPopupHtml(pin), { maxWidth: 240 });
      marker.on("click", () => onClickRef.current(pin.id));
      group.addLayer(marker);
    }

    map.addLayer(group);
    return () => {
      map.removeLayer(group);
    };
  // Re-build the cluster layer only when the set of pins changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, pins]);

  return null;
}

// ── Viewport watcher ──────────────────────────────────────────────────────────
function ViewportWatcher({
  onBoundsChange,
}: {
  onBoundsChange: (b: LatLngBounds) => void;
}) {
  const map = useMapEvents({
    moveend: () => onBoundsChange(map.getBounds()),
    zoomend: () => onBoundsChange(map.getBounds()),
  });
  useEffect(() => {
    onBoundsChange(map.getBounds());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

// ── FlyTo controller ──────────────────────────────────────────────────────────
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
  onBoundsChange: (bounds: LatLngBounds) => void;
  onMarkerClick: (id: string) => void;
  mapRef?: React.MutableRefObject<LeafletMap | null>;
}) {
  return (
    <MapContainer
      center={[38.5, -95.5]}
      zoom={4}
      scrollWheelZoom
      style={{ height: "100%", width: "100%" }}
      ref={mapRef}
    >
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
      <ViewportWatcher onBoundsChange={onBoundsChange} />
      <FlyToController target={flyTarget} />
      <ClusterLayer pins={pins} onMarkerClick={onMarkerClick} />
    </MapContainer>
  );
}
