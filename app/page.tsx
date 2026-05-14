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
      <section className="relative pt-[60px] overflow-hidden">
        <div className="grid md:grid-cols-[1fr_1fr] min-h-[calc(100vh-60px)]">

          {/* LEFT: Editorial text */}
          <div className="flex flex-col justify-between px-6 py-14 md:px-12 md:py-20">
            <div className="flex items-center justify-between">
              <span className="label text-[9px] text-black/25">УЛААНБААТАР · MN</span>
              <span className="label text-[9px] text-black/15">24/7</span>
            </div>

            {/* Giant clipped headline */}
            <div className="my-8 md:my-0 md:flex-1 flex flex-col justify-center">
              <div className="overflow-hidden">
                <h1
                  className="anim-hero anim-d1 display select-none"
                  style={{
                    fontSize: "clamp(90px, 17vw, 280px)",
                    lineHeight: 0.82,
                    background: "linear-gradient(135deg, #F5C000 0%, #C49A00 50%, #F5C000 100%)",
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
                  className="anim-hero anim-d2 display select-none text-[#0A0A0A]"
                  style={{ fontSize: "clamp(90px, 17vw, 280px)", lineHeight: 0.82 }}
                >
                  HEN
                </h1>
              </div>

              <div className="anim-fade-up anim-d4 mt-8 max-w-xs">
                <div className="mb-3 h-[2px] w-8 bg-[#F5C000]" />
                <p className="text-[12px] leading-relaxed text-black/35 font-light">
                  Улаанбаатарын бүх PC Gaming Center-ийн нэгдсэн захиалгын систем.
                </p>
              </div>
            </div>

            {/* Stats + CTAs */}
            <div className="space-y-8">
              <div className="flex gap-10">
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
                          <span className="text-black/15">—</span>
                        )}
                      </div>
                      <div className="label mt-1 text-[8px] text-black/20">{s.label}</div>
                    </div>
                  </InView>
                ))}
              </div>

              <div className="anim-fade-up anim-d6 flex flex-wrap gap-4">
                <Link
                  href="/booking"
                  className="inline-block bg-[#0A0A0A] px-8 py-3.5 text-[11px] uppercase tracking-[0.2em] text-white transition-colors hover:bg-[#F5C000] hover:text-black"
                >
                  Захиалах
                </Link>
                <Link
                  href="/register"
                  className="inline-block px-8 py-3.5 text-[11px] uppercase tracking-[0.2em] text-black/40 transition-colors hover:text-black"
                >
                  Бүртгүүлэх →
                </Link>
              </div>
            </div>
          </div>

          {/* RIGHT: Hero image */}
          <div className="relative hidden bg-[#F0EFE9] md:block">
            <div
              className="absolute inset-0 opacity-[0.035]"
              style={{
                backgroundImage: "linear-gradient(#0A0A0A 1px, transparent 1px), linear-gradient(90deg, #0A0A0A 1px, transparent 1px)",
                backgroundSize: "48px 48px",
              }}
            />
            <div className="absolute bottom-6 right-6 select-none">
              <span className="display text-[160px] leading-none text-[#0A0A0A]/[0.03]">01</span>
            </div>
            {centers.slice(0, 1).map((c) => {
              const img = getMainImage(c.images);
              return img ? (
                <div key={c.id} className="absolute inset-8 overflow-hidden">
                  <Image src={img} alt={c.name} fill priority className="object-cover" sizes="50vw" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                  <div className="absolute bottom-5 left-5">
                    <div className="mb-2 h-[2px] w-6 bg-[#F5C000]" />
                    <p className="display text-xl text-white">{c.name.toUpperCase()}</p>
                    <p className="mt-0.5 text-[9px] uppercase tracking-[0.18em] text-white/50">{c.district}</p>
                  </div>
                </div>
              ) : (
                <div key={c.id} className="absolute inset-8 bg-[#E8E6DE] flex items-center justify-center">
                  <span className="display text-5xl text-black/08">PC</span>
                </div>
              );
            })}
            {centers.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="label text-[9px] text-black/15">LOADING</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── LIVE BAR ── */}
      <section className="bg-[#0A0A0A] px-6 py-5 md:px-12">
        <div className="flex flex-wrap items-center gap-8 md:gap-16">
          <span className="label text-[8px] text-white/20">LIVE</span>
          {[
            { v: totalSeats, l: "total seats" },
            { v: totalOpen, l: "open now" },
            { v: centers.length, l: "centers" },
          ].map(({ v, l }) => (
            <div key={l} className="flex items-baseline gap-2">
              <span className="display text-xl text-[#F5C000]">{v || "—"}</span>
              <span className="label text-[8px] text-white/20">{l}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── CENTER INDEX ── */}
      <section className="pb-24">
        {/* Controls */}
        <div className="h-px bg-black/[0.06]" />
        <div className="flex flex-col gap-3 px-6 py-4 md:flex-row md:items-center md:justify-between md:px-12">
          <div className="flex items-center gap-3">
            <span className="label text-[9px] text-black/25">INDEX</span>
            <span className="mono text-[10px] text-black/15">{sorted.length}</span>
          </div>

          {/* Search — underline only */}
          <div className="flex items-center gap-2 border-b border-black/[0.1] pb-1 md:w-56">
            <svg width="10" height="10" viewBox="0 0 20 20" fill="none" className="shrink-0 text-black/20">
              <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Хайх..."
              className="flex-1 bg-transparent text-[12px] text-black/70 placeholder:text-black/18 outline-none"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-black/20 hover:text-black">
                <svg width="9" height="9" viewBox="0 0 20 20" fill="none">
                  <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
              </button>
            )}
          </div>

          {/* Sort + district */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-0">
              {(["rating", "price", "available"] as SortKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setSort(key)}
                  className={`px-3 py-1 text-[9px] uppercase tracking-[0.15em] transition-all ${
                    sort === key
                      ? "bg-[#F5C000] text-black"
                      : "text-black/25 hover:text-black/60"
                  }`}
                >
                  {key === "rating" ? "Top" : key === "price" ? "Price" : "Open"}
                </button>
              ))}
            </div>
            <select
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className="bg-transparent text-[9px] uppercase tracking-[0.15em] text-black/25 outline-none hover:text-black/50 transition-colors"
            >
              <option value="">All districts</option>
              {districts.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <div className="h-px bg-black/[0.06]" />

        {/* Skeleton */}
        {loading && centers.length === 0 && (
          <div>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-stretch" style={{ minHeight: 200 }}>
                <div className="flex-1 animate-pulse px-6 py-10 md:px-12">
                  <div className="mb-4 h-2 w-10 bg-black/[0.04]" />
                  <div className="h-9 w-2/3 bg-black/[0.03]" />
                  <div className="mt-4 h-2 w-1/3 bg-black/[0.03]" />
                </div>
                <div className="hidden w-[38%] animate-pulse bg-black/[0.02] md:block" />
              </div>
            ))}
          </div>
        )}

        {!loading && sorted.length === 0 && (
          <div className="flex flex-col items-center py-32">
            <div className="mb-4 h-px w-10 bg-black/[0.08]" />
            <p className="text-sm text-black/18 uppercase tracking-widest">
              {search ? `"${search}" олдсонгүй` : "NO CENTERS FOUND"}
            </p>
          </div>
        )}

        {/* Rows */}
        {sorted.map((c, i) => {
          const coverImg = getMainImage(c.images);
          const pct = c.seatCount > 0 ? (c.availableSeats / c.seatCount) * 100 : 0;
          const isEven = i % 2 === 0;

          return (
            <div key={c.id} className="group">
              <Link
                href={`/centers/${c.id}`}
                className="flex items-stretch transition-colors duration-500 hover:bg-[#F5F4F0]"
                style={{ minHeight: 200 }}
              >
                {/* Image */}
                <InView
                  from={isEven ? "left" : "right"}
                  distance={14}
                  delay={50}
                  duration={800}
                  className={`relative hidden flex-shrink-0 overflow-hidden md:block ${isEven ? "order-1" : "order-2"}`}
                  style={{ width: "38%" }}
                >
                  {coverImg ? (
                    i < 2 ? (
                      <Image
                        src={coverImg} alt={c.name} fill priority={i === 0}
                        className="object-cover transition-transform duration-700 group-hover:scale-[1.025]"
                        sizes="38vw"
                      />
                    ) : (
                      <LazyImage
                        src={coverImg} alt={c.name} fill
                        className="object-cover transition-transform duration-700 group-hover:scale-[1.025]"
                        sizes="38vw"
                      />
                    )
                  ) : (
                    <div className="absolute inset-0 bg-[#EEEDEA] flex items-center justify-center">
                      <span className="display text-3xl text-black/08">PC</span>
                    </div>
                  )}
                  <div
                    className={`pointer-events-none absolute inset-y-0 w-16 ${isEven ? "right-0 bg-gradient-to-l" : "left-0 bg-gradient-to-r"} from-[#FAFAFA] group-hover:from-[#F5F4F0] to-transparent transition-colors duration-500`}
                  />
                </InView>

                {/* Text */}
                <div className={`flex flex-1 flex-col justify-between px-6 py-10 md:px-10 md:py-12 ${isEven ? "order-2" : "order-1"}`}>
                  <InView from="up" distance={10} duration={600}>
                    <div className="flex items-center gap-4">
                      <span className="mono text-[10px] text-black/18">{String(i + 1).padStart(2, "0")}</span>
                      <span className="label text-[8px] text-black/22">{c.district}</span>
                      {c.isVerified && <span className="label text-[7px] text-[#F5C000]">VERIFIED</span>}
                      {favIds.has(c.id) && <span className="text-[10px] text-[#F5C000]">♥</span>}
                    </div>
                  </InView>

                  <InView from={isEven ? "right" : "left"} distance={22} delay={50} duration={800}>
                    <h2
                      className="display mt-4 text-[#0A0A0A] transition-opacity duration-500 group-hover:opacity-60"
                      style={{ fontSize: "clamp(28px, 3.5vw, 64px)", lineHeight: 0.88 }}
                    >
                      {c.name.toUpperCase()}
                    </h2>
                  </InView>

                  <InView from="up" distance={8} delay={100} duration={600}>
                    <div className="mt-5 flex flex-wrap items-center gap-5">
                      <div className="flex items-center gap-1">
                        <span className="text-[#F5C000] text-[10px]">★</span>
                        <span className="mono text-[11px] text-black/40">{c.rating.toFixed(1)}</span>
                        <span className="mono text-[9px] text-black/18">({c.reviewCount})</span>
                      </div>
                      <span className="mono text-[11px] text-black/35">
                        {c.minPricePerHour !== null ? `${c.minPricePerHour.toLocaleString()}₮/цаг` : "—"}
                      </span>
                      <div className="flex items-center gap-2">
                        {c.availableSeats > 0 && (
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-50" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
                          </span>
                        )}
                        <span className="mono text-[10px] text-black/25">{c.availableSeats}/{c.seatCount}</span>
                        <div className="h-px w-10 bg-black/[0.06] overflow-hidden relative">
                          <div className="absolute inset-y-0 left-0 bg-green-500/40" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <span className="ml-auto text-[10px] text-black/18 transition-all duration-300 group-hover:translate-x-1 group-hover:text-[#F5C000]">→</span>
                    </div>
                  </InView>
                </div>
              </Link>

              {i < sorted.length - 1 && <div className="h-px bg-black/[0.05] mx-6 md:mx-0" />}
            </div>
          );
        })}
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-[#0A0A0A] px-6 py-12 md:px-12">
        <div className="mx-auto max-w-screen-xl">
          <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="display text-3xl text-white/10">REIHEN</span>
              <p className="mt-3 max-w-xs text-[11px] leading-relaxed text-white/18">
                Улаанбаатарын PC gaming center-үүдийн нэгдсэн захиалгын систем.
              </p>
            </div>
            <div className="flex flex-wrap gap-6 text-[9px] uppercase tracking-[0.25em] text-white/18">
              <Link href="/booking" className="hover:text-[#F5C000] transition-colors">Захиалах</Link>
              <Link href="/events" className="hover:text-[#F5C000] transition-colors">Events</Link>
              <Link href="/profile" className="hover:text-[#F5C000] transition-colors">Профайл</Link>
            </div>
          </div>
          <div className="mt-10 h-px bg-white/[0.04]" />
          <div className="mt-5 flex items-center justify-between">
            <span className="label text-[8px] text-white/12">© 2026 REIHEN · ULAANBAATAR</span>
            <span className="label text-[8px] text-white/12">v2.0</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
