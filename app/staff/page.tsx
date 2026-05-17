"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SeatCell, SeatLegend, type SeatStatus } from "@/components/SeatCell";
import { useAuth } from "@/lib/useAuth";
import { apiFetch } from "@/lib/api";
import { useSeatSocket, type SeatUpdate } from "@/lib/useSeatSocket";
import { useNotificationSound } from "@/lib/useNotificationSound";

interface Permissions {
  canCheckin: boolean;
  canSeatStatus: boolean;
  canViewBookings: boolean;
}

interface Center {
  id: string;
  name: string;
  district: string;
  address: string;
  permissions: Permissions;
}

interface Booking {
  id: string;
  code: string;
  status: "PENDING" | "CONFIRMED";
  startTime: string;
  hours: number;
  totalPrice: number;
  bookingSeats: { seatId: string; seat: { number: string; status: string } }[];
  user: { name: string; phone: string };
  center: { id: string; name: string };
}

interface SeatData {
  id: string;
  number: string;
  status: SeatStatus;
  centerId: string;
  freeAt: string | null;
}

const STATUSES: SeatStatus[] = ["OPEN", "CLOSED", "REPAIR", "WAITING", "OCCUPIED"];

export default function StaffDashboard() {
  const { token, user, loading: authLoading } = useAuth();
  const [centers, setCenters] = useState<Center[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [seats, setSeats] = useState<SeatData[]>([]);
  const [activeCenter, setActiveCenter] = useState<string>("");
  const [selectedSeats, setSelectedSeats] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [checkedInIds, setCheckedInIds] = useState<Set<string>>(new Set());
  const [seatView, setSeatView] = useState<"grid" | "grouped">("grid");
  const [inspectedBookingId, setInspectedBookingId] = useState<string | null>(null);
  const { enabled: soundEnabled, enable: enableSound, play: playSound } = useNotificationSound();

  const loadStaffDashboard = useCallback(() => {
    if (!token) return;
    apiFetch<{ centers: Center[]; bookings: Booking[]; seats: SeatData[] }>(
      "/api/staff/dashboard",
      { token }
    )
      .then((data) => {
        setCenters(data.centers);
        setBookings(data.bookings);
        setSeats(data.seats);
        if (data.centers.length > 0) setActiveCenter((current) => current || data.centers[0].id);
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    loadStaffDashboard();
  }, [loadStaffDashboard]);

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(loadStaffDashboard, 4_000);
    return () => clearInterval(interval);
  }, [token, loadStaffDashboard]);

  // Socket updates for active center
  const handleSeatUpdate = useCallback(
    (u: SeatUpdate) => {
      setSeats((prev) => prev.map((s) => (s.id === u.id ? { ...s, status: u.status } : s)));
      loadStaffDashboard();
    },
    [loadStaffDashboard]
  );

  const handleBookingRealtime = useCallback(() => {
    playSound();
    loadStaffDashboard();
  }, [playSound, loadStaffDashboard]);

  useSeatSocket(
    activeCenter,
    handleSeatUpdate,
    token,
    handleBookingRealtime
  );

  const center = centers.find((c) => c.id === activeCenter);
  const perms = center?.permissions;
  const centerSeats = seats.filter((s) => s.centerId === activeCenter);
  const centerBookings = bookings.filter((b) => b.center.id === activeCenter);
  const inspectedBooking = inspectedBookingId
    ? centerBookings.find((b) => b.id === inspectedBookingId) ?? null
    : null;

  const toggleSeatSelect = (id: string) => {
    setSelectedSeats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const inspectOrSelectSeat = (seat: SeatData) => {
    const booking = centerBookings.find(
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

  const markArrived = async (id: string) => {
    if (!token) return;
    setBusy(id);
    try {
      await apiFetch(`/api/owner/bookings/${id}/checkin`, { method: "PATCH", token });
      setCheckedInIds((prev) => new Set(prev).add(id));
      const booking = bookings.find((b) => b.id === id);
      const seatIds = booking?.bookingSeats.map((bs) => bs.seatId) ?? [];
      if (seatIds.length > 0) {
        setSeats((prev) =>
          prev.map((s) => (seatIds.includes(s.id) ? { ...s, status: "OCCUPIED" as SeatStatus } : s))
        );
      }
    } catch {}
    setBusy(null);
  };

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <span className="text-sm text-gray animate-pulse">LOADING...</span>
      </main>
    );
  }

  if (!user || (user.role !== "STAFF" && user.role !== "OWNER" && user.role !== "ADMIN")) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6">
        <h1 className="display text-5xl">STAFF ONLY</h1>
        <Link href="/login" className="text-xs uppercase tracking-[0.3em] text-gray hover:text-black">
          НЭВТРЭХ →
        </Link>
      </main>
    );
  }

  if (centers.length === 0) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4">
        <h1 className="display text-3xl">NO ASSIGNMENTS</h1>
        <p className="text-sm text-gray">Танд хуваарилагдсан төв байхгүй байна.</p>
        <Link href="/" className="text-xs uppercase tracking-[0.3em] text-gray hover:text-black">
          ← HOME
        </Link>
      </main>
    );
  }

  const openCount = centerSeats.filter((s) => s.status === "OPEN").length;

  const waitingCount = centerBookings.filter((b) => !checkedInIds.has(b.id) && !b.bookingSeats.every((bs) => bs.seat.status === "OCCUPIED")).length;

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4 md:px-12">
        <Link href="/" className="text-xs uppercase tracking-[0.3em] text-white/50 hover:text-white transition-colors">← HOME</Link>
        <span className="display text-xl">STAFF</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={enableSound}
            className={`text-[9px] uppercase tracking-[0.25em] transition-colors ${
              soundEnabled ? "text-green-300" : "text-white/30 hover:text-white"
            }`}
          >
            SOUND {soundEnabled ? "ON" : "OFF"}
          </button>
          <span className="hidden rounded-full border border-white/10 px-3 py-1 text-[8px] uppercase tracking-widest text-white/25 md:inline">
            Ops only
          </span>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
          <span className="text-xs uppercase tracking-[0.3em] text-white/40">{user.name}</span>
        </div>
      </header>

      {/* Center tabs */}
      {centers.length > 1 && (
        <div className="flex border-b border-white/10">
          {centers.map((c) => (
            <button
              key={c.id}
              onClick={() => { setActiveCenter(c.id); setSelectedSeats(new Set()); }}
              className={`flex-1 py-4 text-center text-xs uppercase tracking-[0.3em] transition-colors ${
                activeCenter === c.id ? "bg-white text-black" : "text-white/40 hover:bg-white/5 hover:text-white"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* Stats bar */}
      <section className="grid grid-cols-3 border-b border-white/10">
        <div className="flex flex-col items-center p-6 border-r border-white/10">
          <div className="display mono text-3xl text-green-400">{openCount}<span className="text-white/30">/{centerSeats.length}</span></div>
          <div className="mt-1 text-[9px] uppercase tracking-[0.3em] text-white/30">СУЛ СУУДАЛ</div>
        </div>
        <div className="flex flex-col items-center p-6 border-r border-white/10">
          <div className="display mono text-3xl">{centerBookings.length}</div>
          <div className="mt-1 text-[9px] uppercase tracking-[0.3em] text-white/30">ӨНӨӨДРИЙН</div>
        </div>
        <div className="flex flex-col items-center p-6">
          <div className={`display mono text-3xl ${waitingCount > 0 ? "text-yellow-400" : ""}`}>{waitingCount}</div>
          <div className="mt-1 text-[9px] uppercase tracking-[0.3em] text-white/30">ХҮЛЭЭГДЭЖ</div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2">
        {/* Bookings */}
        {perms?.canViewBookings && (
          <div className="border-white/10 md:border-r">
            <div className="border-b border-white/10 p-6 md:p-8">
              <h2 className="display text-2xl">BOOKINGS</h2>
            </div>
            {centerBookings.length === 0 && (
              <p className="p-8 text-sm text-white/30">Өнөөдөр захиалга байхгүй.</p>
            )}
            <ul className="divide-y divide-white/5">
              {centerBookings.map((b) => {
                const isArrived = checkedInIds.has(b.id) ||
                  (b.status === "CONFIRMED" && b.bookingSeats.every((bs) => bs.seat.status === "OCCUPIED"));
                return (
                  <li key={b.id} className="p-5 md:p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="display text-xl">{b.code}</span>
                          <span className={`mono rounded-full px-2 py-0.5 text-[9px] ${
                            isArrived ? "bg-green-500/10 text-green-400" : "bg-white/5 text-white/40"
                          }`}>{isArrived ? "PLAYING" : b.status}</span>
                        </div>
                        <div className="mt-1.5 text-sm text-white/80">{b.user.name}</div>
                        <div className="mono mt-1 text-xs text-white/30">
                          {b.bookingSeats.map((bs) => bs.seat.number).join(", ")} ·{" "}
                          {new Date(b.startTime).toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" })} ·{" "}
                          {b.hours}ц
                        </div>
                      </div>
                      {isArrived && (
                        <span className="relative flex h-3 w-3">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                          <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
                        </span>
                      )}
                    </div>
                    {!isArrived && perms?.canCheckin && (
                      <button
                        disabled={busy === b.id}
                        onClick={() => markArrived(b.id)}
                        className="btn-pop mt-4 w-full rounded-lg border border-green-500/30 bg-green-500/10 py-3 text-xs uppercase tracking-[0.3em] text-green-400 hover:bg-green-500/20 hover:border-green-500/50 disabled:opacity-40 transition-colors"
                      >
                        ARRIVED ✓
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Seats */}
        {perms?.canSeatStatus && (
          <div>
            <div className="border-b border-white/10 p-6 md:p-8 flex items-center justify-between">
              <div>
                <h2 className="display text-2xl">SEATS</h2>
                <p className="mt-1 text-[9px] uppercase tracking-widest text-white/20">
                  Status control only · layout locked
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="mono text-xs text-white/30">{openCount}/{centerSeats.length} OPEN</span>
                <div className="flex rounded-lg border border-white/10 overflow-hidden">
                  <button
                    onClick={() => setSeatView("grid")}
                    className={`px-3 py-1.5 text-[9px] uppercase tracking-widest transition-colors ${
                      seatView === "grid" ? "bg-white text-black" : "text-white/40 hover:text-white"
                    }`}
                  >
                    GRID
                  </button>
                  <button
                    onClick={() => setSeatView("grouped")}
                    className={`px-3 py-1.5 text-[9px] uppercase tracking-widest transition-colors ${
                      seatView === "grouped" ? "bg-white text-black" : "text-white/40 hover:text-white"
                    }`}
                  >
                    GROUPED
                  </button>
                </div>
              </div>
            </div>
            <div className="p-5 md:p-6">
              <div className="mb-4 rounded-xl border border-white/5 bg-black/40 p-3">
                <SeatLegend />
              </div>
              {/* Bulk panel */}
              {selectedSeats.size > 0 && (
                <div className="mb-4 glass-card rounded-xl p-4 anim-fade-up">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-[0.3em] text-white/50">
                      <span className="display text-lg text-white">{selectedSeats.size}</span> SELECTED
                    </span>
                    <button
                      onClick={() => setSelectedSeats(new Set())}
                      className="text-[10px] text-white/30 hover:text-white"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-1.5 md:grid-cols-5">
                    {STATUSES.map((st) => (
                      <button
                        key={st}
                        disabled={bulkBusy}
                        onClick={() => changeSeatStatus(Array.from(selectedSeats), st)}
                        className="btn-pop rounded-lg border border-white/10 bg-white/5 py-2.5 text-[9px] uppercase tracking-widest text-white/70 hover:bg-white hover:text-black disabled:opacity-40 transition-colors"
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {seatView === "grid" ? (
                <div className="grid grid-cols-4 gap-2 rounded-xl border border-white/5 bg-black/50 p-4 md:grid-cols-6">
                  {centerSeats.map((s) => (
                    <SeatCell
                      key={s.id}
                      number={s.number}
                      status={s.status}
                      freeAt={s.freeAt}
                      selected={selectedSeats.has(s.id)}
                      title={`${s.number} · ${s.status}${s.freeAt ? ` · free ${new Date(s.freeAt).toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" })}` : ""}`}
                      onClick={() => inspectOrSelectSeat(s)}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {STATUSES.map((status) => {
                    const group = centerSeats.filter((s) => s.status === status);
                    if (group.length === 0) return null;
                    const statusColors: Record<SeatStatus, string> = {
                      OPEN: "text-green-400 border-green-500/30 bg-green-500/5",
                      OCCUPIED: "text-red-400 border-red-500/30 bg-red-500/5",
                      WAITING: "text-yellow-400 border-yellow-500/30 bg-yellow-500/5",
                      REPAIR: "text-orange-400 border-orange-500/30 bg-orange-500/5",
                      CLOSED: "text-white/40 border-white/10 bg-white/[0.02]",
                    };
                    return (
                      <div key={status} className={`rounded-xl border p-4 ${statusColors[status]}`}>
                        <div className="mb-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-[0.3em]">{status}</span>
                            <span className="mono text-[10px] opacity-50">{group.length}</span>
                          </div>
                          <button
                            onClick={() => setSelectedSeats(new Set(group.map((s) => s.id)))}
                            className="text-[9px] uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity"
                          >
                            SELECT ALL
                          </button>
                        </div>
                        <div className="grid grid-cols-4 gap-2 md:grid-cols-8">
                          {group.map((s) => (
                            <SeatCell
                              key={s.id}
                              number={s.number}
                              status={s.status}
                              freeAt={s.freeAt}
                              selected={selectedSeats.has(s.id)}
                              title={`${s.number} · ${s.status}${s.freeAt ? ` · free ${new Date(s.freeAt).toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" })}` : ""}`}
                              onClick={() => inspectOrSelectSeat(s)}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {centerSeats.length === 0 && (
                <p className="py-8 text-center text-sm text-white/30">NO SEATS</p>
              )}
            </div>
          </div>
        )}
      </div>

      {inspectedBooking && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm md:items-center">
          <div className="w-full max-w-xl rounded-xl border border-white/10 bg-[#080808] p-5 text-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <p className="text-[9px] uppercase tracking-[0.3em] text-white/30">SEAT BOOKING</p>
                <h2 className="display mt-2 text-4xl">{inspectedBooking.code}</h2>
              </div>
              <button
                onClick={() => setInspectedBookingId(null)}
                className="rounded-lg border border-white/10 px-3 py-2 text-[10px] uppercase tracking-widest text-white/40 hover:bg-white hover:text-black"
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

            {perms?.canCheckin && (
              <div className="mt-4 grid grid-cols-1 gap-2">
                <button
                  disabled={busy === inspectedBooking.id}
                  onClick={() => markArrived(inspectedBooking.id)}
                  className="rounded-lg bg-white px-4 py-3 text-[10px] font-black uppercase tracking-[0.24em] text-black disabled:opacity-40"
                >
                  CHECK-IN
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
