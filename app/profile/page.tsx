"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/useAuth";
import { apiFetch } from "@/lib/api";
import { useBookingHistory } from "@/lib/hooks/useBookingHistory";
import { getMainImage } from "@/lib/image-types";
import { BookingRowSkeleton } from "@/components/Skeleton";

interface Booking {
  id: string;
  code: string;
  status: string;
  startTime: string;
  endTime: string;
  hours: number;
  totalPrice: number;
  bookingSeats: { seat: { number: string } }[];
  center: { id: string; name: string; address: string; images: string[] };
  review: { id: string; rating: number } | null;
}

interface FavCenter {
  id: string;
  name: string;
  district: string;
  images: string[];
  rating: number;
  seatCount: number;
  availableSeats: number;
  minPricePerHour: number | null;
}

type StatusFilter = "ALL" | "CONFIRMED" | "CANCELLED" | "NOSHOW";

const ROLE_LABELS: Record<string, string> = {
  PLAYER: "ТОГЛОГЧ",
  STAFF:  "АЖИЛТАН",
  OWNER:  "ЭЗЭН",
  ADMIN:  "АДМИН",
};

export default function ProfilePage() {
  const { user, token, loading: authLoading, logout } = useAuth();
  const [tab, setTab]                   = useState<"history" | "favorites">("history");
  const [historyPage, setHistoryPage]   = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [cancelling, setCancelling]     = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: activeData } = useQuery<{ bookings: Booking[] }>({
    queryKey: ["activeBookings"],
    queryFn:  () => apiFetch("/api/bookings", { token }),
    enabled:  !!token,
    staleTime: 20_000,
  });
  const activeBookings = (activeData?.bookings ?? []).filter(
    (b) => b.status === "PENDING" || b.status === "CONFIRMED"
  );

  const { data: favData } = useQuery<{ centers: FavCenter[] }>({
    queryKey: ["favorites"],
    queryFn:  () => apiFetch("/api/favorites", { token }),
    enabled:  !!token,
    staleTime: 60_000,
  });
  const favorites = favData?.centers ?? [];

  const { data: historyData } = useBookingHistory(historyPage, statusFilter);
  const history      = historyData?.bookings ?? [];
  const historyTotal = historyData?.pagination?.total ?? 0;
  const totalHistoryPages = Math.ceil(historyTotal / 10);

  const cancelMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/bookings/${id}/cancel`, {
        method: "PATCH", token,
        body: JSON.stringify({ reason: "Player cancelled" }),
      }),
    onMutate:  (id) => setCancelling(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activeBookings"] });
      qc.invalidateQueries({ queryKey: ["bookingHistory"] });
    },
    onSettled: () => setCancelling(null),
  });

  const unfavoriteMutation = useMutation({
    mutationFn: (centerId: string) =>
      apiFetch(`/api/favorites/${centerId}`, { method: "DELETE", token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favorites"] }),
  });

  if (authLoading) return null;

  if (!user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#080808]">
        <h1
          className="font-black text-white"
          style={{ fontFamily: "var(--font-display)", fontSize: "clamp(40px, 8vw, 100px)", letterSpacing: "-0.05em", lineHeight: 0.88 }}
        >
          LOGIN REQUIRED
        </h1>
        <Link
          href="/login"
          className="text-[10px] font-medium uppercase tracking-[0.28em] text-white/40 transition-colors hover:text-white"
        >
          НЭВТРЭХ →
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#080808] text-white">

      {/* ── HERO ── */}
      <section className="border-b border-white/[0.06] px-6 pb-10 pt-28 md:px-12 md:pt-32">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">

          {/* Name + role */}
          <div>
            <div className="mb-4 flex items-center gap-3">
              <span className="text-[9px] font-medium uppercase tracking-[0.35em] text-white/30">
                {ROLE_LABELS[user.role] ?? user.role}
              </span>
              {activeBookings.length > 0 && (
                <span className="flex items-center gap-1.5 text-[9px] font-medium uppercase tracking-[0.2em] text-green-400">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-50" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-400" />
                  </span>
                  {activeBookings.length} идэвхтэй
                </span>
              )}
            </div>
            <h1
              className="font-black text-white"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(48px, 7vw, 120px)",
                letterSpacing: "-0.05em",
                lineHeight: 0.86,
                fontWeight: 900,
              }}
            >
              {user.name.toUpperCase()}
            </h1>
            <p className="mono mt-4 text-[11px] text-white/30">{user.email}</p>
          </div>

          {/* Balance + logout */}
          <div className="flex flex-col items-start gap-4 md:items-end">
            <div>
              <div className="text-[9px] font-medium uppercase tracking-[0.3em] text-white/30 md:text-right">
                ҮЛДЭГДЭЛ
              </div>
              <div
                className="mono mt-1 font-black text-white"
                style={{ fontSize: "clamp(28px, 3.5vw, 52px)", letterSpacing: "-0.04em", lineHeight: 1 }}
              >
                {user.balance.toLocaleString()}₮
              </div>
            </div>
            <button
              onClick={logout}
              className="text-[9px] font-medium uppercase tracking-[0.28em] text-white/25 transition-colors hover:text-red-400"
            >
              ГАРАХ
            </button>
          </div>
        </div>
      </section>

      {/* ── ACTIVE BOOKINGS (always visible if any) ── */}
      {activeBookings.length > 0 && (
        <section className="border-b border-white/[0.06] px-6 py-8 md:px-12">
          <div className="mb-5 flex items-center gap-3">
            <h2 className="text-[9px] font-medium uppercase tracking-[0.32em] text-white/30">ИДЭВХТЭЙ</h2>
            <span className="mono text-[9px] text-white/20">{activeBookings.length}</span>
          </div>
          <div className="divide-y divide-white/[0.05]">
            {activeBookings.map((b) => (
              <div key={b.id} className="flex items-start justify-between gap-4 py-5">
                <div>
                  <div className="mono text-[9px] text-white/25">{b.code}</div>
                  <div
                    className="mt-1 font-black text-white"
                    style={{ fontFamily: "var(--font-display)", fontSize: "clamp(18px, 2.5vw, 30px)", letterSpacing: "-0.04em", lineHeight: 1 }}
                  >
                    {b.bookingSeats.map((bs) => bs.seat.number).join(", ")}
                  </div>
                  <div className="mt-1 text-[12px] text-white/50">{b.center.name}</div>
                  <div className="mono mt-1 text-[10px] text-white/25">
                    {new Date(b.startTime).toLocaleDateString("mn-MN")} ·{" "}
                    {new Date(b.startTime).toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" })} ·{" "}
                    {b.hours}ц · {b.totalPrice.toLocaleString()}₮
                  </div>
                </div>
                <button
                  disabled={cancelling === b.id}
                  onClick={() => cancelMutation.mutate(b.id)}
                  className="shrink-0 text-[9px] font-medium uppercase tracking-[0.22em] text-white/25 transition-colors hover:text-red-400 disabled:opacity-30"
                >
                  {cancelling === b.id ? "..." : "ЦУЦЛАХ"}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── TABS ── */}
      <div className="flex border-b border-white/[0.06]">
        {(["history", "favorites"] as const).map((t) => {
          const count = t === "history" ? historyTotal : favorites.length;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative flex flex-1 items-center justify-center gap-2.5 py-5 text-[9px] font-medium uppercase tracking-[0.28em] transition-colors ${
                tab === t ? "text-white" : "text-white/30 hover:text-white/55"
              }`}
            >
              {t === "history" ? "ТҮҮХ" : "ДУРТАЙ"}
              {count > 0 && (
                <span className="mono text-[8px] text-white/25">{count}</span>
              )}
              {tab === t && (
                <span className="absolute bottom-0 left-0 right-0 h-px bg-white" />
              )}
            </button>
          );
        })}
      </div>

      {/* ── HISTORY TAB ── */}
      {tab === "history" && (
        <div>
          {/* Status filter */}
          <div className="flex gap-0 border-b border-white/[0.05]">
            {(["ALL", "CONFIRMED", "CANCELLED", "NOSHOW"] as const).map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setHistoryPage(1); }}
                className={`flex-1 py-3.5 text-[8px] font-medium uppercase tracking-[0.2em] transition-colors ${
                  statusFilter === s
                    ? "text-white"
                    : "text-white/25 hover:text-white/50"
                }`}
              >
                {s === "ALL" ? "БҮГД" : s === "CONFIRMED" ? "БАТАЛГАА" : s === "CANCELLED" ? "ЦУЦЛАГДСАН" : "ИРЭЭГҮЙ"}
              </button>
            ))}
          </div>

          {/* Count */}
          <div className="border-b border-white/[0.04] px-6 py-3 md:px-12">
            <span className="mono text-[9px] text-white/20">{historyTotal} захиалга</span>
          </div>

          {/* Skeleton while loading */}
          {history.length === 0 && historyTotal === 0 && (
            <div className="divide-y divide-white/[0.04]">
              {Array.from({ length: 5 }).map((_, i) => <BookingRowSkeleton key={i} />)}
            </div>
          )}

          {/* Rows */}
          <div className="divide-y divide-white/[0.04]">
            {history.map((b: any) => (
              <div
                key={b.id}
                className="flex items-center gap-4 px-6 py-5 transition-colors hover:bg-white/[0.02] md:px-12"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <span className="mono text-[9px] text-white/22">{b.code}</span>
                    <span className={`text-[9px] font-medium ${
                      b.status === "CONFIRMED" ? "text-green-400" :
                      b.status === "CANCELLED" ? "text-red-400/70" :
                      "text-orange-400/70"
                    }`}>
                      {b.status === "CONFIRMED" ? "✓" : b.status === "CANCELLED" ? "✕" : "—"}
                    </span>
                  </div>
                  <div className="mt-1 text-[13px] font-semibold text-white">
                    {b.bookingSeats.map((bs: any) => bs.seat.number).join(", ")}
                    <span className="ml-2 text-[12px] font-normal text-white/35">{b.center.name}</span>
                  </div>
                  <div className="mono mt-0.5 text-[9px] text-white/22">
                    {new Date(b.startTime).toLocaleDateString("mn-MN")} · {b.hours}ц
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <div className="mono text-[13px] text-white/60">{b.totalPrice.toLocaleString()}₮</div>
                  {b.review && (
                    <span className="mono text-[9px] text-yellow-400/60">{"★".repeat(b.review.rating)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalHistoryPages > 1 && (
            <div className="flex items-center justify-between border-t border-white/[0.05] px-6 py-6 md:px-12">
              <button
                disabled={historyPage <= 1}
                onClick={() => setHistoryPage((p) => p - 1)}
                className="text-[9px] font-medium uppercase tracking-[0.28em] text-white/25 transition-colors hover:text-white disabled:opacity-20"
              >
                ← ӨМНӨХ
              </button>
              <span className="mono text-[9px] text-white/25">
                {historyPage} / {totalHistoryPages}
              </span>
              <button
                disabled={historyPage >= totalHistoryPages}
                onClick={() => setHistoryPage((p) => p + 1)}
                className="text-[9px] font-medium uppercase tracking-[0.28em] text-white/25 transition-colors hover:text-white disabled:opacity-20"
              >
                ДАРААХ →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── FAVORITES TAB ── */}
      {tab === "favorites" && (
        <div>
          {favorites.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-5 py-32">
              <p
                className="font-black text-white/10"
                style={{ fontFamily: "var(--font-display)", fontSize: "clamp(20px, 3vw, 40px)", letterSpacing: "-0.04em" }}
              >
                ДУРТАЙ ЦЕНТР БАЙХГҮЙ
              </p>
              <p className="text-[11px] text-white/25">Центрийн хуудсан дээрх ♡ дарж нэмнэ үү.</p>
              <Link
                href="/"
                className="mt-2 text-[10px] font-medium uppercase tracking-[0.28em] text-white/30 transition-colors hover:text-white"
              >
                ЦЕНТРҮҮД ХАРАХ →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {favorites.map((c) => {
                const img = getMainImage(c.images);
                return (
                  <div key={c.id} className="group relative flex items-center gap-5 px-6 py-5 transition-colors hover:bg-white/[0.02] md:px-12">

                    {/* Thumbnail */}
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden bg-white/[0.04]">
                      {img && (
                        <Image
                          src={img}
                          alt={c.name}
                          fill
                          className="object-cover opacity-50 grayscale transition-opacity duration-300 group-hover:opacity-70"
                          sizes="56px"
                        />
                      )}
                    </div>

                    {/* Info */}
                    <Link href={`/centers/${c.id}`} className="min-w-0 flex-1">
                      <div className="text-[9px] font-medium uppercase tracking-[0.28em] text-white/30">{c.district}</div>
                      <div
                        className="mt-0.5 truncate font-black text-white"
                        style={{ fontFamily: "var(--font-display)", fontSize: "clamp(15px, 1.8vw, 22px)", letterSpacing: "-0.03em", lineHeight: 1.1 }}
                      >
                        {c.name.toUpperCase()}
                      </div>
                      <div className="mono mt-1 flex items-center gap-3 text-[10px] text-white/30">
                        <span>{c.rating.toFixed(1)} ★</span>
                        <span>{c.availableSeats}/{c.seatCount} сул</span>
                        {c.minPricePerHour && <span>{c.minPricePerHour.toLocaleString()}₮/ц</span>}
                      </div>
                    </Link>

                    {/* Remove */}
                    <button
                      onClick={() => unfavoriteMutation.mutate(c.id)}
                      disabled={unfavoriteMutation.isPending}
                      className="shrink-0 text-[9px] font-medium uppercase tracking-[0.22em] text-white/20 transition-colors hover:text-red-400 disabled:opacity-30"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
