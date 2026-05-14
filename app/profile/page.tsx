"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/useAuth";
import { apiFetch } from "@/lib/api";
import { useBookingHistory } from "@/lib/hooks/useBookingHistory";
import { getMainImage } from "@/lib/image-types";
import {
  StatsStripSkeleton,
  ChartSkeleton,
  BookingRowSkeleton,
  TopCenterRowSkeleton,
  Skeleton,
} from "@/components/Skeleton";

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

interface Stats {
  totalHours: number;
  totalSpent: number;
  bookingCount: number;
  noShowCount: number;
  balance: number;
  favoritesCount: number;
  topCenters: { centerId: string; name: string; image: string | null; hours: number; spent: number; visits: number }[];
  monthlySpending: { month: string; total: number }[];
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
  PLAYER: "Тоглогч",
  STAFF:  "Ажилтан",
  OWNER:  "Эзэн",
  ADMIN:  "Админ",
};

export default function ProfilePage() {
  const { user, token, loading: authLoading, logout } = useAuth();
  const [historyPage, setHistoryPage]   = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [cancelling, setCancelling]     = useState<string | null>(null);
  const [tab, setTab]                   = useState<"stats" | "history" | "favorites">("stats");
  const qc = useQueryClient();

  const { data: activeData } = useQuery<{ bookings: Booking[] }>({
    queryKey: ["activeBookings"],
    queryFn:  () => apiFetch("/api/bookings", { token }),
    enabled:  !!token,
    staleTime: 20_000,
  });
  const activeBookings = activeData?.bookings ?? [];

  const { data: stats } = useQuery<Stats>({
    queryKey: ["me", "stats"],
    queryFn:  () => apiFetch("/api/me/stats", { token }),
    enabled:  !!token,
    staleTime: 60_000,
  });

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
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-black">
        <h1
          className="font-black text-white"
          style={{ fontFamily: "var(--font-display)", fontSize: "clamp(40px, 8vw, 100px)", letterSpacing: "-0.05em", lineHeight: 0.88 }}
        >
          LOGIN REQUIRED
        </h1>
        <Link
          href="/login"
          className="text-[10px] font-medium uppercase tracking-[0.28em] text-white/35 transition-colors hover:text-white"
        >
          НЭВТРЭХ →
        </Link>
      </main>
    );
  }

  const active          = activeBookings.filter((b) => b.status === "PENDING" || b.status === "CONFIRMED");
  const totalHistoryPages = Math.ceil(historyTotal / 10);
  const maxBar          = stats ? Math.max(...stats.monthlySpending.map((m) => m.total), 1) : 1;

  return (
    <main className="min-h-screen bg-[#080808] text-white">

      {/* ── HEADER ── */}
      <header className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4 md:px-12">
        <Link
          href="/"
          className="text-[10px] font-medium uppercase tracking-[0.28em] text-white/35 transition-colors hover:text-white"
        >
          ← HOME
        </Link>
        <span
          className="font-black text-white"
          style={{ fontFamily: "var(--font-display)", fontSize: "13px", letterSpacing: "-0.02em", fontWeight: 900 }}
        >
          PROFILE
        </span>
        <button
          onClick={logout}
          className="text-[10px] font-medium uppercase tracking-[0.28em] text-white/18 transition-colors hover:text-red-400"
        >
          LOGOUT
        </button>
      </header>

      {/* ── USER HERO ── */}
      <section className="border-b border-white/[0.06] px-6 py-10 md:px-12 md:py-14">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <span className="text-[9px] font-medium uppercase tracking-[0.3em] text-white/25">
                {ROLE_LABELS[user.role] ?? user.role}
              </span>
              {active.length > 0 && (
                <span className="flex items-center gap-1.5 text-[9px] font-medium uppercase tracking-[0.2em] text-green-400">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-50" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-400" />
                  </span>
                  {active.length} идэвхтэй
                </span>
              )}
            </div>
            <h1
              className="font-black text-white"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(40px, 6vw, 96px)",
                letterSpacing: "-0.05em",
                lineHeight: 0.86,
                fontWeight: 900,
              }}
            >
              {user.name.toUpperCase()}
            </h1>
            <p className="mono mt-3 text-[11px] text-white/22">{user.phone} · {user.email}</p>
          </div>

          {/* Balance */}
          <div className="text-right">
            <div
              className="mono font-black text-white"
              style={{ fontSize: "clamp(24px, 3vw, 40px)", letterSpacing: "-0.04em", lineHeight: 1 }}
            >
              {user.balance.toLocaleString()}₮
            </div>
            <div className="mt-1 text-[9px] font-medium uppercase tracking-[0.28em] text-white/25">
              ҮЛДЭГДЭЛ
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS STRIP ── */}
      {!stats && (
        <section className="border-b border-white/[0.06]">
          <StatsStripSkeleton />
        </section>
      )}
      {stats && (
        <section className="grid grid-cols-3 border-b border-white/[0.06] md:grid-cols-6">
          {[
            { v: `${stats.totalHours.toFixed(0)}ц`,           l: "Нийт цаг" },
            { v: `${(stats.totalSpent / 1000).toFixed(0)}к₮`, l: "Зарцуулсан" },
            { v: String(stats.bookingCount),                   l: "Захиалга" },
            { v: String(stats.noShowCount),                    l: "Ирээгүй" },
            { v: String(stats.favoritesCount),                 l: "Дуртай" },
            { v: `${(stats.balance / 1000).toFixed(0)}к₮`,    l: "Үлдэгдэл" },
          ].map((s, i) => (
            <div
              key={i}
              className="flex flex-col items-center justify-center border-white/[0.04] py-6 [&:not(:last-child)]:border-r"
            >
              <div
                className="mono font-black text-white"
                style={{ fontSize: "clamp(18px, 2.5vw, 32px)", letterSpacing: "-0.04em", lineHeight: 1 }}
              >
                {s.v}
              </div>
              <div className="mt-1.5 text-[8px] font-medium uppercase tracking-[0.22em] text-white/22">{s.l}</div>
            </div>
          ))}
        </section>
      )}

      {/* ── TABS ── */}
      <div className="flex border-b border-white/[0.06]">
        {(["stats", "history", "favorites"] as const).map((t) => {
          const badge =
            t === "history"   && historyTotal > 0 ? historyTotal :
            t === "favorites" && stats ? stats.favoritesCount : null;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex flex-1 items-center justify-center gap-2 py-4 text-[9px] font-medium uppercase tracking-[0.28em] transition-colors ${
                tab === t ? "border-b border-white text-white" : "text-white/25 hover:text-white/50"
              }`}
            >
              {t === "stats" ? "Статистик" : t === "history" ? "Түүх" : "Дуртай"}
              {badge != null && badge > 0 && (
                <span className="mono text-[8px] text-white/25">{badge}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── STATS TAB ── */}
      {tab === "stats" && (
        <div className="divide-y divide-white/[0.05]">

          {/* Monthly spending chart */}
          {!stats && (
            <section className="px-6 py-10 md:px-12">
              <Skeleton dark className="mb-8 h-2 w-32" />
              <ChartSkeleton />
            </section>
          )}
          {stats && (
            <section className="px-6 py-10 md:px-12">
              <h3 className="mb-8 text-[9px] font-medium uppercase tracking-[0.32em] text-white/28">
                САРЫН ЗАРЦУУЛАЛТ
              </h3>
              <div className="flex items-end gap-1.5" style={{ height: 120 }}>
                {stats.monthlySpending.map((m) => {
                  const pct = (m.total / maxBar) * 100;
                  return (
                    <div key={m.month} className="flex flex-1 flex-col items-center gap-1.5">
                      <span className="mono text-[7px] text-white/22">
                        {m.total > 0 ? `${(m.total / 1000).toFixed(0)}к` : ""}
                      </span>
                      <div className="flex w-full items-end" style={{ height: 80 }}>
                        <div
                          className="w-full transition-all duration-500 hover:opacity-70"
                          style={{
                            height: `${Math.max(pct, m.total > 0 ? 4 : 0)}%`,
                            background: m.total > 0
                              ? "linear-gradient(to top, rgba(255,255,255,0.28), rgba(255,255,255,0.06))"
                              : "rgba(255,255,255,0.04)",
                          }}
                        />
                      </div>
                      <span className="mono text-[7px] text-white/18">{m.month.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Top centers */}
          {!stats && (
            <section className="px-6 py-8 md:px-12">
              <Skeleton dark className="mb-6 h-2 w-24" />
              {Array.from({ length: 3 }).map((_, i) => <TopCenterRowSkeleton key={i} />)}
            </section>
          )}
          {stats && stats.topCenters.length > 0 && (
            <section className="px-6 py-8 md:px-12">
              <h3 className="mb-6 text-[9px] font-medium uppercase tracking-[0.32em] text-white/28">
                ТОП ЦЕНТРҮҮД
              </h3>
              <div className="space-y-0 divide-y divide-white/[0.04]">
                {stats.topCenters.map((tc, i) => (
                  <Link
                    key={tc.centerId}
                    href={`/centers/${tc.centerId}`}
                    className="flex items-center gap-5 py-4 transition-opacity hover:opacity-60"
                  >
                    <span
                      className="mono shrink-0 font-black text-white/12"
                      style={{ fontSize: "clamp(20px, 3vw, 36px)", letterSpacing: "-0.04em", width: "2rem" }}
                    >
                      {i + 1}
                    </span>
                    {tc.image && (
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden bg-white/5">
                        <Image src={tc.image} alt={tc.name} fill className="object-cover opacity-60" sizes="40px" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold">{tc.name}</div>
                      <div className="mono mt-0.5 text-[10px] text-white/28">
                        {tc.hours.toFixed(0)}ц · {tc.visits} удаа · {tc.spent.toLocaleString()}₮
                      </div>
                    </div>
                    <span className="text-[10px] text-white/18">→</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Active bookings */}
          <section className="px-6 py-8 md:px-12">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-[9px] font-medium uppercase tracking-[0.32em] text-white/28">
                ИДЭВХТЭЙ ЗАХИАЛГА
              </h3>
              <span className="mono text-[9px] text-white/18">{active.length}</span>
            </div>

            {active.length === 0 ? (
              <p className="text-[11px] text-white/14">Идэвхтэй захиалга байхгүй.</p>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {active.map((b) => (
                  <div key={b.id} className="py-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="mono text-[10px] text-white/22">{b.code}</div>
                        <div
                          className="mt-1 font-black text-white"
                          style={{ fontFamily: "var(--font-display)", fontSize: "clamp(20px, 2.5vw, 32px)", letterSpacing: "-0.04em", lineHeight: 1 }}
                        >
                          {b.bookingSeats.map((bs) => bs.seat.number).join(", ")}
                        </div>
                        <div className="mt-1 text-sm text-white/55">{b.center.name}</div>
                        <div className="mono mt-1 text-[10px] text-white/22">
                          {new Date(b.startTime).toLocaleDateString("mn-MN")} ·{" "}
                          {new Date(b.startTime).toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" })} ·{" "}
                          {b.hours}ц · {b.totalPrice.toLocaleString()}₮
                        </div>
                      </div>
                      <button
                        disabled={cancelling === b.id}
                        onClick={() => cancelMutation.mutate(b.id)}
                        className="shrink-0 text-[9px] font-medium uppercase tracking-[0.22em] text-white/28 transition-colors hover:text-red-400 disabled:opacity-30"
                      >
                        {cancelling === b.id ? "..." : "ЦУЦЛАХ"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {tab === "history" && (
        <div>
          {/* Status filter */}
          <div className="flex border-b border-white/[0.05]">
            {(["ALL", "CONFIRMED", "CANCELLED", "NOSHOW"] as const).map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setHistoryPage(1); }}
                className={`flex-1 py-3 text-[8px] font-medium uppercase tracking-[0.2em] transition-colors ${
                  statusFilter === s
                    ? "border-b border-white text-white"
                    : "text-white/20 hover:text-white/40"
                }`}
              >
                {s === "ALL" ? "Бүгд" : s === "CONFIRMED" ? "Баталгаасан" : s === "CANCELLED" ? "Цуцалсан" : "Ирээгүй"}
              </button>
            ))}
          </div>

          <div className="border-b border-white/[0.05] px-6 py-3 md:px-12">
            <span className="mono text-[9px] text-white/18">{historyTotal} захиалга</span>
          </div>

          {history.length === 0 && historyTotal === 0 && (
            <div className="divide-y divide-white/[0.04]">
              {Array.from({ length: 5 }).map((_, i) => (
                <BookingRowSkeleton key={i} />
              ))}
            </div>
          )}

          <div className="divide-y divide-white/[0.04]">
            {history.map((b: any) => (
              <div
                key={b.id}
                className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-white/[0.015] md:px-12"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <span className="mono text-[10px] text-white/18">{b.code}</span>
                    <span
                      className={`text-[9px] font-medium uppercase tracking-[0.2em] ${
                        b.status === "CONFIRMED" ? "text-green-400" :
                        b.status === "CANCELLED" ? "text-red-400/70" :
                        b.status === "NOSHOW"    ? "text-orange-400/70" : "text-white/28"
                      }`}
                    >
                      {b.status === "CONFIRMED" ? "✓" : b.status === "CANCELLED" ? "✕" : "—"}
                    </span>
                  </div>
                  <div className="mt-0.5 text-sm font-medium">
                    {b.bookingSeats.map((bs: any) => bs.seat.number).join(", ")}
                    <span className="ml-2 text-[12px] font-normal text-white/38">{b.center.name}</span>
                  </div>
                  <div className="mono mt-0.5 text-[10px] text-white/18">
                    {new Date(b.startTime).toLocaleDateString("mn-MN")} · {b.hours}ц
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5 text-right">
                  <div className="mono text-sm text-white/55">{b.totalPrice.toLocaleString()}₮</div>
                  {b.status === "CONFIRMED" && new Date(b.endTime) < new Date() && b.review && (
                    <span className="mono text-[9px] text-yellow-400/55">{"★".repeat(b.review.rating)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {totalHistoryPages > 1 && (
            <div className="flex items-center justify-center gap-8 py-8">
              <button
                disabled={historyPage <= 1}
                onClick={() => setHistoryPage((p) => p - 1)}
                className="text-[10px] font-medium uppercase tracking-[0.28em] text-white/18 transition-colors hover:text-white disabled:opacity-20"
              >
                ← ӨМНӨХ
              </button>
              <span className="mono text-[10px] text-white/28">
                {historyPage} / {totalHistoryPages}
              </span>
              <button
                disabled={historyPage >= totalHistoryPages}
                onClick={() => setHistoryPage((p) => p + 1)}
                className="text-[10px] font-medium uppercase tracking-[0.28em] text-white/18 transition-colors hover:text-white disabled:opacity-20"
              >
                ДАРААХ →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── FAVORITES TAB ── */}
      {tab === "favorites" && (
        <div className="px-6 py-8 md:px-12">
          {favorites.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-5">
              <div className="h-px w-8 bg-white/[0.08]" />
              <p
                className="font-black text-white/10"
                style={{ fontFamily: "var(--font-display)", fontSize: "clamp(20px, 3vw, 36px)", letterSpacing: "-0.04em" }}
              >
                ДУРТАЙ ЦЕНТР БАЙХГҮЙ
              </p>
              <p className="text-center text-[11px] text-white/18">
                Центрийн хуудсан дээрх ♡ дарж нэмнэ үү.
              </p>
              <Link
                href="/"
                className="mt-2 text-[10px] font-medium uppercase tracking-[0.28em] text-white/28 transition-colors hover:text-white"
              >
                ЦЕНТРҮҮД ХАРАХ →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-0 divide-y divide-white/[0.05] md:grid-cols-2 md:divide-y-0 md:gap-3">
              {favorites.map((c) => {
                const img = getMainImage(c.images);
                return (
                  <div key={c.id} className="group relative overflow-hidden">
                    <Link href={`/centers/${c.id}`} className="block">
                      <div className="relative aspect-[16/7] bg-white/[0.03]">
                        {img && (
                          <Image
                            src={img}
                            alt={c.name}
                            fill
                            className="object-cover opacity-45 grayscale transition-opacity duration-500 group-hover:opacity-65"
                            sizes="(max-width: 768px) 100vw, 50vw"
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-4">
                          <div className="mb-1 text-[8px] font-medium uppercase tracking-[0.28em] text-white/38">{c.district}</div>
                          <div
                            className="font-black text-white"
                            style={{ fontFamily: "var(--font-display)", fontSize: "clamp(16px, 2vw, 24px)", letterSpacing: "-0.04em", lineHeight: 0.9 }}
                          >
                            {c.name.toUpperCase()}
                          </div>
                          <div className="mono mt-1.5 flex items-center gap-3 text-[10px] text-white/38">
                            <span>{c.rating.toFixed(1)} ★</span>
                            <span>{c.availableSeats}/{c.seatCount} сул</span>
                            {c.minPricePerHour && <span>{c.minPricePerHour.toLocaleString()}₮/ц</span>}
                          </div>
                        </div>
                      </div>
                    </Link>
                    {/* Unfavorite */}
                    <button
                      onClick={() => unfavoriteMutation.mutate(c.id)}
                      className="absolute right-3 top-3 bg-black/50 px-2 py-1 text-[9px] font-medium uppercase tracking-[0.2em] text-white/38 transition-colors hover:text-white"
                      title="Хасах"
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
