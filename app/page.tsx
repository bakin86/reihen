"use client";
import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import { NavBar } from "@/components/NavBar";
import { LazyImage } from "@/components/LazyImage";
import { InView } from "@/components/InView";
import { Counter } from "@/components/SplitFlap";
import { useCenters } from "@/lib/hooks/useCenters";
import { useFavorites } from "@/lib/hooks/useFavorites";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { getMainImage } from "@/lib/image-types";

type SortKey = "rating" | "price" | "available";

export default function HomePage() {
  const [district, setDistrict] = useState<string>("");
  const [sort, setSort] = useState<SortKey>("rating");
  const [search, setSearch] = useState("");
  const debouncedDistrict = useDebounce(district, 200);
  const debouncedSearch = useDebounce(search, 200);

  const { data, isLoading: loading } = useCenters(debouncedDistrict || undefined);
  const centers = data?.centers ?? [];

  const { data: favData } = useFavorites();
  const favIds = useMemo(
    () => new Set((favData?.centers ?? []).map((f) => f.id)),
    [favData]
  );

  const districts = Array.from(new Set(centers.map((c) => c.district))).sort();
  const totalSeats = centers.reduce((s, c) => s + c.seatCount, 0);
  const totalOpen = centers.reduce((s, c) => s + c.availableSeats, 0);

  const filtered = debouncedSearch
    ? centers.filter((c) =>
        c.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        c.district.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        c.address.toLowerCase().includes(debouncedSearch.toLowerCase())
      )
    : centers;

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "price") return (a.minPricePerHour ?? Infinity) - (b.minPricePerHour ?? Infinity);
    if (sort === "available") return b.availableSeats - a.availableSeats;
    return b.rating - a.rating;
  });

  return (
    <main className="min-h-screen bg-[#FAFAFA] text-[#0A0A0A]">
      <NavBar />

      {/* ── HERO ── */}
      <section className="relative pt-[56px] overflow-hidden">
        {/* Top rule */}
        <div className="h-px w-full bg-black/[0.07]" />

        <div className="grid md:grid-cols-[1fr_1fr] min-h-[calc(100vh-56px)]">

          {/* LEFT: Editorial text block */}
          <div className="flex flex-col justify-between px-6 py-12 md:px-12 md:py-16 border-r border-black/[0.07]">

            {/* Top label row */}
            <div className="flex items-center justify-between">
              <span className="label text-[9px] text-black/30">УЛААНБААТАР · MN</span>
              <span className="label text-[9px] text-black/20">24/7</span>
            </div>

            {/* Giant REIHEN — image clipped */}
            <div className="my-8 md:my-0 md:flex-1 flex flex-col justify-center">
              <div className="overflow-hidden">
                <h1
                  className="anim-hero anim-d1 display select-none leading-none"
                  style={{
                    fontSize: "clamp(80px, 16vw, 260px)",
                    lineHeight: 0.82,
                    background: "linear-gradient(135deg, #F5C000 0%, #C49A00 40%, #F5C000 80%)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    color: "transparent",
                  }}
                >
                  REI
                </h1>
              </div>
              <div className="overflow-hidden">
                <h1
                  className="anim-hero anim-d2 display select-none leading-none text-[#0A0A0A]"
                  style={{ fontSize: "clamp(80px, 16vw, 260px)", lineHeight: 0.82 }}
                >
                  HEN
                </h1>
              </div>

              {/* Descriptor line */}
              <div className="anim-fade-up anim-d4 mt-6 max-w-xs">
                <div className="mb-3 h-[2px] w-8 bg-[#F5C000]" />
                <p className="text-[12px] leading-relaxed text-black/40 font-light">
                  Улаанбаатарын бүх PC Gaming Center-ийн нэгдсэн захиалгын систем.
                </p>
              </div>
            </div>

            {/* Bottom: stats + CTAs */}
            <div className="space-y-6">
              {/* Live stats */}
              <div className="flex gap-8">
                {[
                  { value: totalSeats, label: "SEATS" },
                  { value: totalOpen, label: "OPEN NOW", live: true },
                  { value: centers.length, label: "CENTERS" },
                ].map((s, i) => (
                  <InView key={s.label} delay={300 + i * 80} from="up" distance={16}>
                    <div>
                      <div className="display text-3xl text-[#0A0A0A]">
                        {s.value > 0 ? (
                          <span className="flex items-center gap-2">
                            {s.live && s.value > 0 && (
                              <span className="relative flex h-1.5 w-1.5 shrink-0">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-60" />
                                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
                              </span>
                            )}
                            <Counter value={s.value} duration={1000} className="mono" />
                          </span>
                        ) : (
                          <span className="text-black/20">—</span>
                        )}
                      </div>
                      <div className="label mt-1 text-[8px] text-black/25">{s.label}</div>
                    </div>
                  </InView>
                ))}
              </div>

              {/* CTAs */}
              <div className="anim-fade-up anim-d6 flex flex-wrap gap-3">
                <Link
                  href="/booking"
                  className="inline-block bg-[#0A0A0A] px-7 py-3 text-[11px] uppercase tracking-[0.2em] text-white transition-all hover:bg-[#F5C000] hover:text-black"
                >
                  Захиалах
                </Link>
                <Link
                  href="/register"
                  className="inline-block border border-black/15 px-7 py-3 text-[11px] uppercase tracking-[0.2em] text-black/60 transition-all hover:border-black/40 hover:text-black"
                >
                  Бүртгүүлэх
                </Link>
              </div>
            </div>
          </div>

          {/* RIGHT: Hero image collage */}
          <div className="relative hidden bg-[#F2F1EE] md:block">
            {/* Large background grid pattern */}
            <div
              className="absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage: "linear-gradient(#0A0A0A 1px, transparent 1px), linear-gradient(90deg, #0A0A0A 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            />

            {/* Big editorial number */}
            <div className="absolute bottom-8 right-8">
              <span
                className="display text-[180px] leading-none text-[#0A0A0A]/[0.04] select-none"
              >
                01
              </span>
            </div>

            {/* Center image showcase */}
            {centers.slice(0, 1).map((c) => {
              const img = getMainImage(c.images);
              return img ? (
                <div key={c.id} className="absolute inset-6 overflow-hidden">
                  <Image
                    src={img}
                    alt={c.name}
                    fill
                    priority
                    className="object-cover"
                    sizes="50vw"
                  />
                  {/* Editorial overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute bottom-6 left-6">
                    <div className="mb-1 h-[2px] w-6 bg-[#F5C000]" />
                    <p className="display text-2xl text-white">{c.name.toUpperCase()}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.15em] text-white/60">{c.district}</p>
                  </div>
                </div>
              ) : (
                <div key={c.id} className="absolute inset-6 bg-[#E8E7E4] flex items-center justify-center">
                  <span className="display text-5xl text-black/10">PC</span>
                </div>
              );
            })}

            {/* If no centers yet, editorial placeholder */}
            {centers.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <div className="h-px w-24 bg-black/10" />
                <span className="label text-[9px] text-black/20">LOADING</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <section className="bg-[#0A0A0A] px-6 py-6 md:px-12">
        <div className="mx-auto max-w-screen-xl">
          <div className="flex flex-wrap items-center gap-8 md:gap-16">
            <span className="label text-[9px] text-white/20">LIVE STATS</span>
            <div className="flex flex-wrap gap-8 md:gap-16">
              {[
                { v: totalSeats, l: "total seats" },
                { v: totalOpen, l: "open now" },
                { v: centers.length, l: "centers" },
              ].map(({ v, l }) => (
                <div key={l} className="flex items-baseline gap-2">
                  <span className="display text-2xl text-[#F5C000]">{v || "—"}</span>
                  <span className="label text-[8px] text-white/20">{l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CENTER INDEX ── */}
      <section className="pb-24">
        {/* Header row */}
        <div className="border-b border-black/[0.07] px-6 py-4 md:px-12">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <span className="label text-[9px] text-black/30">CENTER INDEX</span>
              <span className="mono text-[10px] text-black/20">{sorted.length}</span>
            </div>

            {/* Search */}
            <div className="flex items-center gap-3 border border-black/[0.08] px-3 py-2 md:w-64">
              <svg width="11" height="11" viewBox="0 0 20 20" fill="none" className="shrink-0 text-black/25">
                <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Хайх..."
                className="flex-1 bg-transparent text-[12px] text-black/80 placeholder:text-black/20 outline-none"
              />
              {search && (
                <button onClick={() => setSearch("")} className="text-black/20 hover:text-black transition-colors">
                  <svg width="10" height="10" viewBox="0 0 20 20" fill="none">
                    <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                </button>
              )}
            </div>

            {/* Sort + district */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-0.5">
                {(["rating", "price", "available"] as SortKey[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => setSort(key)}
                    className={`px-3 py-1 text-[9px] uppercase tracking-[0.15em] transition-all ${
                      sort === key
                        ? "bg-[#F5C000] text-black font-semibold"
                        : "text-black/30 hover:text-black/60"
                    }`}
                  >
                    {key === "rating" ? "Top" : key === "price" ? "Price" : "Open"}
                  </button>
                ))}
              </div>
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="bg-transparent text-[9px] uppercase tracking-[0.15em] text-black/30 outline-none hover:text-black/60 transition-colors"
              >
                <option value="">All districts</option>
                {districts.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Skeleton */}
        {loading && centers.length === 0 && (
          <div>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-stretch border-b border-black/[0.05]" style={{ minHeight: 200 }}>
                <div className="flex-1 animate-pulse px-6 py-10 md:px-12">
                  <div className="mb-4 h-2 w-12 rounded-full bg-black/[0.05]" />
                  <div className="h-10 w-2/3 rounded-full bg-black/[0.04]" />
                  <div className="mt-4 h-2 w-1/3 rounded-full bg-black/[0.03]" />
                </div>
                <div className="hidden w-[38%] animate-pulse bg-black/[0.025] md:block" />
              </div>
            ))}
          </div>
        )}

        {!loading && sorted.length === 0 && (
          <div className="flex flex-col items-center py-32">
            <div className="mb-4 h-px w-12 bg-black/10" />
            <p className="text-sm text-black/20 uppercase tracking-widest">
              {search ? `"${search}" олдсонгүй` : "NO CENTERS FOUND"}
            </p>
          </div>
        )}

        {/* Center rows — editorial Swiss list */}
        {sorted.map((c, i) => {
          const coverImg = getMainImage(c.images);
          const pct = c.seatCount > 0 ? (c.availableSeats / c.seatCount) * 100 : 0;
          const isEven = i % 2 === 0;

          return (
            <div key={c.id} className="group border-b border-black/[0.06]">
              <Link
                href={`/centers/${c.id}`}
                className="flex items-stretch transition-colors duration-500 hover:bg-[#F5F4F1]"
                style={{ minHeight: 200 }}
              >
                {/* ── IMAGE ── */}
                <InView
                  from={isEven ? "left" : "right"}
                  distance={16}
                  delay={60}
                  duration={800}
                  className={`relative hidden flex-shrink-0 overflow-hidden md:block ${isEven ? "order-1" : "order-2"}`}
                  style={{ width: "38%" }}
                >
                  {coverImg ? (
                    i < 2 ? (
                      <Image
                        src={coverImg}
                        alt={c.name}
                        fill
                        priority={i === 0}
                        className="object-cover transition-all duration-700 group-hover:scale-[1.02]"
                        sizes="38vw"
                      />
                    ) : (
                      <LazyImage
                        src={coverImg}
                        alt={c.name}
                        fill
                        className="object-cover transition-all duration-700 group-hover:scale-[1.02]"
                        sizes="38vw"
                      />
                    )
                  ) : (
                    <div className="absolute inset-0 bg-[#F2F1EE] flex items-center justify-center">
                      <span className="display text-4xl text-black/10">PC</span>
                    </div>
                  )}
                  {/* Edge gradient */}
                  <div
                    className={`pointer-events-none absolute inset-y-0 w-16 ${isEven ? "right-0 bg-gradient-to-l" : "left-0 bg-gradient-to-r"} from-[#FAFAFA] to-transparent group-hover:from-[#F5F4F1]`}
                    style={{ transition: "background-color 0.5s" }}
                  />
                </InView>

                {/* ── TEXT ── */}
                <div className={`flex flex-1 flex-col justify-between px-6 py-8 md:px-10 md:py-10 ${isEven ? "order-2" : "order-1"}`}>
                  {/* Index + meta */}
                  <InView from="up" distance={12} duration={600}>
                    <div className="flex items-center gap-4">
                      <span className="mono text-[10px] text-black/20">{String(i + 1).padStart(2, "0")}</span>
                      <span className="label text-[8px] text-black/25">{c.district}</span>
                      {c.isVerified && (
                        <span className="label text-[7px] text-[#F5C000]">VERIFIED</span>
                      )}
                      {favIds.has(c.id) && (
                        <span className="text-[10px] text-[#F5C000]">♥</span>
                      )}
                    </div>
                  </InView>

                  {/* Center name */}
                  <InView from={isEven ? "right" : "left"} distance={24} delay={50} duration={800}>
                    <h2
                      className="display mt-4 text-[#0A0A0A] transition-opacity duration-500 group-hover:opacity-70"
                      style={{
                        fontSize: "clamp(28px, 3.5vw, 64px)",
                        lineHeight: 0.88,
                      }}
                    >
                      {c.name.toUpperCase()}
                    </h2>
                  </InView>

                  {/* Meta row */}
                  <InView from="up" distance={10} delay={100} duration={600}>
                    <div className="mt-5 flex flex-wrap items-center gap-5">
                      {/* Rating */}
                      <div className="flex items-center gap-1">
                        <span className="text-[#F5C000] text-[11px]">★</span>
                        <span className="mono text-[11px] text-black/50">{c.rating.toFixed(1)}</span>
                        <span className="mono text-[9px] text-black/20">({c.reviewCount})</span>
                      </div>

                      {/* Price */}
                      <span className="mono text-[11px] text-black/40">
                        {c.minPricePerHour !== null ? `${c.minPricePerHour.toLocaleString()}₮/цаг` : "—"}
                      </span>

                      {/* Availability */}
                      <div className="flex items-center gap-2">
                        {c.availableSeats > 0 && (
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-50" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
                          </span>
                        )}
                        <span className="mono text-[10px] text-black/30">
                          {c.availableSeats}/{c.seatCount}
                        </span>
                        {/* Progress bar */}
                        <div className="relative h-px w-10 overflow-hidden bg-black/[0.06]">
                          <div
                            className="absolute inset-y-0 left-0 bg-green-500/50 transition-all duration-700"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      {/* Arrow */}
                      <span className="ml-auto text-[10px] text-black/20 transition-all duration-400 group-hover:translate-x-1 group-hover:text-[#F5C000]">
                        →
                      </span>
                    </div>
                  </InView>
                </div>
              </Link>
            </div>
          );
        })}
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-black/[0.07] bg-[#0A0A0A] px-6 py-10 md:px-12">
        <div className="mx-auto max-w-screen-xl">
          <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="display text-3xl text-white/10">REIHEN</span>
              <p className="mt-3 max-w-xs text-[11px] leading-relaxed text-white/20">
                Улаанбаатарын PC gaming center-үүдийн нэгдсэн захиалгын систем.
              </p>
            </div>
            <div className="flex flex-wrap gap-6 text-[9px] uppercase tracking-[0.25em] text-white/20">
              <Link href="/booking" className="hover:text-[#F5C000] transition-colors">Захиалах</Link>
              <Link href="/events" className="hover:text-[#F5C000] transition-colors">Events</Link>
              <Link href="/profile" className="hover:text-[#F5C000] transition-colors">Профайл</Link>
            </div>
          </div>
          <div className="mt-8 flex items-center justify-between border-t border-white/[0.04] pt-6">
            <span className="label text-[8px] text-white/15">© 2026 REIHEN · ULAANBAATAR</span>
            <span className="label text-[8px] text-white/15">v2.0</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
