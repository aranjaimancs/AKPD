"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import type { Map as LeafletMap, LatLngBounds } from "leaflet";
import Supercluster from "supercluster";
import type { BBox, GeoJsonProperties } from "geojson";

// ── Fix broken default marker icons in bundlers ───────────────────────────────
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
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
  headline: string | null;
  title: string | null;
  company: string | null;
  location_label: string | null;
  headshot_url: string | null;
  member_type: string | null;
  grad_year: number | null;
  pledge_class: string | null;
  interests: string[] | null;
  bio: string | null;
  linkedin_url: string | null;
};

type PinProperties = GeoJsonProperties & { pin: PersonPin };

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

// ── Icon factories ────────────────────────────────────────────────────────────

function makeClusterIcon(count: number): L.DivIcon {
  const size = count < 10 ? 38 : count < 100 ? 44 : 52;
  return L.divIcon({
    html: `<div style="
      width:${size}px;height:${size}px;
      background:#0a2240;border:2.5px solid #c9a84c;
      border-radius:50%;display:flex;align-items:center;justify-content:center;
      color:#c9a84c;font-weight:700;font-size:${count < 100 ? 13 : 11}px;
      font-family:system-ui,sans-serif;
      box-shadow:0 2px 10px rgba(10,34,64,0.45);
    ">${count}</div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function makePersonIcon(pin: PersonPin, isSelected: boolean): L.DivIcon {
  const size   = isSelected ? 48 : 40;
  const total  = size + 11; // circle + tail height
  const border = isSelected ? "#c9a84c" : "#0a2240";
  const tail   = isSelected ? "#c9a84c" : "#0a2240";
  const shadow = isSelected
    ? "0 0 0 3px rgba(201,168,76,0.3), 0 4px 12px rgba(10,34,64,0.5)"
    : "0 2px 8px rgba(10,34,64,0.35)";

  const initials = getInitials(pin.full_name);

  const inner = pin.headshot_url
    ? `<img src="${pin.headshot_url}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`
    : `<span style="color:#c9a84c;font-weight:700;font-size:${size < 44 ? 12 : 13}px;font-family:system-ui,sans-serif;line-height:1;">${initials}</span>`;

  return L.divIcon({
    html: `
      <div style="position:relative;width:${size}px;height:${total}px;">
        <div style="
          width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;
          display:flex;align-items:center;justify-content:center;
          background:#0a2240;border:2.5px solid ${border};
          box-shadow:${shadow};
          transition:all 0.2s ease;
        ">${inner}</div>
        <div style="
          position:absolute;bottom:0;left:50%;transform:translateX(-50%);
          width:0;height:0;
          border-left:5px solid transparent;border-right:5px solid transparent;
          border-top:10px solid ${tail};
        "></div>
      </div>
    `,
    className: "",
    iconSize: [size, total],
    iconAnchor: [size / 2, total],
  });
}

// ── Cluster layer ─────────────────────────────────────────────────────────────
function ClusterLayer({
  pins,
  selectedId,
  onMarkerClick,
}: {
  pins: PersonPin[];
  selectedId: string | null;
  onMarkerClick: (id: string, lat: number, lng: number) => void;
}) {
  const map = useMap();
  const onClickRef = useRef(onMarkerClick);
  onClickRef.current = onMarkerClick;

  const scRef = useRef<Supercluster<PinProperties>>(
    new Supercluster<PinProperties>({ radius: 60, maxZoom: 16 })
  );

  useEffect(() => {
    scRef.current.load(
      pins.map((pin) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [pin.lng, pin.lat] },
        properties: { pin },
      }))
    );
  }, [pins]);

  const [viewport, setViewport] = useState<{ bounds: BBox; zoom: number } | null>(null);

  const updateViewport = useCallback(() => {
    const b = map.getBounds();
    const zoom = Math.floor(map.getZoom());
    setViewport({
      bounds: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
      zoom,
    });
  }, [map]);

  useMapEvents({ moveend: updateViewport, zoomend: updateViewport });

  useEffect(() => {
    updateViewport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!viewport) return null;

  const items = scRef.current.getClusters(viewport.bounds, viewport.zoom);

  return (
    <>
      {items.map((feature) => {
        const [lng, lat] = feature.geometry.coordinates;
        const props = feature.properties as Record<string, unknown>;

        if (props.cluster) {
          const clusterId = props.cluster_id as number;
          const count    = props.point_count as number;
          return (
            <Marker
              key={`cluster-${clusterId}`}
              position={[lat, lng]}
              icon={makeClusterIcon(count)}
              eventHandlers={{
                click: () => {
                  const expansionZoom = Math.min(
                    scRef.current.getClusterExpansionZoom(clusterId),
                    18
                  );
                  map.flyTo([lat, lng], expansionZoom, { duration: 0.6 });
                },
              }}
            />
          );
        }

        const pin = (props as PinProperties).pin;
        const isSelected = pin.id === selectedId;

        return (
          <Marker
            key={pin.id}
            position={[lat, lng]}
            icon={makePersonIcon(pin, isSelected)}
            zIndexOffset={isSelected ? 1000 : 0}
            eventHandlers={{
              click: () => onClickRef.current(pin.id, lat, lng),
            }}
          >
            {/* Hover tooltip — name + headline */}
            <Tooltip
              direction="top"
              offset={[0, -4]}
              opacity={1}
              permanent={false}
              className="person-map-tooltip"
            >
              <div style={{ fontFamily: "system-ui,sans-serif" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#141210", display: "block" }}>
                  {pin.full_name}
                </span>
                {(pin.headline ?? [pin.title, pin.company].filter(Boolean).join(" · ")) && (
                  <span style={{ fontSize: 11, color: "#54504a", display: "block", marginTop: 1 }}>
                    {pin.headline ?? [pin.title, pin.company].filter(Boolean).join(" · ")}
                  </span>
                )}
              </div>
            </Tooltip>
          </Marker>
        );
      })}
    </>
  );
}

// ── Viewport watcher ──────────────────────────────────────────────────────────
function ViewportWatcher({ onBoundsChange }: { onBoundsChange: (b: LatLngBounds) => void }) {
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
function FlyToController({ target }: { target: { lat: number; lng: number; zoom?: number } | null }) {
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
  selectedId,
  flyTarget,
  onBoundsChange,
  onMarkerClick,
  mapRef,
}: {
  pins: PersonPin[];
  selectedId: string | null;
  flyTarget: { lat: number; lng: number; zoom?: number } | null;
  onBoundsChange: (bounds: LatLngBounds) => void;
  onMarkerClick: (id: string, lat: number, lng: number) => void;
  mapRef?: React.MutableRefObject<LeafletMap | null>;
}) {
  return (
    <>
      {/* Tooltip style override — scoped so it doesn't bleed */}
      <style>{`
        .person-map-tooltip {
          background: white !important;
          border: 1px solid #e2dfd7 !important;
          border-radius: 8px !important;
          box-shadow: 0 2px 8px rgba(20,18,16,0.1) !important;
          padding: 4px 10px !important;
        }
        .person-map-tooltip::before { display: none !important; }
      `}</style>
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
        <ClusterLayer pins={pins} selectedId={selectedId} onMarkerClick={onMarkerClick} />
      </MapContainer>
    </>
  );
}
