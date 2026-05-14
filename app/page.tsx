"use client";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { NavBar } from "@/components/NavBar";
import { LazyImage } from "@/components/LazyImage";
import { InView } from "@/components/InView";
import { Counter } from "@/components/SplitFlap";
import { CenterRowSkeleton } from "@/components/Skeleton";
import { useCenters } from "@/lib/hooks/useCenters";
import { useFavorites } from "@/lib/hooks/useFavorites";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { getMainImage } from "@/lib/image-types";

const HeroGeometry = dynamic(
  () => import("@/components/HeroGeometry").then((m) => ({ default: m.HeroGeometry })),
  { ssr: false }
);

type SortKey = "rating" | "price" | "available";

export default function HomePage() {
  const [district, setDistrict] = useState<string>("");
  const [sort, setSort]         = useState<SortKey>("rating");
  const [search, setSearch]     = useState("");
  const debouncedDistrict       = useDebounce(district, 200);
  const debouncedSearch         = useDebounce(search, 200);

  const { data, isLoading: loading } = useCenters(debouncedDistrict || undefined);
  const centers = data?.centers ?? [];

  const { data: favData } = useFavorites();
  const favIds = useMemo(() => new Set((favData?.centers ?? []).map((f) => f.id)), [favData]);

  const districts  = Array.from(new Set(centers.map((c) => c.district))).sort();
  const totalSeats = centers.reduce((s, c) => s + c.seatCount, 0);
  const totalOpen  = centers.reduce((s, c) => s + c.availableSeats, 0);

  const filtered = debouncedSearch
    ? centers.filter((c) =>
        c.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        c.district.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        c.address.toLowerCase().includes(debouncedSearch.toLowerCase())
      )
    : centers;

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "price")     return (a.minPricePerHour ?? Infinity) - (b.minPricePerHour ?? Infinity);
    if (sort === "available") return b.availableSeats - a.availableSeats;
    return b.rating - a.rating;
  });

  return (
    <main className="ui-page text-black">
      <NavBar />

      {/* ── HERO ── */}
      <section className="relative flex min-h-screen flex-col overflow-hidden">

        {/* DNA geometry — full background */}
        <div className="pointer-events-none absolute inset-0 opacity-60" aria-hidden="true">
          <HeroGeometry />
        </div>

        {/* Top meta row */}
        <div className="relative flex items-center justify-between px-6 pt-24 md:px-12 md:pt-28">
          <span className="mono text-[9px] font-medium uppercase tracking-[0.28em] text-black/20">
            Index — Ulaanbaatar
          </span>
          <span className="mono text-[9px] font-medium uppercase tracking-[0.28em] text-black/12">
            PC / 24H
          </span>
        </div>

        {/* Hero headline */}
        <div className="relative flex flex-1 flex-col justify-center px-6 py-12 md:px-12">
          <div className="overflow-hidden">
            <h1
              className="anim-hero block select-none font-black text-black"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(80px, 15vw, 240px)",
                lineHeight: 0.82,
                letterSpacing: "-0.05em",
                fontWeight: 900,
              }}
            >
              PICK
            </h1>
          </div>
          <div className="overflow-hidden">
            <h1
              className="anim-hero anim-d1 block select-none font-black"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(80px, 15vw, 240px)",
                lineHeight: 0.82,
                letterSpacing: "-0.05em",
                fontWeight: 900,
                color: "rgba(0,0,0,0.14)",
              }}
            >
              YOUR
            </h1>
          </div>
          <div className="overflow-hidden">
            <h1
              className="anim-hero anim-d2 block select-none font-black text-black"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(80px, 15vw, 240px)",
                lineHeight: 0.82,
                letterSpacing: "-0.05em",
                fontWeight: 900,
              }}
            >
              ARENA
            </h1>
          </div>

          {/* Descriptor — desktop right */}
          <div className="anim-fade-up anim-d5 absolute bottom-12 right-6 hidden max-w-[240px] space-y-5 md:block md:right-12">
            <p className="text-[11px] font-light leading-relaxed text-black/35">
              Улаанбаатар дахь бүх PC Gaming Center-ийн
              сул суудлыг нэг дор. Шууд захиалаарай.
            </p>
            <div className="flex flex-col gap-1.5">
              <Link
                href="/booking"
                className="ui-button ui-button-primary w-full"
              >
                Захиалах →
              </Link>
              <Link
                href="/register"
                className="ui-button ui-button-ghost w-full"
              >
                Бүртгүүлэх
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom stats + mobile CTA */}
        <div className="relative flex flex-wrap items-end justify-between gap-6 px-6 pb-10 md:px-12">
          <div className="flex gap-10">
            {[
              { value: totalSeats, label: "Seats" },
              { value: totalOpen,  label: "Open", live: true },
              { value: centers.length, label: "Centers" },
            ].map((s, i) => (
              <InView key={s.label} delay={400 + i * 80} from="up" distance={16}>
                <div>
                  <div
                    className="mono font-black text-black"
                    style={{ fontSize: "clamp(28px, 3.5vw, 52px)", letterSpacing: "-0.04em", lineHeight: 1 }}
                  >
                    {s.value > 0 ? (
                      <span className="flex items-center gap-2">
                        {s.live && (
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-black opacity-30" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-black" />
                          </span>
                        )}
                        <Counter value={s.value} duration={1200} className="mono" />
                      </span>
                    ) : (
                      <span className="text-black/12">—</span>
                    )}
                  </div>
                  <div className="mt-1 text-[8px] font-medium uppercase tracking-[0.28em] text-black/20">
                    {s.label}
                  </div>
                </div>
              </InView>
            ))}
          </div>

          {/* Mobile CTA */}
          <div className="flex gap-2 md:hidden">
            <Link
              href="/booking"
              className="ui-button ui-button-primary"
            >
              Захиалах
            </Link>
          </div>
        </div>
      </section>

      {/* ── CENTER INDEX ── */}
      <section className="pb-28">

        {/* Toolbar */}
        <div className="h-px bg-black/[0.07]" />
        <div className="flex flex-col gap-3 px-6 py-4 md:flex-row md:items-center md:justify-between md:px-12">

          <div className="flex items-center gap-3">
            <span className="text-[9px] font-medium uppercase tracking-[0.25em] text-black/25">Centers</span>
            <span className="mono text-[10px] text-black/14">{sorted.length}</span>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 border-b border-black/10 pb-1 md:w-52">
            <svg width="10" height="10" viewBox="0 0 20 20" fill="none" className="shrink-0 text-black/20">
              <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Хайх..."
              className="flex-1 bg-transparent text-[12px] text-black placeholder:text-black/18 outline-none"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-black/20 transition-colors hover:text-black">
                <svg width="9" height="9" viewBox="0 0 20 20" fill="none">
                  <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
              </button>
            )}
          </div>

          {/* Sort + district */}
          <div className="flex items-center gap-4">
            <div className="flex items-center">
              {(["rating", "price", "available"] as SortKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setSort(key)}
                  className={`rounded-lg px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.14em] transition-all ${
                    sort === key ? "bg-black text-white" : "text-black/30 hover:bg-black/[0.05] hover:text-black"
                  }`}
                >
                  {key === "rating" ? "Top" : key === "price" ? "Price" : "Open"}
                </button>
              ))}
            </div>
            <select
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className="bg-transparent text-[9px] font-medium uppercase tracking-[0.14em] text-black/24 outline-none transition-colors hover:text-black"
            >
              <option value="">All districts</option>
              {districts.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <div className="h-px bg-black/[0.07]" />

        {/* Loading skeleton — matches actual center row layout */}
        {loading && centers.length === 0 && (
          <div>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}>
                <CenterRowSkeleton index={i} />
                {i < 3 && <div className="mx-6 h-px bg-black/[0.04] md:mx-0" />}
              </div>
            ))}
          </div>
        )}

        {!loading && sorted.length === 0 && (
          <div className="flex flex-col items-center py-32">
            <div className="mb-4 h-px w-8 bg-black/[0.08]" />
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-black/18">
              {search ? `"${search}" олдсонгүй` : "No centers found"}
            </p>
          </div>
        )}

        {/* Center rows */}
        {sorted.map((c, i) => {
          const coverImg = getMainImage(c.images);
          const pct      = c.seatCount > 0 ? (c.availableSeats / c.seatCount) * 100 : 0;
          const isEven   = i % 2 === 0;

          return (
            <div key={c.id} className="group">
              <Link
                href={`/centers/${c.id}`}
                className="flex items-stretch transition-colors duration-300 hover:bg-white/55"
                style={{ minHeight: 200 }}
              >
                {/* Image */}
                <InView
                  from={isEven ? "left" : "right"}
                  distance={12}
                  delay={40}
                  duration={700}
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
                        className="object-cover grayscale opacity-65 transition-all duration-700 group-hover:scale-[1.02] group-hover:opacity-85"
                        sizes="38vw"
                      />
                    ) : (
                      <LazyImage
                        src={coverImg}
                        alt={c.name}
                        fill
                        className="object-cover grayscale opacity-65 transition-all duration-700 group-hover:scale-[1.02] group-hover:opacity-85"
                        sizes="38vw"
                      />
                    )
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/[0.025]">
                      <span
                        className="font-black text-black/06"
                        style={{ fontSize: "clamp(32px, 4vw, 64px)", letterSpacing: "-0.04em" }}
                      >
                        PC
                      </span>
                    </div>
                  )}
                  {/* Edge fade */}
                  <div
                    className={`pointer-events-none absolute inset-y-0 w-20 ${
                      isEven ? "right-0 bg-gradient-to-l" : "left-0 bg-gradient-to-r"
                    } from-white to-transparent transition-colors group-hover:from-white/95`}
                  />
                </InView>

                {/* Text block */}
                <div
                  className={`flex flex-1 flex-col justify-between px-6 py-10 md:px-10 md:py-12 ${
                    isEven ? "order-2" : "order-1"
                  }`}
                >
                  <InView from="up" distance={8} duration={550}>
                    <div className="flex items-center gap-4">
                      <span className="mono text-[10px] text-black/14">{String(i + 1).padStart(2, "0")}</span>
                      <span className="text-[8px] font-medium uppercase tracking-[0.24em] text-black/22">
                        {c.district}
                      </span>
                      {c.isVerified && (
                        <span className="text-[7px] font-semibold uppercase tracking-[0.2em] text-black/28">✓</span>
                      )}
                      {favIds.has(c.id) && (
                        <span className="text-[10px] text-black/35">♥</span>
                      )}
                    </div>
                  </InView>

                  <InView from={isEven ? "right" : "left"} distance={20} delay={40} duration={700}>
                    <h2
                      className="mt-3 font-black text-black transition-all duration-400 group-hover:opacity-30"
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "clamp(30px, 3.8vw, 68px)",
                        lineHeight: 0.86,
                        letterSpacing: "-0.05em",
                        fontWeight: 900,
                      }}
                    >
                      {c.name.toUpperCase()}
                    </h2>
                  </InView>

                  <InView from="up" distance={6} delay={80} duration={550}>
                    <div className="mt-4 flex flex-wrap items-center gap-5">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-black">★</span>
                        <span className="mono text-[11px] text-black/38">{c.rating.toFixed(1)}</span>
                        <span className="mono text-[9px] text-black/18">({c.reviewCount})</span>
                      </div>
                      <span className="mono text-[11px] text-black/30">
                        {c.minPricePerHour !== null ? `${c.minPricePerHour.toLocaleString()}₮/ц` : "—"}
                      </span>
                      <div className="flex items-center gap-2">
                        {c.availableSeats > 0 && (
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-black opacity-25" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-black" />
                          </span>
                        )}
                        <span className="mono text-[10px] text-black/24">{c.availableSeats}/{c.seatCount}</span>
                        <div className="relative h-px w-10 overflow-hidden bg-black/[0.06]">
                          <div className="absolute inset-y-0 left-0 bg-black/35" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <span className="ml-auto text-[10px] text-black/14 transition-all duration-300 group-hover:translate-x-1 group-hover:text-black/55">
                        →
                      </span>
                    </div>
                  </InView>
                </div>
              </Link>

              {i < sorted.length - 1 && (
                <div className="mx-6 h-px bg-black/[0.05] md:mx-0" />
              )}
            </div>
          );
        })}
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-black px-6 py-14 md:px-12">
        <div className="mx-auto max-w-screen-xl">
          <div className="flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
            <div>
              <span
                className="font-black text-white/08"
                style={{ fontSize: "clamp(28px, 4vw, 52px)", letterSpacing: "-0.05em", lineHeight: 1 }}
              >
                REIHEN
              </span>
              <p className="mt-3 max-w-xs text-[11px] font-light leading-relaxed text-white/16">
                Улаанбаатарын PC gaming center-үүдийн нэгдсэн захиалгын систем.
              </p>
            </div>
            <div className="flex flex-wrap gap-6 text-[9px] font-medium uppercase tracking-[0.24em] text-white/16">
              <Link href="/booking" className="transition-colors hover:text-white">Захиалах</Link>
              <Link href="/events"  className="transition-colors hover:text-white">Events</Link>
              <Link href="/profile" className="transition-colors hover:text-white">Профайл</Link>
            </div>
          </div>
          <div className="mt-10 h-px bg-white/[0.05]" />
          <div className="mt-5 flex items-center justify-between">
            <span className="mono text-[8px] font-medium uppercase tracking-[0.24em] text-white/10">
              © 2026 REIHEN · ULAANBAATAR
            </span>
            <span className="mono text-[8px] font-medium uppercase tracking-[0.24em] text-white/10">v2.0</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
