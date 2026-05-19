"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { DashStatSkeleton } from "@/components/Skeleton";
import { SeatCell, SeatLegend, type SeatStatus } from "@/components/SeatCell";
import { Counter } from "@/components/SplitFlap";
import { useAuth } from "@/lib/useAuth";
import { apiFetch } from "@/lib/api";
import { useSeatSocket, type SeatUpdate } from "@/lib/useSeatSocket";
import { useNotificationSound } from "@/lib/useNotificationSound";

const BlueprintSeatMap = dynamic(
  () => import("@/components/BlueprintSeatMap").then((m) => m.BlueprintSeatMap),
  {
    ssr: false,
    loading: () => <div className="h-48 animate-pulse bg-white/[0.03]" />,
  }
);

interface Booking {
  id: string;
  code: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "NOSHOW";
  startTime: string;
  hours: number;
  totalPrice: number;
  bookingSeats: { seatId: string; seat: { number: string; status: string } }[];
  user: { id: string; name: string; phone: string; noShowCount: number; isRestricted: boolean; restrictionReason?: string | null; restrictedUntil?: string | null };
}

interface RiskCustomer {
  id: string;
  name: string;
  phone: string;
  noShowCount: number;
  bookingCount: number;
  riskScore: number;
  isRestricted: boolean;
  restrictionReason?: string | null;
  restrictedUntil?: string | null;
}

interface DashData {
  centerIds: string[];
  today: {
    income: number;
    bookingCount: number;
    openSeats: number;
    totalSeats: number;
    occupancy: number;
    avgRevenue: number;
    paidBookings: number;
    noShows: number;
    seatStatus: Record<string, number>;
  };
  systemStatus: {
    clerk: boolean;
    legacyAuth: boolean;
    paymentMode: string;
    smsMode: string;
    realtime: string;
  };
  conflictProtection: {
    serializableBooking: boolean;
    qpayCallbackRecheck: boolean;
    extendRecheck: boolean;
    seatOpenGuard: boolean;
  };
  peakHours: { hour: number; count: number; income: number }[];
  recentBookings: Booking[];
  riskCustomers: RiskCustomer[];
  auditLogs: {
    id: string;
    action: string;
    message: string;
    targetType: string;
    targetId?: string | null;
    createdAt: string;
    actor: { id: string; name: string; role: string };
  }[];
}

interface SeatData {
  id: string;
  number: string;
  status: SeatStatus;
  typeName?: string | null;
  posX?: number | null;
  posY?: number | null;
}

interface CenterItem {
  id: string;
  name: string;
  address: string;
  district: string;
  _count: { seats: number; bookings: number; reviews: number };
}

const STATUSES: SeatStatus[] = ["OPEN", "CLOSED", "REPAIR", "WAITING", "OCCUPIED"];

