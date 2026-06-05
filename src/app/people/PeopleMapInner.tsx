"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import type { Map as LeafletMap, LatLngBounds } from "leaflet";
import Supercluster from "supercluster";
import type { BBox, GeoJsonProperties } from "geojson";

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

type PinProperties = GeoJsonProperties & { pin: PersonPin };

// ── Cluster icon factory ──────────────────────────────────────────────────────
function makeClusterIcon(count: number): L.DivIcon {
  const size = count < 10 ? 36 : count < 100 ? 42 : 50;
  return L.divIcon({
    html: `<div style="
      width:${size}px;height:${size}px;
      background:#0a2240;border:2.5px solid #c9a84c;
      border-radius:50%;display:flex;align-items:center;justify-content:center;
      color:#c9a84c;font-weight:700;font-size:${count < 100 ? 13 : 11}px;
      font-family:system-ui,sans-serif;box-shadow:0 2px 8px rgba(10,34,64,0.4);
    ">${count}</div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

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

// ── Cluster layer (supercluster-powered) ─────────────────────────────────────
function ClusterLayer({
  pins,
  onMarkerClick,
}: {
  pins: PersonPin[];
  onMarkerClick: (id: string) => void;
}) {
  const map = useMap();
  const onClickRef = useRef(onMarkerClick);
  onClickRef.current = onMarkerClick;

  // Build the supercluster index once when pins change
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

  // Track current viewport
  const [viewport, setViewport] = useState<{
    bounds: BBox;
    zoom: number;
  } | null>(null);

  const updateViewport = useCallback(() => {
    const b = map.getBounds();
    const zoom = Math.floor(map.getZoom());
    setViewport({
      bounds: [
        b.getWest(),
        b.getSouth(),
        b.getEast(),
        b.getNorth(),
      ],
      zoom,
    });
  }, [map]);

  useMapEvents({
    moveend: updateViewport,
    zoomend: updateViewport,
  });

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
          // Cluster bubble
          const clusterId = props.cluster_id as number;
          const count = props.point_count as number;
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

        // Individual pin
        const pin = (props as PinProperties).pin;
        return (
          <Marker
            key={pin.id}
            position={[lat, lng]}
            eventHandlers={{ click: () => onClickRef.current(pin.id) }}
          >
            <Popup maxWidth={240}>
              <div
                dangerouslySetInnerHTML={{ __html: buildPopupHtml(pin) }}
              />
            </Popup>
          </Marker>
        );
      })}
    </>
  );
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
