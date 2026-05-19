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

/** Resolves once the element has non-zero dimensions (retries via rAF). */
function waitForSize(el: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    function check() {
      if (el.offsetWidth > 0 && el.offsetHeight > 0) {
        resolve();
      } else {
        requestAnimationFrame(check);
      }
    }
    check();
  });
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
  const viewInitRef = useRef(false); // true once we've set the initial bounds

  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    async function setup() {
      if (!containerRef.current || mapRef.current) return;

      // Wait until the container has real pixel dimensions before handing
      // it to Leaflet — otherwise the map initialises at 0×0 and tiles
      // are never requested for the visible viewport.
      await waitForSize(containerRef.current);
      if (cancelled || !containerRef.current) return;

      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: true,
        scrollWheelZoom: true,
      });

      if (dark) {
        L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
          {
            maxZoom: 19,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: "abcd",
          }
        ).addTo(map);
      } else {
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap contributors",
        }).addTo(map);
      }

      mapRef.current = map;
      map.invalidateSize(false);

      if (containerRef.current && typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => {
          if (mapRef.current) mapRef.current.invalidateSize(false);
        });
        resizeObserver.observe(containerRef.current);
      }
    }

    setup();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markersRef.current = [];
    };
  }, [dark]);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    async function renderMarkers() {
      // Map may still be initialising (waitForSize in setup); retry until ready.
      if (!mapRef.current) {
        retryTimer = setTimeout(renderMarkers, 50);
        return;
      }
      if (cancelled) return;

      const L = await import("leaflet");
      if (cancelled || !mapRef.current) return;

      const map = mapRef.current;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      const plotted = centers.filter((c) => c.lat != null && c.lng != null);
      if (plotted.length === 0) {
        map.setView([47.9189, 106.9176], 12);
        return;
      }

      const latLngs: any[] = [];
      plotted.forEach((center, index) => {
        const active = selectedId ? center.id === selectedId : index === 0;
        const latLng = L.latLng(center.lat as number, center.lng as number);
        latLngs.push(latLng);

        const hasSeats =
          typeof center.availableSeats === "number" &&
          typeof center.seatCount === "number";
        const isFull = hasSeats && center.availableSeats === 0;

        const seatsBadge = hasSeats
          ? `<em class="lcm-seats${isFull ? " full" : ""}">${isFull ? "FULL" : `${center.availableSeats} open`}</em>`
          : "";

        const marker = L.marker(latLng, {
          icon: L.divIcon({
            className: "",
            html: `
              <button class="leaflet-center-marker${active ? " active" : ""}" type="button">
                <span class="lcm-dot${isFull ? " full" : ""}"></span>
                <strong>${index + 1}. ${escapeHtml(center.name)}</strong>
                ${seatsBadge}
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
            ${hasSeats ? `<small>${center.availableSeats}/${center.seatCount} open</small>` : ""}
          </div>
        `);
        marker.on("click", () => onSelect?.(center.id));
        markersRef.current.push(marker);
      });

      // Only fit bounds when centers first load — not on every selectedId
      // change, which would zoom out every time the user clicks a marker.
      if (!viewInitRef.current) {
        if (latLngs.length === 1) {
          map.setView(latLngs[0], 15);
        } else {
          map.fitBounds(L.latLngBounds(latLngs).pad(0.25), { animate: false });
        }
        viewInitRef.current = true;
      }

      map.invalidateSize(false);
    }

    renderMarkers();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [centers, selectedId, onSelect]);

  // Reset view flag when the centers list itself changes so new data re-fits.
  const centersKeyRef = useRef("");
  const centersKey = centers.map((c) => c.id).join(",");
  if (centersKey !== centersKeyRef.current) {
    centersKeyRef.current = centersKey;
    viewInitRef.current = false;
  }

  return (
    <div
      className={`relative h-full w-full overflow-hidden ${dark ? "leaflet-map-dark" : ""} ${className}`}
    >
      <div ref={containerRef} className="h-full w-full" />
      {centers.every((c) => c.lat == null || c.lng == null) && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/70 px-6 text-center">
          <p className="max-w-sm text-sm leading-relaxed text-black/45">
            Add latitude and longitude in owner settings to show centers on the
            map.
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
