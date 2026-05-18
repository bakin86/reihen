"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/useAuth";
import { apiFetch } from "@/lib/api";
import { useBookingHistory } from "@/lib/hooks/useBookingHistory";
import { getMainImage } from "@/lib/image-types";

interface Booking {
  id: string;
  code: string;
  status: string;
  startTime: string;
  endTime: string;
  hours: number;
  totalPrice: number;
  bookingSeats: { seat: { number: string } }[];
  center: { id: string; name: string; images: string[] };
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

const STATUS_LABELS: Record<StatusFilter, string> = {
  ALL: "Бүгд", CONFIRMED: "Баталгаа", CANCELLED: "Цуцлагдсан", NOSHOW: "Ирээгүй",
};

export default function ProfilePage() {
  const { user, token, loading: authLoading, logout } = useAuth();
  const [tab, setTab]                 = useState<"history" | "favorites">("history");
  const [historyPage, setHistoryPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [cancelling, setCancelling]   = useState<string | null>(null);
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
  const history           = historyData?.bookings ?? [];
  const historyTotal      = historyData?.pagination?.total ?? 0;
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
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gradient-to-br from-[#0d0d14] to-[#080810]">
        <p className="text-sm font-medium text-white/40">Нэвтрэх шаардлагатай</p>
        <Link href="/login" className="rounded-2xl bg-white/[0.08] px-6 py-3 text-sm font-semibold text-white backdrop-blur-xl transition hover:bg-white/[0.14]">
          Нэвтрэх →
        </Link>
      </main>
    );
  }

  return (
    <main className="soft-glass-page text-white">
      {/* Ambient blobs — white only, matching site palette */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-white/[0.025] blur-[120px]" />
        <div className="absolute -right-40 top-1/3 h-[400px] w-[400px] rounded-full bg-white/[0.018] blur-[100px]" />
        <div className="absolute bottom-0 left-1/3 h-[350px] w-[350px] rounded-full bg-white/[0.015] blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-2xl px-4 pb-24 pt-24 md:pt-28">

        {/* Back */}
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-white/55 transition-colors hover:text-white"
        >
          ← Нүүр
        </Link>

        {/* ── USER CARD ── */}
        <div className="soft-glass-panel mb-6 rounded-3xl p-6 md:p-8">
          <div className="flex items-start justify-between gap-4">
            {/* Avatar + name */}
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.10] text-xl font-black backdrop-blur-xl">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-[10px] font-medium uppercase tracking-[0.25em] text-white/55">
                  {user.role}
                </div>
                <div className="mt-0.5 text-lg font-bold text-white">{user.name}</div>
                <div className="text-[11px] text-white/55">{user.email}</div>
              </div>
            </div>

            {/* Balance pill */}
            <div className="flex flex-col items-end gap-2">
              <div className="rounded-xl border border-white/[0.10] bg-white/[0.10] px-4 py-2 text-right backdrop-blur-xl">
                <div className="text-[9px] font-medium uppercase tracking-[0.2em] text-white/60">Үлдэгдэл</div>
                <div className="mt-0.5 text-base font-black text-white">{user.balance.toLocaleString()}₮</div>
              </div>
              <button
                onClick={logout}
                className="glass-action min-h-0 rounded-lg px-3 py-1.5 text-[9px] uppercase tracking-[0.2em] text-white/75 hover:text-red-300"
              >
                Гарах
              </button>
            </div>
          </div>

          {/* Active booking badge */}
          {activeBookings.length > 0 && (
            <div className="mt-5 space-y-2">
              {activeBookings.map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-2xl border border-green-400/25 bg-green-400/[0.09] px-4 py-3 backdrop-blur-xl">
                  <div className="flex items-center gap-3">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-400" />
                    </span>
                    <div>
                      <div className="text-[11px] font-semibold text-white">
                        {b.bookingSeats.map((bs) => bs.seat.number).join(", ")}
                        <span className="ml-1.5 font-normal text-white/45">{b.center.name}</span>
                      </div>
                      <div className="mono text-[9px] text-white/55">
                        {new Date(b.startTime).toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" })} · {b.hours}ц · {b.totalPrice.toLocaleString()}₮
                      </div>
                    </div>
                  </div>
                  <button
                    disabled={cancelling === b.id}
                    onClick={() => cancelMutation.mutate(b.id)}
                    className="glass-action min-h-0 rounded-lg px-3 py-1.5 text-[9px] text-white/75 hover:text-red-300 disabled:opacity-45"
                  >
                    {cancelling === b.id ? "..." : "Цуцлах"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── TABS ── */}
        <div className="mb-4 flex gap-2">
          {(["history", "favorites"] as const).map((t) => {
            const count = t === "history" ? historyTotal : favorites.length;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-2xl border py-3 text-[11px] font-semibold transition-all duration-300 backdrop-blur-xl ${
                  tab === t
                    ? "border-white/[0.15] bg-white/[0.12] text-white shadow-lg"
                    : "border-white/[0.10] bg-white/[0.055] text-white/62 hover:bg-white/[0.10] hover:text-white"
                }`}
              >
                {t === "history" ? "Түүх" : "Дуртай"}
                {count > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-medium ${
                    tab === t ? "bg-white/20 text-white/80" : "bg-white/[0.08] text-white/55"
                  }`}>{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── HISTORY ── */}
        {tab === "history" && (
          <div className="soft-glass-panel-muted rounded-3xl overflow-hidden">

            {/* Status pills */}
            <div className="flex gap-1.5 p-3 border-b border-white/[0.06]">
              {(["ALL", "CONFIRMED", "CANCELLED", "NOSHOW"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => { setStatusFilter(s); setHistoryPage(1); }}
                  className={`flex-1 rounded-xl py-2 text-[9px] font-semibold transition-all duration-200 ${
                    statusFilter === s
                      ? "bg-white/[0.14] text-white"
                      : "text-white/58 hover:bg-white/[0.09] hover:text-white"
                  }`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>

            {/* Empty / skeleton */}
            {history.length === 0 && historyTotal === 0 && (
              <div className="space-y-0 divide-y divide-white/[0.04]">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-4">
                    <div className="flex-1 space-y-2">
                      <div className="h-2 w-16 animate-pulse rounded-full bg-white/[0.06]" />
                      <div className="h-3 w-32 animate-pulse rounded-full bg-white/[0.08]" />
                      <div className="h-2 w-24 animate-pulse rounded-full bg-white/[0.05]" />
                    </div>
                    <div className="h-4 w-16 animate-pulse rounded-full bg-white/[0.06]" />
                  </div>
                ))}
              </div>
            )}

            {/* Rows */}
            <div className="divide-y divide-white/[0.05]">
              {history.map((b: any) => (
                <div key={b.id} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-white/[0.03]">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="mono text-[9px] text-white/45">{b.code}</span>
                      <span className={`h-1 w-1 rounded-full ${
                        b.status === "CONFIRMED" ? "bg-green-400" :
                        b.status === "CANCELLED" ? "bg-red-400/70" : "bg-orange-400/70"
                      }`} />
                    </div>
                    <div className="mt-0.5 text-[13px] font-semibold text-white/90">
                      {b.bookingSeats.map((bs: any) => bs.seat.number).join(", ")}
                      <span className="ml-2 text-[11px] font-normal text-white/55">{b.center.name}</span>
                    </div>
                    <div className="mono mt-0.5 text-[9px] text-white/45">
                      {new Date(b.startTime).toLocaleDateString("mn-MN")} · {b.hours}ц
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="mono text-[13px] font-semibold text-white/60">{b.totalPrice.toLocaleString()}₮</div>
                    {b.review && <div className="mono text-[9px] text-yellow-400/55">{"★".repeat(b.review.rating)}</div>}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalHistoryPages > 1 && (
              <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-3">
                <button
                  disabled={historyPage <= 1}
                  onClick={() => setHistoryPage((p) => p - 1)}
                  className="glass-action min-h-0 rounded-lg px-3 py-1.5 text-[10px] text-white/75 disabled:opacity-35"
                >
                  ← Өмнөх
                </button>
                <span className="mono text-[10px] text-white/50">{historyPage} / {totalHistoryPages}</span>
                <button
                  disabled={historyPage >= totalHistoryPages}
                  onClick={() => setHistoryPage((p) => p + 1)}
                  className="glass-action min-h-0 rounded-lg px-3 py-1.5 text-[10px] text-white/75 disabled:opacity-35"
                >
                  Дараах →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── FAVORITES ── */}
        {tab === "favorites" && (
          <div className="soft-glass-panel-muted rounded-3xl overflow-hidden">
            {favorites.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-20 text-center">
                <div className="text-3xl opacity-20">♡</div>
                <p className="text-sm font-medium text-white/55">Дуртай центр байхгүй</p>
                <p className="text-[11px] text-white/45">Центрийн хуудсан дээрх ♡ дарж нэмнэ үү</p>
                <Link
                  href="/"
                  className="glass-action mt-3 px-5 py-2.5 text-[11px]"
                >
                  Центрүүд харах →
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.05]">
                {favorites.map((c) => {
                  const img = getMainImage(c.images);
                  return (
                    <div key={c.id} className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-white/[0.03]">
                      {/* Thumbnail */}
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white/[0.06]">
                        {img && (
                          <Image
                            src={img}
                            alt={c.name}
                            fill
                            className="object-cover opacity-60 transition-opacity group-hover:opacity-80"
                            sizes="48px"
                          />
                        )}
                      </div>

                      {/* Info */}
                      <Link href={`/centers/${c.id}`} className="min-w-0 flex-1">
                        <div className="text-[9px] font-medium text-white/55">{c.district}</div>
                        <div className="truncate text-[13px] font-semibold text-white/90">{c.name}</div>
                        <div className="mono mt-0.5 flex items-center gap-2.5 text-[9px] text-white/52">
                          <span>{c.rating.toFixed(1)} ★</span>
                          <span>{c.availableSeats}/{c.seatCount} сул</span>
                          {c.minPricePerHour && <span>{c.minPricePerHour.toLocaleString()}₮/ц</span>}
                        </div>
                      </Link>

                      {/* Remove */}
                      <button
                        onClick={() => unfavoriteMutation.mutate(c.id)}
                        disabled={unfavoriteMutation.isPending}
                        className="glass-action min-h-0 shrink-0 rounded-lg p-2 text-white/70 hover:bg-red-500/15 hover:text-red-300 disabled:opacity-45"
                      >
                        <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
                          <path d="M4 4L16 16M16 4L4 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
