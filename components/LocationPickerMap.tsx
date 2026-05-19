"use client";

import { useEffect, useRef } from "react";

interface LocationPickerMapProps {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
  className?: string;
  dark?: boolean;
}

export function LocationPickerMap({
  lat,
  lng,
  onChange,
  className = "",
  dark = false,
}: LocationPickerMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  // Keep the latest onChange in a ref so we don't need to rebind event listeners
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      if (!containerRef.current || mapRef.current) return;
      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;

      // Default to Ulaanbaatar center if no lat/lng provided
      const defaultLat = lat ?? 47.9189;
      const defaultLng = lng ?? 106.9176;
      const initialZoom = lat && lng ? 15 : 12;

      const map = L.map(containerRef.current, {
        center: [defaultLat, defaultLng],
        zoom: initialZoom,
        zoomControl: true,
        attributionControl: true,
        scrollWheelZoom: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);

      mapRef.current = map;

      // Map click handler to update location
      map.on("click", (e: any) => {
        const { lat: newLat, lng: newLng } = e.latlng;
        // Format to 6 decimal places to prevent excessively long numbers
        const formattedLat = parseFloat(newLat.toFixed(6));
        const formattedLng = parseFloat(newLng.toFixed(6));
        onChangeRef.current(formattedLat, formattedLng);
      });

      const createCustomIcon = () => {
        return L.divIcon({
          className: "leaflet-picker-marker",
          html: `<div style="width: 20px; height: 20px; background: #000; border: 2px solid #fff; border-radius: 50%; box-shadow: 0 4px 10px rgba(0,0,0,0.3);"></div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });
      };

      if (lat != null && lng != null) {
        markerRef.current = L.marker([lat, lng], { icon: createCustomIcon(), draggable: true }).addTo(map);
        markerRef.current.on("dragend", () => {
          const next = markerRef.current.getLatLng();
          onChangeRef.current(parseFloat(next.lat.toFixed(6)), parseFloat(next.lng.toFixed(6)));
        });
      }
    }

    setup();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Initialize only once — lat/lng updates handled by the effect below

  // Update marker when lat/lng change from outside (or from clicking)
  useEffect(() => {
    let cancelled = false;
    async function updateMarker() {
      if (!mapRef.current) return;
      const L = await import("leaflet");
      if (cancelled || !mapRef.current) return;

      const createCustomIcon = () => {
        return L.divIcon({
          className: "leaflet-picker-marker",
          html: `<div style="width: 20px; height: 20px; background: #000; border: 2px solid #fff; border-radius: 50%; box-shadow: 0 4px 10px rgba(0,0,0,0.3);"></div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });
      };

      if (lat != null && lng != null) {
        if (!markerRef.current) {
          markerRef.current = L.marker([lat, lng], { icon: createCustomIcon(), draggable: true }).addTo(mapRef.current);
          markerRef.current.on("dragend", () => {
            const next = markerRef.current.getLatLng();
            onChangeRef.current(parseFloat(next.lat.toFixed(6)), parseFloat(next.lng.toFixed(6)));
          });
          mapRef.current.setView([lat, lng], 15);
        } else {
          markerRef.current.setLatLng([lat, lng]);
        }
      } else {
        if (markerRef.current) {
          markerRef.current.remove();
          markerRef.current = null;
        }
      }
    }

    updateMarker();
    
    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  return (
    <div className={`relative h-full w-full overflow-hidden border border-black ${dark ? "leaflet-map-dark" : ""} ${className}`}>
      <div ref={containerRef} className="h-full w-full" />
      <div className="pointer-events-none absolute bottom-4 left-0 right-0 z-[1000] flex justify-center">
        <div className="bg-white/90 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] shadow-lg backdrop-blur-md border border-black">
          MAP ДЭЭР ДАРАХ ЭСВЭЛ PIN-ИЙГ ЧИРЖ БАЙРШИЛ СОНГОНО УУ
        </div>
      </div>
    </div>
  );
}
