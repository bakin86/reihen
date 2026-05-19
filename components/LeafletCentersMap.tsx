"use client";

import { useEffect, useRef } from "react";

export interface LeafletCenter {
  id: string;
  name: string;
  address?: string;
  district?: string;
  availableSeats?: number;
  seatCount?: number;
  lat?: number | null;
  lng?: number | null;
}

interface LeafletCentersMapProps {
  centers: LeafletCenter[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
  dark?: boolean;
}

export function LeafletCentersMap({
  centers,
  selectedId,
  onSelect,
  className = "",
  dark = false,
}: LeafletCentersMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      if (!containerRef.current || mapRef.current) return;
      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: true,
        scrollWheelZoom: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);

      mapRef.current = map;
    }

    setup();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markersRef.current = [];
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function renderMarkers() {
      if (!mapRef.current) return;
      const L = await import("leaflet");
      if (cancelled || !mapRef.current) return;

      const map = mapRef.current;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];

      const plotted = centers.filter((center) => center.lat != null && center.lng != null);
      if (plotted.length === 0) {
        map.setView([47.9189, 106.9176], 12);
        return;
      }

      const latLngs: any[] = [];
      plotted.forEach((center, index) => {
        const active = selectedId ? center.id === selectedId : index === 0;
        const latLng = L.latLng(center.lat as number, center.lng as number);
        latLngs.push(latLng);

        const marker = L.marker(latLng, {
          icon: L.divIcon({
            className: "",
            html: `
              <button class="leaflet-center-marker ${active ? "active" : ""}" type="button">
                <span></span>
                <strong>${index + 1}. ${escapeHtml(center.name)}</strong>
              </button>
            `,
            iconSize: undefined,
            iconAnchor: [18, 18],
          }),
        }).addTo(map);

        marker.bindPopup(`
          <div class="leaflet-center-popup">
            <strong>${escapeHtml(center.name)}</strong>
            ${center.address ? `<p>${escapeHtml(center.address)}</p>` : ""}
            ${typeof center.availableSeats === "number" && typeof center.seatCount === "number"
              ? `<small>${center.availableSeats}/${center.seatCount} open</small>`
              : ""}
          </div>
        `);
        marker.on("click", () => onSelect?.(center.id));
        markersRef.current.push(marker);
      });

      if (latLngs.length === 1) {
        map.setView(latLngs[0], 15);
      } else {
        map.fitBounds(L.latLngBounds(latLngs).pad(0.25), { animate: false });
      }
    }

    const timer = window.setTimeout(renderMarkers, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [centers, selectedId, onSelect]);

  return (
    <div className={`relative h-full w-full overflow-hidden ${dark ? "leaflet-map-dark" : ""} ${className}`}>
      <div ref={containerRef} className="h-full w-full" />
      {centers.every((center) => center.lat == null || center.lng == null) && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/70 px-6 text-center">
          <p className="max-w-sm text-sm leading-relaxed text-black/45">
            Add latitude and longitude in owner settings to show centers on the map.
          </p>
        </div>
      )}
    </div>
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
