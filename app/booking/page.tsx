"use client";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { SeatCell, SeatLegend, type SeatStatus } from "@/components/SeatCell";
import { InView } from "@/components/InView";
import { useAuth } from "@/lib/useAuth";
import { apiFetch } from "@/lib/api";
import { useSeatSocket, type SeatUpdate } from "@/lib/useSeatSocket";

const BlueprintSeatMap = dynamic(
  () => import("@/components/BlueprintSeatMap").then((m) => m.BlueprintSeatMap),
  {
    ssr: false,
    loading: () => <div className="h-48 animate-pulse bg-white/[0.03]" />,
  }
);
const Confetti = dynamic(() => import("@/components/Confetti").then((m) => m.Confetti), { ssr: false });
const Typewriter = dynamic(() => import("@/components/Typewriter").then((m) => m.Typewriter), {
  ssr: false,
});

interface SeatData {
  id: string;
  number: string;
  status: SeatStatus;
  floor: { id: string; floorNumber: number; name: string };
  type: { id: string; name: string; pricePerHour: number };
  freeAt: string | null;
  posX: number | null;
  posY: number | null;
  currentUser: { maskedName: string } | null;
}

const HOURS = Array.from({ length: 14 }, (_, i) => `${String(10 + i).padStart(2, "0")}:00`);

export default function BookingPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <span className="label text-[9px] text-white/20 animate-pulse">LOADING</span>
      </div>
    }>
      <BookingInner />
    </Suspense>
  );
}

