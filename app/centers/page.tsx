"use client";

import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { NavBar } from "@/components/NavBar";
import { CenterRowSkeleton } from "@/components/Skeleton";
import { apiFetch } from "@/lib/api";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { getMainImage } from "@/lib/image-types";

const LeafletCentersMap = dynamic(
  () => import("@/components/LeafletCentersMap").then((m) => ({ default: m.LeafletCentersMap })),
  { ssr: false }
);

type SortKey = "nearest" | "open" | "price" | "rating";

interface CenterSeatType {
  id: string;
  name: string;
  pricePerHour: number;
  peakHourPrice: number | null;
  description?: string | null;
}

interface Center {
  id: string;
  name: string;
  address: string;
  district: string;
  description?: string | null;
  images: string[];
  seatCount: number;
  availableSeats: number;
  minPricePerHour: number | null;
  rating: number;
  reviewCount: number;
  isVerified: boolean;
  lat?: number | null;
  lng?: number | null;
  distance?: number | null;
  seatTypes: CenterSeatType[];
}

interface CentersResponse {
  centers: Center[];
  count: number;
  page: number;
  limit: number;
}

export default function CentersPage() {
  const [search, setSearch] = useState("");
  const [district, setDistrict] = useState("");
  const [sort, setSort] = useState<SortKey>("rating");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  const debouncedSearch = useDebounce(search, 200);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (district) params.set("district", district);
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (location) {
      params.set("lat", String(location.lat));
      params.set("lng", String(location.lng));
    }
    const text = params.toString();
    return text ? `?${text}` : "";
  }, [debouncedSearch, district, location]);

  const { data, isLoading } = useQuery<CentersResponse>({
    queryKey: ["centers-page", query],
    queryFn: () => apiFetch<CentersResponse>(`/api/centers${query}`),
    staleTime: 20_000,
  });

  const centers = useMemo(() => data?.centers ?? [], [data?.centers]);
  const districts = useMemo(() => Array.from(new Set(centers.map((c) => c.district))).sort(), [centers]);

  const sorted = useMemo(() => {
    return [...centers].sort((a, b) => {
      if (sort === "nearest") return (a.distance ?? Infinity) - (b.distance ?? Infinity);
      if (sort === "open") return b.availableSeats - a.availableSeats;
      if (sort === "price") return (a.minPricePerHour ?? Infinity) - (b.minPricePerHour ?? Infinity);
      return b.rating - a.rating;
    });
  }, [centers, sort]);

  const selected = sorted.find((c) => c.id === selectedId) ?? sorted[0] ?? null;
  const plotted = sorted.filter((c) => typeof c.lat === "number" && typeof c.lng === "number");

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setSort("nearest");
    });
  };

  return (
    <main className="ui-page min-h-screen text-black">
      <NavBar />

      <section className="px-6 pb-10 pt-28 md:px-12">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-black/25">
              Ulaanbaatar center map
            </p>
            <h1
              className="mt-3 font-black uppercase text-black"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(44px, 7vw, 112px)",
                lineHeight: 0.86,
                letterSpacing: "-0.04em",
              }}
            >
              Centers
            </h1>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex items-center gap-2 rounded-full border border-black/10 bg-white/75 px-4 py-2">
              <span className="text-black/25">⌕</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search center or address"
                className="w-52 bg-transparent text-sm text-black outline-none placeholder:text-black/25"
              />
            </div>
            <button
              type="button"
              onClick={useMyLocation}
              className="rounded-full border border-black/10 bg-white/75 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-black/50 transition-colors hover:bg-black hover:text-white"
            >
              Near me
            </button>
          </div>
        </div>
      </section>

      <section className="grid min-h-[calc(100vh-220px)] grid-cols-1 border-y border-black/[0.07] lg:grid-cols-[minmax(0,1fr)_460px]">
        <div className="relative min-h-[420px] overflow-hidden bg-[#f3f2ef]">
          <LeafletCentersMap
            centers={plotted}
            selectedId={selected?.id}
            onSelect={setSelectedId}
            userLocation={location}
            className="absolute inset-0"
            dark
          />
          <div className="absolute left-6 top-6 z-10 rounded-full border border-black/10 bg-white/80 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-black/35 backdrop-blur">
            {plotted.length} mapped / {sorted.length} centers
          </div>

          {plotted.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
              <p className="max-w-sm text-sm leading-relaxed text-black/35">
                Add latitude and longitude to centers to show them on this map.
              </p>
            </div>
          ) : null}

        </div>

        <aside className="border-t border-black/[0.07] bg-white lg:border-l lg:border-t-0">
          <div className="sticky top-0 z-20 border-b border-black/[0.07] bg-white/92 p-4 pt-5 backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-black/28">
                Center list
              </span>
              <span className="mono text-[10px] text-black/25">{sorted.length}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["rating", "open", "price", "nearest"] as SortKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSort(key)}
                  className={`rounded-full px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.14em] transition-colors ${
                    sort === key ? "bg-black text-white" : "bg-black/[0.04] text-black/38 hover:bg-black/[0.08] hover:text-black"
                  }`}
                >
                  {key}
                </button>
              ))}
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="rounded-full border border-black/10 bg-transparent px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-black/42 outline-none"
              >
                <option value="">All districts</option>
                {districts.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="max-h-none divide-y divide-black/[0.06] lg:max-h-[calc(100vh-74px)] lg:overflow-y-auto">
            {isLoading && sorted.length === 0 ? (
              Array.from({ length: 4 }).map((_, i) => <CenterRowSkeleton key={i} index={i} />)
            ) : sorted.length === 0 ? (
              <div className="p-10 text-center text-sm text-black/35">No centers found.</div>
            ) : (
              sorted.map((center) => (
                <CenterCard
                  key={center.id}
                  center={center}
                  active={selected?.id === center.id}
                  onSelect={() => setSelectedId(center.id)}
                />
              ))
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}

function CenterCard({
  center,
  active,
  onSelect,
}: {
  center: Center;
  active: boolean;
  onSelect: () => void;
}) {
  const image = getMainImage(center.images);
  const setup = center.seatTypes[0];
  const occupancy = center.seatCount > 0 ? Math.round((center.availableSeats / center.seatCount) * 100) : 0;

  return (
    <article className={`transition-colors ${active ? "bg-black/[0.035]" : "bg-white hover:bg-black/[0.02]"}`}>
      <button type="button" onClick={onSelect} className="block w-full p-4 text-left">
        <div className="flex gap-4">
          <div className="relative h-24 w-28 shrink-0 overflow-hidden bg-black/[0.04]">
            {image ? (
              <Image src={image} alt={center.name} fill className="object-cover grayscale" sizes="112px" />
            ) : (
              <div className="flex h-full items-center justify-center text-xl font-black text-black/10">PC</div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-[9px] font-semibold uppercase tracking-[0.2em] text-black/28">{center.district}</span>
              {center.distance != null && <span className="mono text-[10px] text-black/28">{center.distance.toFixed(1)} km</span>}
            </div>
            <h3 className="mt-1 truncate text-lg font-black uppercase leading-none text-black">{center.name}</h3>
            <p className="mt-1 line-clamp-1 text-xs text-black/42">{center.address}</p>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <Metric label="Open" value={`${center.availableSeats}/${center.seatCount}`} />
              <Metric label="From" value={center.minPricePerHour != null ? `${center.minPricePerHour.toLocaleString()}₮` : "-"} />
              <Metric label="Rate" value={center.rating.toFixed(1)} />
            </div>
          </div>
        </div>

        <div className="mt-4 border border-black/[0.07] bg-white/70 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-black/26">
                {setup ? setup.name : "Standard seat"}
              </p>
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-black/48">
                {setup?.description || "Specs not added yet. Example: 240Hz monitor, RTX 4060, mechanical keyboard."}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="mono text-sm font-black text-black">{occupancy}%</p>
              <p className="text-[8px] uppercase tracking-[0.16em] text-black/25">available</p>
            </div>
          </div>
          {center.seatTypes.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {center.seatTypes.slice(1, 4).map((type) => (
                <span key={type.id} className="rounded-full bg-black/[0.04] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-black/35">
                  {type.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </button>
      <div className="flex items-center justify-between px-4 pb-4">
        <span className="text-[10px] text-black/28">{center.reviewCount} reviews</span>
        <Link href={`/centers/${center.id}`} className="rounded-full bg-black px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
          Details
        </Link>
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-black/[0.035] px-2 py-1.5">
      <p className="mono truncate text-[11px] font-black text-black">{value}</p>
      <p className="mt-0.5 text-[7px] font-semibold uppercase tracking-[0.16em] text-black/24">{label}</p>
    </div>
  );
}

