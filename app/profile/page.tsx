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

const fu = (delay: number) =>
  ({ style: { animationDelay: `${delay}ms` }, className: "animate-[fadeUp_0.55s_cubic-bezier(0.22,1,0.36,1)_forwards] opacity-0" } as const);

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

  const { data: favData, isLoading: favoritesLoading } = useQuery<{ centers: FavCenter[] }>({
    queryKey: ["favorites"],
    queryFn:  () => apiFetch("/api/favorites", { token }),
    enabled:  !!token,
    staleTime: 60_000,
  });
  const favorites = favData?.centers ?? [];

  const { data: historyData, isLoading: historyLoading, isFetching: historyFetching } = useBookingHistory(historyPage, statusFilter);
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
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0a0a0a]">
        <p className="text-sm font-medium text-white/40">Нэвтрэх шаардлагатай</p>
        <Link href="/login" className="rounded-2xl bg-white/[0.08] px-6 py-3 text-sm font-semibold text-white backdrop-blur-xl transition hover:bg-white/[0.14]">
          Нэвтрэх →
        </Link>
      </main>
    );
  }

  return (
    <main className="soft-glass-page text-white">
      {/* Ambient blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-white/[0.022] blur-[130px]" />
        <div className="absolute -right-40 top-1/3 h-[400px] w-[400px] rounded-full bg-white/[0.016] blur-[110px]" />
        <div className="absolute bottom-0 left-1/3 h-[350px] w-[350px] rounded-full bg-white/[0.012] blur-[110px]" />
      </div>

      <div className="relative mx-auto max-w-2xl px-4 pb-24 pt-24 md:pt-28">

        {/* ── Back ── */}
        <div {...fu(0)}>
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-white/45 transition-colors hover:text-white/90"
          >
            ← Нүүр
          </Link>
        </div>

        {/* ── USER CARD ── */}
        <div {...fu(60)} className={`${fu(60).className} mb-5`}>
          <div className="soft-glass-panel rounded-3xl p-6 md:p-8">
            <div className="flex items-start justify-between gap-4">
              {/* Avatar + name */}
              <div className="flex items-center gap-4">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/[0.08] text-xl font-black ring-1 ring-white/[0.10] backdrop-blur-xl">
                  {user.name.charAt(0).toUpperCase()}
                  {/* subtle glow */}
                  <div className="absolute inset-0 rounded-2xl bg-white/[0.04] blur-sm" />
                </div>
                <div>
                  <div className="text-[9px] font-semibold uppercase tracking-[0.28em] text-white/45">
                    {user.role}
                  </div>
                  <div className="mt-0.5 text-lg font-bold text-white">{user.name}</div>
                  <div className="text-[11px] text-white/50">{user.email}</div>
                </div>
              </div>

              {/* Balance + logout */}
              <div className="flex flex-col items-end gap-2">
                <div className="rounded-xl border border-white/[0.09] bg-white/[0.07] px-4 py-2.5 text-right backdrop-blur-xl transition-colors hover:bg-white/[0.10]">
                  <div className="text-[8px] font-semibold uppercase tracking-[0.22em] text-white/50">Үлдэгдэл</div>
                  <div className="mt-0.5 font-black text-white" style={{ fontSize: "clamp(14px,2.5vw,18px)" }}>
                    {user.balance.toLocaleString()}₮
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="text-[9px] font-medium uppercase tracking-[0.18em] text-white/35 transition-colors hover:text-red-400"
                >
                  Гарах
                </button>
              </div>
            </div>

            {/* Active bookings */}
            {activeBookings.length > 0 && (
              <div className="mt-5 space-y-2">
                {activeBookings.map((b, i) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between rounded-2xl border border-green-400/20 bg-green-400/[0.07] px-4 py-3 backdrop-blur-xl transition-colors hover:bg-green-400/[0.10]"
                    style={{ animation: `fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) ${i * 60}ms both` }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="relative flex h-1.5 w-1.5 shrink-0">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-50" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-400" />
                      </span>
                      <div>
                        <div className="text-[11px] font-semibold text-white">
                          {b.bookingSeats.map((bs) => bs.seat.number).join(", ")}
                          <span className="ml-1.5 font-normal text-white/45">{b.center.name}</span>
                        </div>
                        <div className="mono text-[9px] text-white/50">
                          {new Date(b.startTime).toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" })} · {b.hours}ц · {b.totalPrice.toLocaleString()}₮
                        </div>
                      </div>
                    </div>
                    <button
                      disabled={cancelling === b.id}
                      onClick={() => cancelMutation.mutate(b.id)}
                      className="glass-action min-h-0 rounded-lg px-3 py-1.5 text-[9px] text-white/65 transition-colors hover:text-red-300 disabled:opacity-40"
                    >
                      {cancelling === b.id ? "···" : "Цуцлах"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── TABS ── */}
        <div {...fu(120)} className={`${fu(120).className} mb-4 flex gap-2`}>
          {(["history", "favorites"] as const).map((t) => {
            const count = t === "history" ? historyTotal : favorites.length;
            const active = tab === t;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`group flex flex-1 items-center justify-center gap-2 rounded-2xl border py-3 text-[11px] font-semibold transition-all duration-300 backdrop-blur-xl ${
                  active
                    ? "border-white/[0.14] bg-white/[0.11] text-white shadow-[0_0_24px_rgba(255,255,255,0.04)]"
                    : "border-white/[0.08] bg-white/[0.04] text-white/45 hover:border-white/[0.12] hover:bg-white/[0.08] hover:text-white/75"
                }`}
              >
                <span className={`transition-transform duration-300 ${active ? "" : "group-hover:scale-105"}`}>
                  {t === "history" ? "Түүх" : "Дуртай"}
                </span>
                {count > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-medium transition-colors ${
                    active ? "bg-white/[0.18] text-white/75" : "bg-white/[0.07] text-white/40"
                  }`}>{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── HISTORY ── */}
        {tab === "history" && (
          <div className="animate-[fadeUp_0.4s_cubic-bezier(0.22,1,0.36,1)_forwards] opacity-0">
            <div className="soft-glass-panel-muted overflow-hidden rounded-3xl">

              {/* Status pills */}
              <div className="flex gap-1 border-b border-white/[0.06] p-2.5">
                {(["ALL", "CONFIRMED", "CANCELLED", "NOSHOW"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => { setStatusFilter(s); setHistoryPage(1); }}
                    className={`flex-1 rounded-xl py-2 text-[9px] font-semibold transition-all duration-200 ${
                      statusFilter === s
                        ? "bg-white/[0.13] text-white"
                        : "text-white/50 hover:bg-white/[0.07] hover:text-white/80"
                    }`}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>

              {/* Skeleton */}
              {historyLoading && history.length === 0 && (
                <div className="divide-y divide-white/[0.04]">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 px-5 py-4" style={{ opacity: 1 - i * 0.15 }}>
                      <div className="flex-1 space-y-2">
                        <div className="h-2 w-14 animate-pulse rounded-full bg-white/[0.06]" />
                        <div className="h-3 w-36 animate-pulse rounded-full bg-white/[0.09]" />
                        <div className="h-2 w-24 animate-pulse rounded-full bg-white/[0.05]" />
                      </div>
                      <div className="h-4 w-16 animate-pulse rounded-full bg-white/[0.06]" />
                    </div>
                  ))}
                </div>
              )}

              {/* Empty */}
              {!historyLoading && history.length === 0 && historyTotal === 0 && (
                <div className="px-6 py-16 text-center">
                  <div className="mb-3 text-4xl opacity-10">◯</div>
                  <p className="text-sm font-semibold text-white/50">Захиалгын түүх алга</p>
                  <p className="mt-1 text-[11px] text-white/35">Шүүлтүүрээ өөрчлөх эсвэл шинэ захиалга үүсгэнэ үү.</p>
                  <Link href="/#centers" className="glass-action mt-5 inline-block px-5 py-2.5 text-[10px] uppercase tracking-[0.18em]">
                    Центр сонгох
                  </Link>
                </div>
              )}

              {/* Rows */}
              <div className={`divide-y divide-white/[0.05] transition-opacity duration-300 ${historyFetching && !historyLoading ? "opacity-50" : "opacity-100"}`}>
                {history.map((b: any, i: number) => (
                  <div
                    key={b.id}
                    className="group flex items-center gap-4 px-5 py-4 transition-colors duration-150 hover:bg-white/[0.03]"
                    style={{ animation: `fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) ${i * 35}ms both` }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="mono text-[9px] text-white/35 transition-colors group-hover:text-white/55">{b.code}</span>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          b.status === "CONFIRMED" ? "bg-green-400" :
                          b.status === "CANCELLED" ? "bg-red-400/70" : "bg-orange-400/70"
                        }`} />
                        <span className={`text-[8px] font-medium uppercase tracking-[0.15em] ${
                          b.status === "CONFIRMED" ? "text-green-400/60" :
                          b.status === "CANCELLED" ? "text-red-400/50" : "text-orange-400/50"
                        }`}>{b.status}</span>
                      </div>
                      <div className="mt-1 text-[13px] font-semibold text-white/85 transition-colors group-hover:text-white">
                        {b.bookingSeats.map((bs: any) => bs.seat.number).join(", ")}
                        <span className="ml-2 text-[11px] font-normal text-white/45">{b.center.name}</span>
                      </div>
                      <div className="mono mt-0.5 text-[9px] text-white/40">
                        {new Date(b.startTime).toLocaleDateString("mn-MN")} · {b.hours}ц
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="mono text-[13px] font-semibold text-white/55 transition-colors group-hover:text-white/80">
                        {b.totalPrice.toLocaleString()}₮
                      </div>
                      {b.review && (
                        <div className="mono mt-0.5 text-[9px] text-yellow-400/60">{"★".repeat(b.review.rating)}</div>
                      )}
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
                    className="glass-action min-h-0 rounded-lg px-3 py-1.5 text-[10px] text-white/65 disabled:opacity-30"
                  >
                    ← Өмнөх
                  </button>
                  <span className="mono text-[10px] text-white/45">{historyPage} / {totalHistoryPages}</span>
                  <button
                    disabled={historyPage >= totalHistoryPages}
                    onClick={() => setHistoryPage((p) => p + 1)}
                    className="glass-action min-h-0 rounded-lg px-3 py-1.5 text-[10px] text-white/65 disabled:opacity-30"
                  >
                    Дараах →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── FAVORITES ── */}
        {tab === "favorites" && (
          <div className="animate-[fadeUp_0.4s_cubic-bezier(0.22,1,0.36,1)_forwards] opacity-0">
            <div className="soft-glass-panel-muted overflow-hidden rounded-3xl">
              {favoritesLoading ? (
                <div className="divide-y divide-white/[0.04]">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 px-5 py-4" style={{ opacity: 1 - i * 0.2 }}>
                      <div className="h-12 w-12 shrink-0 animate-pulse rounded-xl bg-white/[0.07]" />
                      <div className="flex-1 space-y-2">
                        <div className="h-2 w-16 animate-pulse rounded-full bg-white/[0.05]" />
                        <div className="h-3 w-36 animate-pulse rounded-full bg-white/[0.09]" />
                        <div className="h-2 w-28 animate-pulse rounded-full bg-white/[0.05]" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : favorites.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-20 text-center">
                  <div className="mb-1 text-4xl opacity-15 transition-transform hover:scale-110">♡</div>
                  <p className="text-sm font-semibold text-white/50">Дуртай центр байхгүй</p>
                  <p className="text-[11px] text-white/35">Центрийн хуудсан дээрх ♡ дарж нэмнэ үү</p>
                  <Link href="/" className="glass-action mt-3 px-5 py-2.5 text-[11px]">
                    Центрүүд харах →
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.05]">
                  {favorites.map((c, i) => {
                    const img = getMainImage(c.images);
                    return (
                      <div
                        key={c.id}
                        className="group flex items-center gap-4 px-5 py-4 transition-colors duration-150 hover:bg-white/[0.03]"
                        style={{ animation: `fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) ${i * 50}ms both` }}
                      >
                        {/* Thumbnail */}
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white/[0.06] ring-1 ring-white/[0.07] transition-all duration-300 group-hover:ring-white/[0.15]">
                          {img && (
                            <Image
                              src={img}
                              alt={c.name}
                              fill
                              className="object-cover opacity-55 transition-opacity duration-300 group-hover:opacity-80"
                              sizes="48px"
                            />
                          )}
                        </div>

                        {/* Info */}
                        <Link href={`/centers/${c.id}`} className="min-w-0 flex-1">
                          <div className="text-[9px] font-medium uppercase tracking-[0.18em] text-white/45">{c.district}</div>
                          <div className="truncate text-[13px] font-semibold text-white/85 transition-colors group-hover:text-white">
                            {c.name}
                          </div>
                          <div className="mono mt-0.5 flex items-center gap-2.5 text-[9px] text-white/45">
                            <span className="text-yellow-400/70">★ {c.rating.toFixed(1)}</span>
                            <span className="text-white/25">·</span>
                            <span>{c.availableSeats}/{c.seatCount} сул</span>
                            {c.minPricePerHour && (
                              <>
                                <span className="text-white/25">·</span>
                                <span>{c.minPricePerHour.toLocaleString()}₮/ц</span>
                              </>
                            )}
                          </div>
                        </Link>

                        {/* Remove */}
                        <button
                          onClick={() => unfavoriteMutation.mutate(c.id)}
                          disabled={unfavoriteMutation.isPending}
                          className="glass-action min-h-0 shrink-0 rounded-lg p-2 text-white/50 transition-all duration-200 hover:bg-red-500/[0.12] hover:text-red-300 disabled:opacity-40"
                        >
                          <svg width="11" height="11" viewBox="0 0 20 20" fill="none">
                            <path d="M4 4L16 16M16 4L4 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
