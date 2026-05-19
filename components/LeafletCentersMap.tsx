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
  userLocation?: { lat: number; lng: number } | null;
  editableCenterId?: string;
  onLocationChange?: (lat: number, lng: number) => void;
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
  userLocation,
  editableCenterId,
  onLocationChange,
  className = "",
  dark = false,
}: LeafletCentersMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);
  // Always-current ref so renderMarkers can read latest userLocation
  const userLocationRef = useRef(userLocation);
  userLocationRef.current = userLocation;
  const viewInitRef = useRef(false);

  // ── Map setup ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    async function setup() {
      if (!containerRef.current || mapRef.current) return;

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
      userMarkerRef.current = null;
    };
  }, [dark]);

  // ── User location marker (marker only — zoom handled in renderMarkers) ──────
  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    async function placeUserPin() {
      if (!mapRef.current) {
        retryTimer = setTimeout(placeUserPin, 50);
        return;
      }
      if (cancelled) return;

      const L = await import("leaflet");
      if (cancelled || !mapRef.current) return;

      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }

      if (!userLocation) return;

      userMarkerRef.current = L.marker(
        L.latLng(userLocation.lat, userLocation.lng),
        {
          icon: L.divIcon({
            className: "",
            html: `<div class="lcm-you-marker"><div class="lcm-you-pulse"></div></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          }),
          zIndexOffset: 1000,
        }
      ).addTo(mapRef.current);

      // Reset viewInit so renderMarkers re-fits bounds including user location
      viewInitRef.current = false;
    }

    placeUserPin();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [userLocation]);

  // ── Center markers + bounds ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    async function renderMarkers() {
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
          draggable: center.id === editableCenterId,
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
        marker.on("dragend", () => {
          const next = marker.getLatLng();
          onLocationChange?.(Number(next.lat.toFixed(6)), Number(next.lng.toFixed(6)));
        });
        markersRef.current.push(marker);
      });

      if (!viewInitRef.current) {
        // Include user location in bounds if available
        const loc = userLocationRef.current;
        const boundsPoints = loc
          ? [L.latLng(loc.lat, loc.lng), ...latLngs]
          : latLngs;

        if (boundsPoints.length === 1) {
          map.setView(boundsPoints[0], loc ? 14 : 15, { animate: !!loc });
        } else {
          map.fitBounds(L.latLngBounds(boundsPoints).pad(0.2), {
            animate: !!loc,
            maxZoom: loc ? 14 : 18,
          });
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
  }, [centers, selectedId, onSelect, userLocation, editableCenterId, onLocationChange]);

  // Reset view flag when centers list itself changes so new data re-fits.
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