export default function OwnerDashboard() {
  const { token, user, loading: authLoading } = useAuth();
  const [dash, setDash] = useState<DashData | null>(null);
  const [centers, setCenters] = useState<CenterItem[]>([]);
  const [seats, setSeats] = useState<SeatData[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [checkedInIds, setCheckedInIds] = useState<Set<string>>(new Set());
  const [seatView, setSeatView] = useState<"grid" | "grouped" | "blueprint">("grid");
  const [activeCenterId, setActiveCenterId] = useState("");
  const [inspectedBookingId, setInspectedBookingId] = useState<string | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { enabled: soundEnabled, enable: enableSound, play: playSound } = useNotificationSound();

  const centerId = activeCenterId || dash?.centerIds?.[0] || centers[0]?.id || "";
  const activeCenter = centers.find((c) => c.id === centerId) ?? null;
  const selectedStatus = selectedSeats.size
    ? Array.from(selectedSeats)
        .map((id) => seats.find((s) => s.id === id)?.status)
        .filter(Boolean)
    : [];

  const loadDashboard = useCallback(() => {
    if (!token || !activeCenterId) return;
    apiFetch<DashData>(`/api/owner/dashboard?centerId=${encodeURIComponent(activeCenterId)}`, { token })
      .then(setDash)
      .catch(() => {});
  }, [token, activeCenterId]);

  const refreshDashboardSoon = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      loadDashboard();
    }, 250);
  }, [loadDashboard]);

  useEffect(() => {
    if (activeCenterId) loadDashboard();
  }, [activeCenterId, loadDashboard]);

  useEffect(() => {
    if (!token || !activeCenterId) return;
    const interval = setInterval(loadDashboard, 2_000);
    return () => clearInterval(interval);
  }, [token, activeCenterId, loadDashboard]);

  useEffect(() => {
    if (!token) return;
    apiFetch<{ centers: CenterItem[] }>("/api/owner/centers", { token })
      .then(({ centers: c }) => {
        setCenters(c);
        setActiveCenterId((current) => current || c[0]?.id || "");
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, []);

  const loadSeats = useCallback(() => {
    if (!centerId || !token) return;
    apiFetch<{ seats: { id: string; number: string; status: SeatStatus; type: { name: string } }[] }>(
      `/api/centers/${centerId}/seats`
    )
      .then(({ seats: s }) => setSeats(s.map((x: any) => ({ id: x.id, number: x.number, status: x.status, typeName: x.type?.name ?? null, posX: x.posX ?? null, posY: x.posY ?? null }))))
      .catch(() => {});
  }, [centerId, token]);

  useEffect(() => {
    loadSeats();
  }, [loadSeats]);

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(loadSeats, 4_000);
    return () => clearInterval(interval);
  }, [token, loadSeats]);

  useEffect(() => {
    setSelectedSeats(new Set());
  }, [centerId]);

  const handleSeatUpdate = useCallback(
    (u: SeatUpdate) => {
      setSeats((prev) => prev.map((s) => (s.id === u.id ? { ...s, status: u.status } : s)));
      refreshDashboardSoon();
    },
    [refreshDashboardSoon]
  );
  const handleBookingRealtime = useCallback(() => {
    playSound();
    refreshDashboardSoon();
  }, [playSound, refreshDashboardSoon]);

  useSeatSocket(centerId, handleSeatUpdate, token, handleBookingRealtime);

  const changeSeatStatus = async (ids: string[], status: SeatStatus) => {
    if (!token || ids.length === 0) return;
    setBulkBusy(true);
    try {
      await Promise.all(
        ids.map((id) =>
          apiFetch(`/api/owner/seats/${id}/status`, {
            method: "PATCH",
            token,
            body: JSON.stringify({ status }),
          })
        )
      );
      setSeats((prev) => prev.map((s) => (ids.includes(s.id) ? { ...s, status } : s)));
      setSelectedSeats(new Set());
    } catch {}
    setBulkBusy(false);
  };

  const toggleSeatSelect = (id: string) => {
    setSelectedSeats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const inspectOrSelectSeat = (seat: SeatData) => {
    const booking = dash?.recentBookings.find(
      (b) =>
        (b.status === "PENDING" || b.status === "CONFIRMED") &&
        b.bookingSeats.some((bs) => bs.seatId === seat.id)
    );
    if ((seat.status === "WAITING" || seat.status === "OCCUPIED") && booking) {
      setInspectedBookingId(booking.id);
      return;
    }
    toggleSeatSelect(seat.id);
  };

  const selectAllByStatus = (status: SeatStatus) => {
    setSelectedSeats(new Set(seats.filter((s) => s.status === status).map((s) => s.id)));
  };

  const markArrived = async (id: string) => {
    if (!token) return;
    setBusy(id);
    try {
      await apiFetch(`/api/owner/bookings/${id}/checkin`, { method: "PATCH", token });
      setCheckedInIds((prev) => new Set(prev).add(id));
      const booking = dash?.recentBookings.find((b) => b.id === id);
      const seatIds = booking?.bookingSeats.map((bs) => bs.seatId) ?? [];
      setDash((d) =>
        d
          ? {
              ...d,
              recentBookings: d.recentBookings.map((b) =>
                b.id === id
                  ? { ...b, status: "CONFIRMED", bookingSeats: b.bookingSeats.map((bs) => ({ ...bs, seat: { ...bs.seat, status: "OCCUPIED" } })) }
                  : b
              ),
            }
          : d
      );
      if (seatIds.length > 0) {
        setSeats((prev) =>
          prev.map((s) => (seatIds.includes(s.id) ? { ...s, status: "OCCUPIED" as SeatStatus } : s))
        );
      }
    } catch {}
    setBusy(null);
  };

  const markNoShow = async (id: string) => {
    if (!token) return;
    setBusy(id);
    try {
      await apiFetch(`/api/owner/bookings/${id}/noshow`, { method: "PATCH", token });
      setDash((d) =>
        d
          ? {
              ...d,
              recentBookings: d.recentBookings.map((b) =>
                b.id === id ? { ...b, status: "NOSHOW" } : b
              ),
            }
          : d
      );
    } catch {}
    setBusy(null);
  };

  const setCustomerRestriction = async (customerId: string, restricted: boolean) => {
    if (!token) return;
    setBusy(customerId);
    try {
      await apiFetch(`/api/owner/customers/${customerId}/restriction`, {
        method: "PATCH",
        token,
        body: JSON.stringify(
          restricted
            ? { action: "unrestrict" }
            : { action: "restrict", days: 7, reason: "Repeated no-show or risky booking behavior" }
        ),
      });
      setDash((d) =>
        d
          ? {
              ...d,
              riskCustomers: d.riskCustomers.map((c) =>
                c.id === customerId
                  ? {
                      ...c,
                      isRestricted: !restricted,
                      restrictionReason: restricted ? null : "Repeated no-show or risky booking behavior",
                      restrictedUntil: restricted ? null : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                    }
                  : c
              ),
            }
          : d
      );
    } catch {}
    setBusy(null);
  };

  if (authLoading) {
    return (
      <main className="min-h-screen bg-[#080808] text-white">
        <header className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4 md:px-8">
          <div className="h-2 w-14 animate-pulse bg-white/[0.06]" />
          <div className="h-3 w-24 animate-pulse bg-white/[0.06]" />
          <div className="h-2 w-10 animate-pulse bg-white/[0.06]" />
        </header>
        <div className="p-4 md:p-6 lg:p-8">
          <div className="grid auto-rows-[minmax(140px,auto)] grid-cols-2 gap-2 md:grid-cols-6 md:gap-3 lg:grid-cols-12">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="col-span-1 md:col-span-3">
                <DashStatSkeleton />
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }
  if (!user || (user.role !== "OWNER" && user.role !== "ADMIN")) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#0a0a0a]">
        <h1 className="display text-5xl text-white">OWNERS ONLY</h1>
        <Link href="/login" className="text-xs uppercase tracking-[0.3em] text-white/40 hover:text-white">
          НЭВТРЭХ →
        </Link>
      </main>
    );
  }

  const t           = dash?.today;
  const openCount   = seats.filter((s) => s.status === "OPEN").length;
  const occupiedCount = seats.filter((s) => s.status === "OCCUPIED").length;
  const dashLoading = !dash && !authLoading;
  const inspectedBooking = inspectedBookingId
    ? dash?.recentBookings.find((b) => b.id === inspectedBookingId) ?? null
    : null;

  return (
    <main className="owner-dark min-h-screen text-white">
      {/* Header */}
      <header className="owner-topbar flex flex-wrap items-center justify-between gap-3 px-5 py-4 md:px-8">
        <Link href="/" className="text-xs uppercase tracking-[0.3em] text-white/40 hover:text-white transition-colors">← HOME</Link>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
          <span className="display text-lg">DASHBOARD</span>
        </div>
        <div className="flex items-center gap-5">
          <Link href="/owner/staff" className="text-[10px] uppercase tracking-[0.3em] text-white/30 hover:text-white transition-colors">STAFF</Link>
          <Link href="/owner/reviews" className="text-[10px] uppercase tracking-[0.3em] text-white/30 hover:text-white transition-colors">REVIEWS</Link>
          <Link href="/owner/subscription" className="text-[10px] uppercase tracking-[0.3em] text-white/30 hover:text-white transition-colors">PLAN</Link>
          <button
            type="button"
            onClick={enableSound}
            className={`text-[10px] uppercase tracking-[0.3em] transition-colors ${
              soundEnabled ? "text-green-300" : "text-white/30 hover:text-white"
            }`}
          >
            SOUND {soundEnabled ? "ON" : "OFF"}
          </button>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-[10px] font-black">
            {user.name.charAt(0).toUpperCase()}
          </div>
        </div>
      </header>

      {/* Skeleton while dash data loads */}
      {dashLoading && (
        <div className="grid grid-cols-2 gap-2 p-4 md:grid-cols-4 md:gap-3 md:p-6">
          {Array.from({ length: 4 }).map((_, i) => <DashStatSkeleton key={i} />)}
        </div>
      )}

      {/* Bento Grid */}
      <div className="px-4 pb-8 md:px-6 lg:px-8">
        <div className="grid auto-rows-[minmax(140px,auto)] grid-cols-2 gap-2 md:grid-cols-6 md:gap-3 lg:grid-cols-12">

          {/* Income — large tile */}
          <div className="col-span-1 row-span-1 flex flex-col justify-between border border-white/[0.06] bg-white/[0.03] p-4 md:col-span-3 md:p-6">
            <span className="text-[10px] uppercase tracking-[0.3em] text-white/30">INCOME</span>
            <div>
              <div className="mono font-black text-white" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px, 4vw, 48px)", letterSpacing: "-0.05em", lineHeight: 1 }}>
                {t ? <><Counter value={Math.round(t.income / 1000)} duration={1200} className="mono" /><span className="text-lg text-white/28">K₮</span></> : "—"}
              </div>
              <div className="mt-1 text-[10px] text-white/20">ӨНӨӨДӨР</div>
            </div>
          </div>

          {/* Bookings count */}
          <div className="col-span-1 row-span-1 flex flex-col justify-between border border-white/[0.06] bg-white/[0.03] p-4 md:col-span-3 md:p-6">
            <span className="text-[10px] uppercase tracking-[0.3em] text-white/30">BOOKINGS</span>
            <div>
              <div className="display mono text-4xl md:text-5xl">
                {t ? <Counter value={t.bookingCount} duration={1000} className="mono" /> : "—"}
              </div>
              <div className="mt-1 text-[10px] text-white/20">ӨНӨӨДӨР</div>
            </div>
          </div>

          {/* Occupancy — ring */}
          <div className="col-span-1 row-span-1 flex flex-col items-center justify-center border border-white/[0.06] bg-white/[0.03] p-4 md:col-span-3 md:p-6">
            <div className="relative flex h-20 w-20 items-center justify-center">
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                <circle
                  cx="40" cy="40" r="34" fill="none"
                  stroke={t && t.occupancy > 0.8 ? "#f87171" : t && t.occupancy > 0.5 ? "#fbbf24" : "#4ade80"}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${(t?.occupancy ?? 0) * 213.6} 213.6`}
                />
              </svg>
              <span className="display mono text-xl">{t ? `${Math.round(t.occupancy * 100)}%` : "—"}</span>
            </div>
            <span className="mt-2 text-[9px] uppercase tracking-[0.3em] text-white/30">OCCUPANCY</span>
          </div>

          {/* Seat status mini — open / occupied / total */}
          <div className="col-span-1 row-span-1 flex flex-col justify-between border border-white/[0.06] bg-white/[0.03] p-4 md:col-span-3 md:p-6">
            <span className="text-[10px] uppercase tracking-[0.3em] text-white/30">SEATS</span>
            <div className="flex items-end gap-4">
              <div>
                <div className="display mono text-3xl text-green-400">{openCount}</div>
                <div className="text-[9px] text-white/20">OPEN</div>
              </div>
              <div>
                <div className="display mono text-3xl text-red-400">{occupiedCount}</div>
                <div className="text-[9px] text-white/20">BUSY</div>
              </div>
              <div>
                <div className="display mono text-3xl text-white/30">{seats.length}</div>
                <div className="text-[9px] text-white/20">TOTAL</div>
              </div>
            </div>
          </div>

          {dash && (
            <div className="col-span-2 row-span-1 grid grid-cols-2 gap-px overflow-hidden border border-white/[0.06] bg-white/[0.06] md:col-span-6 lg:col-span-6">
              {[
                ["AVG SALE", `${dash.today.avgRevenue.toLocaleString()}₮`],
                ["PAID", String(dash.today.paidBookings)],
                ["NO-SHOW", String(dash.today.noShows)],
                ["REPAIR", String(dash.today.seatStatus.REPAIR ?? 0)],
              ].map(([label, value]) => (
                <div key={label} className="bg-[#0a0a0a] p-4">
                  <div className="text-[9px] uppercase tracking-[0.25em] text-white/25">{label}</div>
                  <div className="mono mt-3 text-2xl font-black text-white">{value}</div>
                </div>
              ))}
            </div>
          )}

          {dash && (
            <div className="col-span-2 row-span-1 border border-white/[0.06] bg-white/[0.03] p-4 md:col-span-6 lg:col-span-6">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.3em] text-white/30">SYSTEM STATUS</span>
                <span className="rounded-full bg-green-500/10 px-2 py-1 text-[8px] uppercase tracking-widest text-green-300">DEMO READY</span>
              </div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                {[
                  ["Clerk", dash.systemStatus.clerk ? "ON" : "OFF"],
                  ["Legacy", dash.systemStatus.legacyAuth ? "ON" : "OFF"],
                  ["Payment", dash.systemStatus.paymentMode],
                  ["SMS", dash.systemStatus.smsMode],
                  ["Realtime", dash.systemStatus.realtime],
                ].map(([label, value]) => (
                  <div key={label} className="border border-white/[0.06] bg-black/30 p-3">
                    <div className="text-[8px] uppercase tracking-[0.22em] text-white/20">{label}</div>
                    <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-white/70">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {dash && (
            <div className="col-span-2 row-span-1 border border-green-500/15 bg-green-500/[0.035] p-4 md:col-span-6 lg:col-span-12">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.3em] text-green-300/70">CONFLICT PROTECTION</span>
                <span className="text-[9px] uppercase tracking-widest text-white/25">Double booking prevention</span>
              </div>
              <div className="grid gap-2 md:grid-cols-4">
                {[
                  ["Serializable booking", dash.conflictProtection.serializableBooking],
                  ["QPay callback re-check", dash.conflictProtection.qpayCallbackRecheck],
                  ["Extension re-check", dash.conflictProtection.extendRecheck],
                  ["Active seat open guard", dash.conflictProtection.seatOpenGuard],
                ].map(([label, ok]) => (
                  <div key={label as string} className="flex items-center justify-between border border-green-500/10 bg-black/30 px-3 py-3">
                    <span className="text-[9px] uppercase tracking-[0.18em] text-white/45">{label as string}</span>
                    <span className={`h-2 w-2 rounded-full ${ok ? "bg-green-400" : "bg-red-400"}`} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Peak Hours — wide tile */}
          {dash && (
            <div className="col-span-2 row-span-1 border border-white/[0.06] bg-white/[0.03] p-4 md:col-span-6 md:p-6 lg:col-span-8">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.3em] text-white/30">PEAK HOURS · 14 DAY AVG</span>
                <span className="mono text-[9px] text-white/20">BOOKINGS/HOUR</span>
              </div>
              <div className="flex h-24 items-end gap-px">
                {dash.peakHours.map((h) => {
                  const max = Math.max(...dash.peakHours.map((x) => x.count), 1);
                  const pct = (h.count / max) * 100;
                  const isHigh = pct > 70;
                  return (
                    <div
                      key={h.hour}
                      className={`group relative flex-1 rounded-t transition-colors ${isHigh ? "bg-green-500/40 hover:bg-green-400/60" : "bg-white/15 hover:bg-white/30"}`}
                      style={{ height: `${Math.max(pct, 3)}%` }}
                      title={`${String(h.hour).padStart(2, "0")}:00 — ${h.count} bookings`}
                    >
                      <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[8px] text-white/40 opacity-0 group-hover:opacity-100 transition-opacity">
                        {h.count}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="mono mt-2 flex justify-between text-[8px] text-white/15">
                <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
              </div>
            </div>
          )}

          {/* Centers — tall narrow tile */}
          <div className="col-span-2 row-span-2 flex flex-col border border-white/[0.06] bg-white/[0.03] md:col-span-3 lg:col-span-4">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
              <span className="text-[10px] uppercase tracking-[0.3em] text-white/40">MY CENTERS</span>
              <Link href="/owner/centers/new" className="text-[9px] uppercase tracking-widest text-white/20 hover:text-white transition-colors">+ ADD</Link>
            </div>
            <div className="flex-1 overflow-y-auto">
              {centers.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-6">
                  <p className="text-xs text-white/20">No centers yet</p>
                  <Link href="/owner/centers/new" className="bg-white/10 px-4 py-2 text-[10px] uppercase tracking-widest text-white/60 hover:bg-white hover:text-black transition-colors">
                    ADD CENTER
                  </Link>
                </div>
              )}
              {centers.map((c, i) => (
                <button
                  key={c.id}
                  onClick={() => { window.location.href = `/owner/centers/${c.id}`; }}
                  className={`group flex w-full items-center gap-3 border-b border-white/[0.03] px-5 py-4 text-left transition-colors ${
                    centerId === c.id ? "bg-white/[0.08]" : "hover:bg-white/[0.03]"
                  }`}
                >
                  <span className={`flex h-9 w-9 items-center justify-center text-[10px] font-black transition-colors ${
                    centerId === c.id ? "bg-white text-black" : "bg-white/[0.06] text-white/40 group-hover:bg-white group-hover:text-black"
                  }`}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm font-black">{c.name.toUpperCase()}</div>
                    <div className="mono flex gap-3 text-[9px] text-white/25">
                      <span>{c._count.seats}s</span>
                      <span>{c._count.bookings}b</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-white/15 group-hover:text-white/50 transition-colors">→</span>
                </button>
              ))}
            </div>
          </div>

          {/* Bookings — large tile */}
          <div className="col-span-2 row-span-2 flex flex-col border border-white/[0.06] bg-white/[0.03] md:col-span-6 lg:col-span-8">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
              <span className="text-[10px] uppercase tracking-[0.3em] text-white/40">RECENT BOOKINGS</span>
              <span className="mono text-[9px] text-white/20">{dash?.recentBookings.length ?? 0}</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {!dash?.recentBookings.length && (
                <p className="p-6 text-xs text-white/20">No bookings yet.</p>
              )}
              {dash?.recentBookings.map((b) => {
                const isArrived = checkedInIds.has(b.id) ||
                  (b.status === "CONFIRMED" && b.bookingSeats.every((bs) => bs.seat.status === "OCCUPIED"));
                const showActions = (b.status === "PENDING" || b.status === "CONFIRMED") && !isArrived;
                return (
                  <div key={b.id} className="group border-b border-white/[0.03] px-5 py-4 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-4">
                      {/* Seat numbers pill */}
                      <div className="flex h-11 min-w-[3rem] items-center justify-center bg-white/[0.06] px-3">
                        <span className="display text-sm">{b.bookingSeats.map((bs) => bs.seat.number).join(",")}</span>
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold truncate">{b.user.name}</span>
                          <span className="mono rounded-full bg-white/[0.06] px-2 py-0.5 text-[8px] text-white/30">{b.code}</span>
                        </div>
                        <div className="mono mt-0.5 text-[10px] text-white/25">
                          {new Date(b.startTime).toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" })} · {b.hours}ц · {b.totalPrice.toLocaleString()}₮
                        </div>
                      </div>
                      {/* Status */}
                      {isArrived ? (
                        <div className="flex items-center gap-1.5">
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                          </span>
                          <span className="text-[9px] uppercase tracking-widest text-green-400">PLAYING</span>
                        </div>
                      ) : b.status === "NOSHOW" ? (
                        <span className="rounded-full bg-red-500/10 px-2.5 py-1 text-[9px] uppercase tracking-widest text-red-400">NO-SHOW</span>
                      ) : b.status === "CANCELLED" ? (
                        <span className="rounded-full bg-white/5 px-2.5 py-1 text-[9px] uppercase tracking-widest text-white/25">CANCELLED</span>
                      ) : null}
                    </div>
                    {/* Action buttons */}
                    {showActions && (
                      <div className="mt-3 flex gap-2 pl-[4.25rem]">
                        <button
                          disabled={busy === b.id}
                          onClick={() => markArrived(b.id)}
                          className="btn-lift border border-green-500/20 bg-green-500/10 px-4 py-2 text-[9px] uppercase tracking-widest text-green-400 hover:bg-green-500/20 disabled:opacity-40 transition-colors"
                        >
                          ARRIVED
                        </button>
                        <button
                          disabled={busy === b.id}
                          onClick={() => markNoShow(b.id)}
                          className="btn-lift border border-white/10 bg-white/5 px-4 py-2 text-[9px] uppercase tracking-widest text-white/40 hover:border-red-500/30 hover:text-red-400 disabled:opacity-40 transition-colors"
                        >
                          NO-SHOW
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {dash && (
            <div className="col-span-2 row-span-2 flex flex-col border border-white/[0.06] bg-white/[0.03] md:col-span-6 lg:col-span-12">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
                <span className="text-[10px] uppercase tracking-[0.3em] text-white/40">AUDIT LOG</span>
                <span className="mono text-[9px] text-white/20">{dash.auditLogs.length}</span>
              </div>
              <div className="grid gap-px bg-white/[0.03] md:grid-cols-2 lg:grid-cols-3">
                {dash.auditLogs.length === 0 && (
                  <p className="bg-[#0a0a0a] p-6 text-xs text-white/20 md:col-span-2 lg:col-span-3">
                    No owner actions recorded yet. Check-in, no-show, or seat status changes will appear here.
                  </p>
                )}
                {dash.auditLogs.map((log) => (
                  <div key={log.id} className="bg-[#0a0a0a] p-5">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="rounded-full border border-white/[0.08] px-2 py-1 text-[8px] uppercase tracking-widest text-white/35">
                        {log.action.replaceAll("_", " ")}
                      </span>
                      <span className="mono text-[9px] text-white/20">
                        {new Date(log.createdAt).toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-white/80">{log.message}</div>
                    <div className="mt-2 text-[10px] uppercase tracking-[0.2em] text-white/25">
                      {log.actor.name} · {log.actor.role}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Seat Map — full-width tile */}
          <div className="col-span-2 row-span-2 flex flex-col border border-white/[0.06] bg-white/[0.03] md:col-span-6 lg:col-span-12">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
              <span className="text-[10px] uppercase tracking-[0.3em] text-white/40">RISK CUSTOMERS</span>
              <span className="mono text-[9px] text-white/20">{dash?.riskCustomers.length ?? 0}</span>
            </div>
            <div className="grid gap-px bg-white/[0.03] md:grid-cols-2 lg:grid-cols-4">
              {!dash?.riskCustomers.length && (
                <p className="bg-[#0a0a0a] p-6 text-xs text-white/20 md:col-span-2 lg:col-span-4">No risky customers yet.</p>
              )}
              {dash?.riskCustomers.map((c) => (
                <div key={c.id} className="bg-[#0a0a0a] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black">{c.name}</div>
                      <div className="mono mt-1 text-[10px] text-white/25">{c.phone}</div>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[8px] uppercase tracking-widest ${c.isRestricted ? "bg-red-500/10 text-red-400" : "bg-yellow-400/10 text-yellow-200/70"}`}>
                      {c.isRestricted ? "RESTRICTED" : "WATCH"}
                    </span>
                  </div>
                  <button
                    disabled={busy === c.id}
                    onClick={() => setCustomerRestriction(c.id, c.isRestricted)}
                    className={`mt-4 w-full border px-3 py-2 text-[9px] uppercase tracking-widest transition-colors disabled:opacity-40 ${c.isRestricted ? "border-white/10 text-white/40 hover:bg-white hover:text-black" : "border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500 hover:text-black"}`}
                  >
                    {c.isRestricted ? "UNRESTRICT" : "RESTRICT 7D"}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="col-span-2 row-span-2 flex flex-col border border-white/[0.06] bg-white/[0.03] md:col-span-6 lg:col-span-12">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-[10px] uppercase tracking-[0.3em] text-white/40">SEAT MAP</span>
                  {activeCenter && (
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-black text-white">{activeCenter.name.toUpperCase()}</span>
                      <span className="rounded-full border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-[8px] uppercase tracking-widest text-green-300">
                        Selected center
                      </span>
                    </div>
                  )}
                </div>
                {centers.length > 1 && (
                  <select
                    value={centerId}
                    onChange={(e) => setActiveCenterId(e.target.value)}
                    className="border border-white/[0.08] bg-black px-3 py-2 text-[10px] uppercase tracking-widest text-white/70 outline-none"
                  >
                    {centers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
                {/* View toggle */}
                <div className="flex border border-white/[0.08] overflow-hidden">
                  {(["grid", "grouped", "blueprint"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setSeatView(v)}
                      className={`px-3 py-1 text-[9px] uppercase tracking-widest transition-colors ${
                        seatView === v ? "bg-white text-black" : "text-white/30 hover:text-white"
                      }`}
                    >
                      {v === "blueprint" ? "MAP" : v}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {centerId && (
                  <Link
                    href={`/owner/centers/${centerId}/layout`}
                    className="border border-white/[0.14] bg-white/[0.07] px-3 py-1 text-[8px] uppercase tracking-widest text-white/55 hover:bg-white hover:text-black transition-colors"
                  >
                    LAYOUT EDITOR
                  </Link>
                )}
                {/* Quick select */}
                {STATUSES.map((st) => {
                  const count = seats.filter((s) => s.status === st).length;
                  if (count === 0) return null;
                  return (
                    <button
                      key={st}
                      onClick={() => selectAllByStatus(st)}
                      className="border border-white/[0.14] bg-white/[0.07] px-2.5 py-1 text-[8px] uppercase tracking-widest text-white/55 hover:bg-white hover:text-black transition-colors"
                    >
                      {st} {count}
                    </button>
                  );
                })}
                {selectedSeats.size > 0 && (
                  <button
                    onClick={() => setSelectedSeats(new Set())}
                    className="text-[9px] text-white/25 hover:text-white"
                  >
                    CLEAR {selectedSeats.size}
                  </button>
                )}
              </div>
            </div>

            {/* Bulk action bar */}
            {selectedSeats.size > 0 && (
              <div className="flex items-center gap-3 border-b border-white/[0.06] bg-white/[0.02] px-5 py-3 anim-fade-up">
                <span className="display text-lg">{selectedSeats.size}</span>
                <span className="text-[9px] uppercase tracking-widest text-white/30">SELECTED</span>
                {selectedStatus.length > 0 && (
                  <span className="border border-white/[0.06] px-2 py-1 text-[8px] uppercase tracking-widest text-white/25">
                    {new Set(selectedStatus).size === 1 ? selectedStatus[0] : "MIXED"}
                  </span>
                )}
                <div className="ml-auto flex gap-1.5">
                  {STATUSES.map((st) => (
                    <button
                      key={st}
                      disabled={bulkBusy}
                      onClick={() => changeSeatStatus(Array.from(selectedSeats), st)}
                      className="btn-lift border border-white/[0.14] bg-white/[0.07] px-3 py-2 text-[9px] uppercase tracking-widest text-white/60 hover:bg-white hover:text-black disabled:opacity-40 transition-colors"
                    >
                      {st}
                    </button>
                  ))}
                </div>
                {bulkBusy && (
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border border-white/30 border-t-transparent" />
                )}
              </div>
            )}

            {/* Grid / Grouped */}
            <div className="flex-1 overflow-y-auto p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border border-white/[0.04] bg-black/30 px-4 py-3">
                <SeatLegend />
                <span className="text-[9px] uppercase tracking-widest text-white/20">
                  Hover seats for details
                </span>
              </div>
              {seatView === "blueprint" ? (
                <BlueprintSeatMap
                  seats={seats.map((s) => ({
                    id: s.id,
                    number: s.number,
                    status: s.status,
                    posX: s.posX ?? null,
                    posY: s.posY ?? null,
                    freeAt: null,
                    typeName: s.typeName,
                  }))}
                  selectedIds={selectedSeats}
                  onToggle={(id) => {
                    const seat = seats.find((s) => s.id === id);
                    if (seat) inspectOrSelectSeat(seat);
                  }}
                  floorName="SEAT MAP"
                />
              ) : seatView === "grid" ? (
                <div className="grid grid-cols-4 gap-2 md:grid-cols-10 lg:grid-cols-14">
                  {seats.map((s) => (
                    <SeatCell
                      key={s.id}
                      number={s.number}
                      status={s.status}
                      selected={selectedSeats.has(s.id)}
                      title={`${s.number} · ${s.status}${s.typeName ? ` · ${s.typeName}` : ""}`}
                      onClick={() => inspectOrSelectSeat(s)}
                    />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {STATUSES.map((status) => {
                    const group = seats.filter((s) => s.status === status);
                    if (group.length === 0) return null;
                    const colors: Record<SeatStatus, string> = {
                      OPEN: "border-green-500/20 bg-green-500/[0.03]",
                      OCCUPIED: "border-red-500/20 bg-red-500/[0.03]",
                      WAITING: "border-yellow-500/20 bg-yellow-500/[0.03]",
                      REPAIR: "border-orange-500/20 bg-orange-500/[0.03]",
                      CLOSED: "border-white/[0.08] bg-white/[0.02]",
                    };
                    const textColors: Record<SeatStatus, string> = {
                      OPEN: "text-green-400",
                      OCCUPIED: "text-red-400",
                      WAITING: "text-yellow-400",
                      REPAIR: "text-orange-400",
                      CLOSED: "text-white/40",
                    };
                    return (
                      <div key={status} className={`border p-4 ${colors[status]}`}>
                        <div className="mb-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-black uppercase tracking-[0.3em] ${textColors[status]}`}>{status}</span>
                            <span className="mono text-[10px] text-white/25">{group.length}</span>
                          </div>
                          <button
                            onClick={() => setSelectedSeats(new Set(group.map((s) => s.id)))}
                            className="text-[8px] uppercase tracking-widest text-white/20 hover:text-white transition-colors"
                          >
                            SELECT ALL
                          </button>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5 md:grid-cols-6">
                          {group.map((s) => (
                            <SeatCell
                              key={s.id}
                              number={s.number}
                              status={s.status}
                              selected={selectedSeats.has(s.id)}
                              title={`${s.number} · ${s.status}${s.typeName ? ` · ${s.typeName}` : ""}`}
                              onClick={() => inspectOrSelectSeat(s)}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {seats.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12">
                  <p className="text-xs text-white/20">NO SEATS</p>
                  <p className="mt-1 text-[10px] text-white/10">Build the room from Layout Editor</p>
                  {centerId && (
                    <Link
                      href={`/owner/centers/${centerId}/layout`}
                      className="mt-5 bg-white px-5 py-2.5 text-[9px] uppercase tracking-widest text-black transition-opacity hover:opacity-75"
                    >
                      Open Layout Editor
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {inspectedBooking && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm md:items-center">
          <div className="w-full max-w-xl border border-white/10 bg-[#080808] p-5 text-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <p className="text-[9px] uppercase tracking-[0.3em] text-white/30">SEAT BOOKING</p>
                <h2 className="display mt-2 text-4xl">{inspectedBooking.code}</h2>
              </div>
              <button
                onClick={() => setInspectedBookingId(null)}
                className="border border-white/10 px-3 py-2 text-[10px] uppercase tracking-widest text-white/40 hover:bg-white hover:text-black"
              >
                CLOSE
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 border-b border-white/10 py-4 text-sm">
              <div>
                <div className="text-[9px] uppercase tracking-widest text-white/25">Customer</div>
                <div className="mt-1 font-black">{inspectedBooking.user.name}</div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-widest text-white/25">Phone</div>
                <div className="mt-1 mono">{inspectedBooking.user.phone}</div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-widest text-white/25">Seats</div>
                <div className="mt-1 font-black">{inspectedBooking.bookingSeats.map((bs) => bs.seat.number).join(", ")}</div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-widest text-white/25">Time</div>
                <div className="mt-1 mono">
                  {new Date(inspectedBooking.startTime).toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" })} · {inspectedBooking.hours}h
                </div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-widest text-white/25">Status</div>
                <div className="mt-1 font-black">{inspectedBooking.bookingSeats.every((bs) => bs.seat.status === "OCCUPIED") ? "PLAYING" : "WAITING"}</div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-widest text-white/25">Paid</div>
                <div className="mt-1 mono">{inspectedBooking.totalPrice.toLocaleString()}₮</div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                disabled={busy === inspectedBooking.id}
                onClick={() => markArrived(inspectedBooking.id)}
                className="bg-white px-4 py-3 text-[10px] font-black uppercase tracking-[0.24em] text-black disabled:opacity-40"
              >
                CHECK-IN
              </button>
              <button
                disabled={busy === inspectedBooking.id}
                onClick={() => markNoShow(inspectedBooking.id)}
                className="border border-white/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.24em] text-white/50 hover:bg-white hover:text-black disabled:opacity-40"
              >
                NO-SHOW
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
