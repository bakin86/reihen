"use client";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { NavBar } from "@/components/NavBar";

const HeroGeometry = dynamic(
  () => import("@/components/HeroGeometry").then((m) => ({ default: m.HeroGeometry })),
  { ssr: false }
);
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
    <main className="min-h-screen bg-[#0a0a0a] text-white selection:bg-white/10">
      <NavBar />

      {/* ── HERO ── */}
      <section className="relative flex min-h-screen flex-col justify-between overflow-hidden px-6 pb-16 pt-24 md:px-14 md:pt-28">

        {/* DNA Helix */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <HeroGeometry />
        </div>

        {/* System label */}
        <div className="relative flex items-center justify-between">
          <span className="anim-fade-in anim-d1 label text-[9px] text-white/15">
            INDEX — UB.MN
          </span>
          <span className="anim-fade-in anim-d1 label text-[9px] text-white/10">
            24 / 7
          </span>
        </div>

        {/* Giant headline — each line has own clip-path reveal */}
        <div className="relative my-auto py-12">
          <div className="overflow-hidden">
            <h1
              className="anim-hero anim-d1 display block select-none text-white"
              style={{ fontSize: "clamp(64px, 13vw, 210px)", lineHeight: 0.85 }}
            >
              PICK
            </h1>
          </div>
          <div className="overflow-hidden">
            <h1
              className="anim-hero anim-d2 display block select-none text-white/40"
              style={{ fontSize: "clamp(64px, 13vw, 210px)", lineHeight: 0.85 }}
            >
              YOUR
            </h1>
          </div>
          <div className="overflow-hidden">
            <h1
              className="anim-hero anim-d3 display block select-none text-white"
              style={{ fontSize: "clamp(64px, 13vw, 210px)", lineHeight: 0.85 }}
            >
              ARENA
            </h1>
          </div>

          {/* Floating body text + CTA — desktop */}
          <div className="anim-fade-up anim-d6 absolute bottom-0 right-0 hidden max-w-[280px] space-y-8 md:block">
            <p className="text-sm leading-relaxed text-white/25">
              Улаанбаатар дахь бүх PC Gaming Center-ийн сул суудлыг нэг дор.
              Шууд захиалаарай.
            </p>
            <div className="flex flex-col gap-2.5">
              <Link
                href="/booking"
                className="block rounded-full border border-white/15 px-7 py-3.5 text-center text-[11px] uppercase tracking-[0.2em] transition-all duration-500 hover:border-white/40 hover:bg-white hover:text-black"
              >
                Захиалах
              </Link>
              <Link
                href="/register"
                className="block rounded-full bg-white/[0.06] px-7 py-3.5 text-center text-[11px] uppercase tracking-[0.2em] transition-all duration-500 hover:bg-white/10"
              >
                Бүртгүүлэх
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom: live counters + mobile CTA */}
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="flex gap-10">
            {[
              { value: totalSeats, label: "SEATS" },
              { value: totalOpen, label: "OPEN", live: true },
              { value: centers.length, label: "CENTERS" },
            ].map((s, i) => (
              <InView key={s.label} delay={300 + i * 80} from="up" distance={20}>
                <div className="display text-3xl md:text-4xl">
                  {s.value > 0 ? (
                    <span className="flex items-center gap-2">
                      {s.live && (
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-50" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-400" />
                        </span>
                      )}
                      <Counter value={s.value} duration={1200} className="mono" />
                    </span>
                  ) : (
                    <span className="text-white/20">—</span>
                  )}
                </div>
                <div className="label mt-1.5 text-[8px] text-white/15">{s.label}</div>
              </InView>
            ))}
          </div>

          {/* Mobile CTAs */}
          <div className="flex gap-3 md:hidden">
            <Link
              href="/booking"
              className="rounded-full border border-white/15 px-5 py-2.5 text-[10px] uppercase tracking-[0.2em] transition-all duration-300 hover:bg-white hover:text-black"
            >
              Захиалах
            </Link>
          </div>
        </div>
      </section>

      {/* ── CENTER INDEX ── */}
      <section className="pb-20">
        {/* Search + filter */}
        <div className="flex flex-col gap-0 border-b border-white/[0.06] px-6 py-4 md:flex-row md:items-center md:justify-between md:px-14">
          {/* Search */}
          <div className="flex items-center gap-3">
            <svg width="12" height="12" viewBox="0 0 20 20" fill="none" className="shrink-0 text-white/20">
              <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Center хайх..."
              className="w-48 bg-transparent text-[12px] text-white placeholder:text-white/15 outline-none md:w-64"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-white/20 hover:text-white transition-colors">
                <svg width="10" height="10" viewBox="0 0 20 20" fill="none">
                  <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
              </button>
            )}
          </div>
          {/* Sort + district */}
          <div className="mt-3 flex items-center justify-between md:mt-0 md:gap-4">
            <div className="flex items-center gap-1">
              {(["rating", "price", "available"] as SortKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setSort(key)}
                  className={`rounded-full px-3 py-1 text-[9px] uppercase tracking-[0.2em] transition-all duration-400 ${
                    sort === key ? "bg-white/[0.07] text-white" : "text-white/20 hover:text-white/40"
                  }`}
                >
                  {key === "rating" ? "Top" : key === "price" ? "Price" : "Open"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-4">
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="bg-transparent text-[9px] uppercase tracking-[0.2em] text-white/15 outline-none transition-colors hover:text-white/30"
              >
                <option value="">All districts</option>
                {districts.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <span className="mono text-[9px] text-white/10">{sorted.length}</span>
            </div>
          </div>
        </div>

        {loading && centers.length === 0 && (
          <div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-stretch" style={{ minHeight: 220 }}>
                <div className="flex-1 animate-pulse px-6 py-10 md:px-14">
                  <div className="mb-6 h-3 w-20 rounded-full bg-white/[0.03]" />
                  <div className="h-12 w-2/3 rounded-full bg-white/[0.03]" />
                  <div className="mt-6 h-3 w-1/3 rounded-full bg-white/[0.03]" />
                </div>
                <div className="hidden w-[38%] animate-pulse bg-white/[0.02] md:block" />
              </div>
            ))}
          </div>
        )}

        {!loading && sorted.length === 0 && (
          <p className="px-6 py-40 text-center text-sm text-white/15">
            {search ? `"${search}" — олдсонгүй` : "NO CENTERS FOUND"}
          </p>
        )}

        {sorted.map((c, i) => {
          const coverImg = getMainImage(c.images);
          const pct = c.seatCount > 0 ? (c.availableSeats / c.seatCount) * 100 : 0;
          const isEven = i % 2 === 0;

          return (
            <div key={c.id} className="group">
              {/* Mobile-only image strip */}
              {coverImg && (
                <div className="relative h-28 overflow-hidden md:hidden">
                  <Image
                    src={coverImg}
                    alt={c.name}
                    fill
                    className="object-cover opacity-30"
                    sizes="100vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0a0a0a]" />
                </div>
              )}
              <Link
                href={`/centers/${c.id}`}
                className="flex items-stretch transition-colors duration-700 hover:bg-white/[0.012]"
                style={{ minHeight: 220 }}
              >
                {/* ── IMAGE SIDE ── */}
                <InView
                  from={isEven ? "left" : "right"}
                  distance={20}
                  delay={80}
                  duration={1000}
                  className={`relative hidden flex-shrink-0 overflow-hidden md:block ${isEven ? "order-1" : "order-2"}`}
                  style={{ width: "40%" }}
                >
                  {coverImg ? (
                    i < 2 ? (
                      <Image
                        src={coverImg}
                        alt={c.name}
                        fill
                        priority={i === 0}
                        className="object-cover opacity-50 transition-all duration-700 group-hover:opacity-70 group-hover:scale-[1.03]"
                        sizes="40vw"
                      />
                    ) : (
                      <LazyImage
                        src={coverImg}
                        alt={c.name}
                        fill
                        className="object-cover opacity-50 transition-all duration-700 group-hover:opacity-70 group-hover:scale-[1.03]"
                        sizes="40vw"
                      />
                    )
                  ) : (
                    <div className="absolute inset-0 bg-white/[0.015]" />
                  )}
                  {/* Gradient edge fade into page bg */}
                  <div className={`pointer-events-none absolute inset-y-0 w-24 ${isEven ? "right-0 bg-gradient-to-l" : "left-0 bg-gradient-to-r"} from-[#0a0a0a] to-transparent`} />
                </InView>

                {/* ── TEXT SIDE ── */}
                <div className={`flex flex-1 flex-col justify-between px-6 py-10 md:px-12 md:py-12 ${isEven ? "order-2" : "order-1"}`}>

                  {/* Index + meta */}
                  <InView from="up" distance={14} duration={700}>
                    <div className="flex items-center gap-4">
                      <span className="mono text-[10px] text-white/15">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="label text-[8px] text-white/20">{c.district}</span>
                      {c.isVerified && <span className="label text-[7px] text-white/15">✓</span>}
                      {favIds.has(c.id) && <span className="text-[10px] text-white/25">♥</span>}
                    </div>
                  </InView>

                  {/* Center name */}
                  <InView from={isEven ? "right" : "left"} distance={28} delay={60} duration={900}>
                    <h2
                      className="display mt-5 text-white transition-all duration-700 group-hover:opacity-80"
                      style={{
                        fontSize: "clamp(32px, 4vw, 72px)",
                        lineHeight: 0.9,
                        letterSpacing: "-0.05em",
                      }}
                    >
                      {c.name.toUpperCase()}
                    </h2>
                  </InView>

                  {/* Meta row */}
                  <InView from="up" distance={12} delay={120} duration={700}>
                    <div className="mt-6 flex flex-wrap items-center gap-5">
                      <span className="mono text-[11px] text-white/30">
                        {c.rating.toFixed(1)} ★
                        <span className="ml-1 text-[9px] text-white/12">({c.reviewCount})</span>
                      </span>
                      <span className="mono text-[11px] text-white/30">
                        {c.minPricePerHour !== null ? `${c.minPricePerHour.toLocaleString()}₮/h` : "—"}
                      </span>
                      <span className="mono text-[10px] text-white/18">
                        {c.availableSeats}/{c.seatCount}
                      </span>
                      <div className="relative h-px w-12 overflow-hidden bg-white/[0.04]">
                        <div
                          className="absolute inset-y-0 left-0 bg-green-400/40 transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      {c.availableSeats > 0 && (
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-50" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-400" />
                        </span>
                      )}
                      <span className="ml-auto text-[11px] text-white/12 transition-all duration-500 group-hover:translate-x-1 group-hover:text-white/35">→</span>
                    </div>
                  </InView>
                </div>

              </Link>

              {i < sorted.length - 1 && (
                <div className="mx-6 h-px bg-gradient-to-r from-transparent via-white/[0.03] to-transparent md:mx-12" />
              )}
            </div>
          );
        })}
      </section>

      {/* ── FOOTER ── */}
      <InView from="up" distance={20} duration={600}>
        <footer className="border-t border-white/[0.04] px-6 py-10 md:px-14">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="display text-2xl text-white/10">REIHEN</span>
              <p className="mt-2 text-[10px] text-white/15 max-w-xs leading-relaxed">
                Улаанбаатарын PC gaming center-үүдийн нэгдсэн захиалгын систем.
              </p>
            </div>
            <div className="flex flex-wrap gap-6 text-[9px] uppercase tracking-[0.25em] text-white/15">
              <Link href="/booking" className="hover:text-white/40 transition-colors">Захиалах</Link>
              <Link href="/events" className="hover:text-white/40 transition-colors">Events</Link>
              <Link href="/profile" className="hover:text-white/40 transition-colors">Профайл</Link>
            </div>
          </div>
          <div className="mt-8 flex items-center justify-between">
            <span className="label text-[8px] text-white/10">© 2026 REIHEN · ULAANBAATAR</span>
            <span className="label text-[8px] text-white/10">v2.0</span>
          </div>
        </footer>
      </InView>
    </main>
  );
}