function BookingInner() {
  const { token } = useAuth();
  const params = useSearchParams();

  const centerId = params.get("center") ?? "";
  const preselect = params.get("seat") ?? "";

  const [seats, setSeats] = useState<SeatData[]>([]);
  const [centerName, setCenterName] = useState("CENTER");
  const [maxSeats, setMaxSeats] = useState(10);
  const [floor, setFloor] = useState<number>(1);
  const [selectedSeats, setSelectedSeats] = useState<string[]>(preselect ? [preselect] : []);
  const [start, setStart] = useState<string | null>(null);
  const [hours, setHours] = useState(1);
  const [method, setMethod] = useState<"QPAY" | "BALANCE">("QPAY");
  const [code, setCode] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [mapView, setMapView] = useState<"grid" | "blueprint">("grid");
  // track whether we've already auto-switched (ref avoids adding to effect deps)
  const autoSwitchedRef = useRef(false);

  const loadCenterSeats = useCallback(() => {
    if (!centerId) return;
    apiFetch<{ center: { name: string; maxSeatsPerBooking?: number }; seats: SeatData[] }>(`/api/centers/${centerId}/seats`)
      .then(({ center, seats: s }) => {
        setCenterName(center.name);
        setMaxSeats(center.maxSeatsPerBooking ?? 10);
        setSeats(s);
        if (s.length) setFloor(s[0].floor.floorNumber);
        // auto-switch to map view if any seat has a saved position
        if (!autoSwitchedRef.current && s.some((x) => x.posX !== null && x.posY !== null)) {
          setMapView("blueprint");
          autoSwitchedRef.current = true;
        }
      })
      .catch(() => {});
  }, [centerId]);

  useEffect(() => {
    loadCenterSeats();
  }, [loadCenterSeats]);

  useEffect(() => {
    if (!centerId) return;
    const interval = setInterval(loadCenterSeats, 4_000);
    return () => clearInterval(interval);
  }, [centerId, loadCenterSeats]);

  const handleUpdate = useCallback((u: SeatUpdate) => {
    setSeats((prev) =>
      prev.map((s) => s.id === u.id ? { ...s, status: u.status, freeAt: u.freeAt ?? s.freeAt } : s)
    );
    if (u.status !== "OPEN") setSelectedSeats((prev) => prev.filter((id) => id !== u.id));
  }, []);
  useSeatSocket(centerId, handleUpdate, token);

  const floors = useMemo(
    () =>
      Array.from(new Set(seats.map((s) => s.floor.floorNumber)))
        .sort()
        .map((n) => ({ n, name: seats.find((s) => s.floor.floorNumber === n)!.floor.name })),
    [seats]
  );

  const view = seats.filter((s) => s.floor.floorNumber === floor);
  const pickedSeats = seats.filter((s) => selectedSeats.includes(s.id));
  const otherFloorCount = pickedSeats.filter((s) => s.floor.floorNumber !== floor).length;
  const rate = pickedSeats.length === 1 ? pickedSeats[0].type.pricePerHour : 0;
  const total = pickedSeats.reduce((sum, s) => sum + s.type.pricePerHour * hours, 0);

  const slots = useMemo(() => {
    if (!start) return [];
    const idx = HOURS.indexOf(start);
    return idx < 0 ? [] : HOURS.slice(idx, idx + hours);
  }, [start, hours]);

  const consecutive =
    slots.length === hours &&
    slots.every((h, i) => i === 0 || parseInt(h) - parseInt(slots[i - 1]) === 1);
  const canSubmit =
    pickedSeats.length > 0 &&
    pickedSeats.every((s) => s.status === "OPEN") &&
    consecutive && !submitting && token;
  const activeStep = pickedSeats.length === 0 ? 1 : !start ? 2 : total <= 0 ? 3 : 4;

  const submit = async () => {
    if (!canSubmit || !start) return;
    setError("");
    setSubmitting(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await apiFetch<{ booking: { code: string } }>("/api/bookings", {
        method: "POST",
        token,
        body: JSON.stringify({
          seatIds: selectedSeats,
          startTime: new Date(`${today}T${start}:00`).toISOString(),
          hours,
          paymentMethod: method,
        }),
      });
      setCode(res.booking.code);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message ?? "Booking failed");
    } finally {
      setSubmitting(false);
    }
  };

  /* ── NO CENTER SELECTED ── */
  if (!centerId) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0a] text-white">
        <InView from="up" duration={700}>
          <h1 className="display text-[12vw] text-white/20">SELECT</h1>
          <h1 className="display text-[12vw] text-white">A CENTER</h1>
          <Link
            href="/"
            className="mt-10 block text-center text-[10px] uppercase tracking-[0.25em] text-white/25 transition-colors hover:text-white/60"
          >
            ← Browse centers
          </Link>
        </InView>
      </main>
    );
  }

  /* ── SUCCESS ── */
  if (success && code) {
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0a0a0a] text-white">
        <Confetti />

        {/* Ambient glow */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-[600px] w-[600px] rounded-full bg-white/[0.02] blur-[100px]" />
        </div>

        <InView from="up" distance={20} duration={600}>
          <span className="label block text-center text-[9px] text-white/20">BOOKING CONFIRMED</span>
        </InView>

        <InView from="up" distance={40} delay={200} duration={1000}>
          <div className="relative my-8 text-center">
            <div
              className="display mono select-all text-white"
              style={{ fontSize: "clamp(64px, 18vw, 200px)", lineHeight: 0.85, letterSpacing: "-0.05em" }}
            >
              <Typewriter text={code} speed={100} delay={500} className="inline" />
            </div>
            <div className="mt-2 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </div>
        </InView>

        <InView from="up" distance={20} delay={400} duration={700}>
          <p className="mono text-center text-sm text-white/25">
            {pickedSeats.map((s) => s.number).join(", ")}
            &nbsp;·&nbsp;{start}
            &nbsp;·&nbsp;{hours}ц
            &nbsp;·&nbsp;{total.toLocaleString()}₮
          </p>
        </InView>

        <InView from="up" distance={20} delay={600} duration={700}>
          <div className="mt-12 flex gap-3">
            <Link
              href="/"
              className="rounded-full border border-white/15 px-7 py-3.5 text-[10px] uppercase tracking-[0.2em] transition-all duration-300 hover:border-white/40 hover:bg-white hover:text-black"
            >
              Home
            </Link>
            <button
              onClick={() => { setSuccess(false); setCode(null); setSelectedSeats([]); setStart(null); }}
              className="rounded-full bg-white/[0.06] px-7 py-3.5 text-[10px] uppercase tracking-[0.2em] transition-all duration-300 hover:bg-white/10"
            >
              New booking
            </button>
          </div>
        </InView>
      </main>
    );
  }

  /* ── MAIN BOOKING UI ── */
  const submitLabel = submitting
    ? "PROCESSING..."
    : canSubmit
    ? `CONFIRM · ${pickedSeats.length} SEAT${pickedSeats.length > 1 ? "S" : ""} →`
    : pickedSeats.length === 0
    ? "SELECT A SEAT"
    : !pickedSeats.every((s) => s.status === "OPEN")
    ? "SEAT UNAVAILABLE"
    : !start
    ? "SELECT START TIME"
    : !consecutive
    ? "INVALID TIME RANGE"
    : "SELECT SEAT & TIME";

  return (
    <main className="grid min-h-screen grid-cols-1 bg-[#0a0a0a] text-white md:grid-cols-[3fr_2fr]">

      {/* ── LEFT — SEAT SELECTION ── */}
      <section className="flex flex-col px-6 pb-20 pt-8 md:px-12 md:pt-10">

        {/* Nav */}
        <InView from="up" distance={12} duration={600}>
          <div className="mb-10 flex items-center justify-end pt-20">
            <span className="label text-[9px] text-white/30">{centerName.toUpperCase()}</span>
          </div>
        </InView>

        <InView from="up" distance={12} delay={60} duration={600}>
          <div className="mb-10 grid grid-cols-4 overflow-hidden border border-white/[0.06] bg-white/[0.02]">
            {[
              { n: 1, label: "Seat", done: pickedSeats.length > 0 },
              { n: 2, label: "Time", done: Boolean(start) && consecutive },
              { n: 3, label: "Duration", done: total > 0 },
              { n: 4, label: "Payment", done: false },
            ].map((step) => (
              <div
                key={step.n}
                className={`border-r border-white/[0.06] px-3 py-3 last:border-r-0 ${
                  step.done ? "bg-green-500/[0.08]" : activeStep === step.n ? "bg-white/[0.06]" : ""
                }`}
              >
                <div className="mono text-[10px] text-white/25">0{step.n}</div>
                <div className={`mt-1 text-[9px] uppercase tracking-widest ${
                  step.done ? "text-green-300" : activeStep === step.n ? "text-white/70" : "text-white/20"
                }`}>
                  {step.label}
                </div>
              </div>
            ))}
          </div>
        </InView>

        {/* Heading */}
        <div className="mb-12">
          <div className="overflow-hidden">
            <h1
              className="anim-hero anim-d1 display text-white"
              style={{ fontSize: "clamp(52px, 8vw, 120px)", lineHeight: 0.85 }}
            >
              BOOK
            </h1>
          </div>
          <div className="overflow-hidden">
            <h1
              className="anim-hero anim-d2 display text-white/30"
              style={{ fontSize: "clamp(52px, 8vw, 120px)", lineHeight: 0.85 }}
            >
              A SEAT.
            </h1>
          </div>
        </div>

        {/* ── 01 SEAT MAP ── */}
        <InView from="up" distance={24} delay={100} duration={800}>
          <div className="mb-12">
            <div className="mb-5 flex items-center justify-between">
              <span className="label text-[9px] text-white/25">01 · SEAT</span>
              <div className="flex items-center gap-4">
                {/* View toggle — pill style */}
                <div className="flex overflow-hidden rounded-full bg-white/[0.04]">
                  {(["grid", "blueprint"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setMapView(v)}
                      className={`px-3 py-1 text-[9px] uppercase tracking-[0.15em] transition-all duration-300 ${
                        mapView === v ? "bg-white/[0.08] text-white" : "text-white/20 hover:text-white/40"
                      }`}
                    >
                      {v === "grid" ? "Grid" : "Map"}
                    </button>
                  ))}
                </div>
                <span className={`mono text-[10px] transition-colors duration-300 ${pickedSeats.length >= maxSeats ? "text-white/70" : "text-white/25"}`}>
                  {pickedSeats.length}/{maxSeats}
                </span>
                {pickedSeats.length > 0 && (
                  <button
                    onClick={() => setSelectedSeats([])}
                    className="label text-[8px] text-white/20 transition-colors hover:text-white/50"
                  >
                    clear
                  </button>
                )}
              </div>
            </div>

            {/* Floor tabs */}
            {floors.length > 1 && (
              <div className="mb-4 flex gap-6">
                {floors.map((f) => (
                  <button
                    key={f.n}
                    onClick={() => setFloor(f.n)}
                    className={`label text-[9px] transition-all duration-300 ${
                      floor === f.n ? "text-white" : "text-white/20 hover:text-white/40"
                    }`}
                  >
                    {f.name || `FLOOR 0${f.n}`}
                    {floor === f.n && (
                      <span className="ml-2 inline-block h-px w-4 align-middle bg-white/40" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Other-floor notice */}
            {otherFloorCount > 0 && (
              <div className="mb-4 flex items-center justify-between bg-white/[0.03] px-4 py-2.5">
                <span className="label text-[8px] text-white/30">
                  {otherFloorCount} seat{otherFloorCount > 1 ? "s" : ""} on other floor
                </span>
                <button
                  onClick={() => setSelectedSeats((prev) =>
                    prev.filter((id) => seats.find((s) => s.id === id)?.floor.floorNumber === floor)
                  )}
                  className="label text-[8px] text-white/20 hover:text-white/50"
                >
                  remove
                </button>
              </div>
            )}

            {mapView === "grid" ? (
              <div className="grid grid-cols-4 gap-2 bg-white/[0.02] p-4 md:grid-cols-10">
                {view.map((s) => (
                  <SeatCell
                    key={s.id}
                    number={s.number}
                    status={s.status}
                    selected={selectedSeats.includes(s.id)}
                    onClick={() => {
                      if (s.status !== "OPEN") return;
                      setSelectedSeats((prev) =>
                        prev.includes(s.id)
                          ? prev.filter((id) => id !== s.id)
                          : prev.length >= maxSeats ? prev : [...prev, s.id]
                      );
                    }}
                  />
                ))}
              </div>
            ) : (
              <BlueprintSeatMap
                seats={view.map((s) => ({
                  id: s.id, number: s.number, status: s.status,
                  posX: s.posX, posY: s.posY, freeAt: s.freeAt,
                  typeName: s.type.name,
                }))}
                selectedIds={new Set(selectedSeats)}
                onToggle={(id) => {
                  const seat = seats.find((s) => s.id === id);
                  if (!seat || seat.status !== "OPEN") return;
                  setSelectedSeats((prev) =>
                    prev.includes(id)
                      ? prev.filter((x) => x !== id)
                      : prev.length >= maxSeats ? prev : [...prev, id]
                  );
                }}
                floorName={floors.find((f) => f.n === floor)?.name}
              />
            )}

            <div className="mt-3">
              <SeatLegend />
            </div>
          </div>
        </InView>

        {/* ── 02 TIME ── */}
        <InView from="up" distance={24} delay={180} duration={800}>
          <div className="mb-12">
            <span className="label mb-5 block text-[9px] text-white/25">02 · START TIME</span>
            <div className="grid grid-cols-3 gap-1.5 md:grid-cols-7">
              {HOURS.map((h) => (
                <button
                  key={h}
                  onClick={() => setStart(h)}
                  className={`mono py-3 text-[11px] transition-all duration-300 ${
                    start === h
                      ? "bg-white text-black"
                      : "border border-white/[0.10] bg-white/[0.04] text-white/50 hover:border-white/20 hover:bg-white/[0.09] hover:text-white/80"
                  }`}
                >
                  {h}
                </button>
              ))}
            </div>
            {start && !consecutive && (
              <p className="mt-3 text-[9px] uppercase tracking-[0.2em] text-white/30">
                ✕ exceeds available range
              </p>
            )}
          </div>
        </InView>

        {/* ── 03 DURATION ── */}
        <InView from="up" distance={24} delay={240} duration={800}>
          <div className="mb-12">
            <span className="label mb-5 block text-[9px] text-white/25">03 · DURATION</span>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 6, 8].map((h) => (
                <button
                  key={h}
                  onClick={() => setHours(h)}
                  className={`mono px-5 py-3 text-sm transition-all duration-300 ${
                    hours === h
                      ? "bg-white text-black"
                      : "border border-white/[0.10] bg-white/[0.04] text-white/50 hover:border-white/20 hover:bg-white/[0.09] hover:text-white/80"
                  }`}
                >
                  {h}h
                </button>
              ))}
            </div>
          </div>
        </InView>

        {/* ── 04 PAYMENT ── */}
        <InView from="up" distance={24} delay={300} duration={800}>
          <div>
            <span className="label mb-5 block text-[9px] text-white/25">04 · PAYMENT</span>
            <div className="flex gap-2">
              {(["QPAY", "BALANCE"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`flex-1 py-3 text-[10px] uppercase tracking-[0.2em] transition-all duration-300 ${
                    method === m
                      ? "bg-white text-black"
                      : "border border-white/[0.10] bg-white/[0.04] text-white/50 hover:border-white/20 hover:bg-white/[0.09] hover:text-white/80"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            {method === "QPAY" && (
              <div className="mt-3 border border-yellow-400/15 bg-yellow-400/[0.06] px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[9px] uppercase tracking-widest text-yellow-200/70">
                    Payment window
                  </span>
                  <span className="mono text-xs text-yellow-200">15:00</span>
                </div>
                <p className="mt-1 text-[10px] leading-5 text-white/30">
                  QPay pending booking expires automatically if it is not paid in time.
                </p>
              </div>
            )}
          </div>
        </InView>
      </section>

      {/* ── RIGHT — SUMMARY ── */}
      <aside className="flex flex-col justify-between bg-[#0d0d0d] px-6 py-10 md:sticky md:top-0 md:h-screen md:px-10">

        <InView from="right" distance={20} duration={700}>
          <div>
            <span className="label text-[9px] text-white/30">SUMMARY</span>

            {/* Stats */}
            <div className="mt-8 space-y-5">
              {[
                { label: "SEATS", value: pickedSeats.length ? pickedSeats.map((s) => s.number).join(", ") : "—" },
                { label: "FLOOR", value: floors.find((f) => f.n === floor)?.name ?? `0${floor}` },
                { label: "START", value: start ?? "—" },
                { label: "HOURS", value: hours + "h" },
                { label: "METHOD", value: method },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-baseline justify-between">
                  <span className="label text-[8px] text-white/30">{label}</span>
                  <span className="mono text-[13px] text-white/70">{value}</span>
                </div>
              ))}
            </div>

            {/* Divider — gradient fade */}
            <div className="my-8 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

            {/* Total */}
            <div className="flex items-baseline justify-between">
              <span className="label text-[9px] text-white/20">TOTAL</span>
              <span
                className="display mono text-white transition-all duration-500"
                style={{ fontSize: "clamp(32px, 4vw, 56px)", letterSpacing: "-0.04em" }}
              >
                {total > 0 ? `${total.toLocaleString()}₮` : "—"}
              </span>
            </div>

            {error && (
              <div className="mt-6 bg-white/[0.03] px-4 py-3 text-[9px] uppercase tracking-[0.2em] text-white/40">
                ✕ {error}
              </div>
            )}
          </div>
        </InView>

        {/* CTA */}
        <InView from="up" distance={20} delay={200} duration={700}>
          <div>
            {!token ? (
              <Link
                href="/login"
                className="block w-full bg-white py-4 text-center text-[10px] uppercase tracking-[0.2em] text-black transition-all duration-300 hover:bg-white/80"
              >
                Login to book →
              </Link>
            ) : (
              <button
                onClick={submit}
                disabled={!canSubmit}
                className="w-full bg-white py-4 text-[10px] uppercase tracking-[0.2em] text-black transition-all duration-500 hover:bg-white/90 disabled:border disabled:border-white/[0.12] disabled:bg-transparent disabled:text-white/25"
              >
                {submitLabel}
              </button>
            )}
            <p className="mt-4 text-center text-[8px] uppercase tracking-[0.15em] text-white/10">
              Cancel 30 min prior · No-show after 60 min
            </p>
          </div>
        </InView>
      </aside>
    </main>
  );
}
