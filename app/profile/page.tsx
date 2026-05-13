"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/useAuth";
import { apiFetch } from "@/lib/api";
import { useBookingHistory } from "@/lib/hooks/useBookingHistory";
import { getMainImage } from "@/lib/image-types";

interface ReviewModal {
  bookingId: string;
  centerName: string;
}

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
  STAFF: "Ажилтан",
  OWNER: "Эзэн",
  ADMIN: "Админ",
};

export default function ProfilePage() {
  const { user, token, loading: authLoading, logout } = useAuth();
  const [historyPage, setHistoryPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [tab, setTab] = useState<"stats" | "history" | "favorites">("stats");
  const [reviewModal, setReviewModal] = useState<ReviewModal | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const qc = useQueryClient();

  const reviewMutation = useMutation({
    mutationFn: ({ bookingId, rating, comment }: { bookingId: string; rating: number; comment: string }) =>
      apiFetch("/api/reviews", {
        method: "POST", token,
        body: JSON.stringify({ bookingId, rating, comment: comment || undefined }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookingHistory"] });
      qc.invalidateQueries({ queryKey: ["me", "stats"] });
      setReviewModal(null);
      setReviewRating(5);
      setReviewComment("");
    },
  });

  const { data: activeData } = useQuery<{ bookings: Booking[] }>({
    queryKey: ["activeBookings"],
    queryFn: () => apiFetch("/api/bookings", { token }),
    enabled: !!token,
    staleTime: 20_000,
  });
  const activeBookings = activeData?.bookings ?? [];

  const { data: stats } = useQuery<Stats>({
    queryKey: ["me", "stats"],
    queryFn: () => apiFetch("/api/me/stats", { token }),
    enabled: !!token,
    staleTime: 60_000,
  });

  const { data: favData } = useQuery<{ centers: FavCenter[] }>({
    queryKey: ["favorites"],
    queryFn: () => apiFetch("/api/favorites", { token }),
    enabled: !!token,
    staleTime: 60_000,
  });
  const favorites = favData?.centers ?? [];

  const { data: historyData } = useBookingHistory(historyPage, statusFilter);
  const history = historyData?.bookings ?? [];
  const historyTotal = historyData?.pagination?.total ?? 0;

  const cancelMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/bookings/${id}/cancel`, {
        method: "PATCH", token,
        body: JSON.stringify({ reason: "Player cancelled" }),
      }),
    onMutate: (id) => setCancelling(id),
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
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#0a0a0a]">
        <h1 className="display text-5xl text-white">LOGIN REQUIRED</h1>
        <Link href="/login" className="text-xs uppercase tracking-[0.3em] text-white/40 hover:text-white transition-colors">
          НЭВТРЭХ →
        </Link>
      </main>
    );
  }

  const active = activeBookings.filter((b) => b.status === "PENDING" || b.status === "CONFIRMED");
  const totalHistoryPages = Math.ceil(historyTotal / 10);
  const maxBar = stats ? Math.max(...stats.monthlySpending.map((m) => m.total), 1) : 1;

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">

      {/* ── HEADER ── */}
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4 md:px-12">
        <Link href="/" className="text-[10px] uppercase tracking-[0.3em] text-white/40 hover:text-white transition-colors">
          ← HOME
        </Link>
        <span className="display text-xl">PROFILE</span>
        <button
          onClick={logout}
          className="text-[10px] uppercase tracking-[0.3em] text-white/20 hover:text-red-400 transition-colors"
        >
          LOGOUT
        </button>
      </header>

      {/* ── USER HERO ── */}
      <section className="border-b border-white/10 px-6 py-10 md:px-12 md:py-14">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[9px] uppercase tracking-[0.35em] text-white/25 border border-white/10 px-2 py-0.5">
                {ROLE_LABELS[user.role] ?? user.role}
              </span>
              {active.length > 0 && (
                <span className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.2em] text-green-400">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-50" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-400" />
                  </span>
                  {active.length} идэвхтэй
                </span>
              )}
            </div>
            <h1 className="display text-4xl leading-none md:text-6xl">{user.name.toUpperCase()}</h1>
            <p className="mt-3 text-[11px] text-white/25 mono">{user.phone} · {user.email}</p>
          </div>

          {/* Balance pill */}
          <div className="border border-white/10 bg-white/[0.03] px-6 py-4 text-right">
            <div className="mono text-2xl md:text-3xl">{user.balance.toLocaleString()}₮</div>
            <div className="mt-1 text-[9px] uppercase tracking-[0.3em] text-white/30">ҮЛДЭГДЭЛ</div>
          </div>
        </div>
      </section>

      {/* ── STATS STRIP ── */}
      {stats && (
        <section className="grid grid-cols-3 border-b border-white/10 md:grid-cols-6">
          {[
            { v: `${stats.totalHours.toFixed(0)}ц`, l: "Нийт цаг" },
            { v: `${(stats.totalSpent / 1000).toFixed(0)}к₮`, l: "Зарцуулсан" },
            { v: String(stats.bookingCount), l: "Захиалга" },
            { v: String(stats.noShowCount), l: "Ирээгүй" },
            { v: String(stats.favoritesCount), l: "Дуртай" },
            { v: `${(stats.balance / 1000).toFixed(0)}к₮`, l: "Үлдэгдэл" },
          ].map((s, i) => (
            <div
              key={i}
              className="flex flex-col items-center justify-center py-5 border-white/[0.06] [&:not(:last-child)]:border-r"
            >
              <div className="mono text-xl md:text-2xl text-white">{s.v}</div>
              <div className="mt-1 text-[8px] uppercase tracking-[0.2em] text-white/25">{s.l}</div>
            </div>
          ))}
        </section>
      )}

      {/* ── TABS ── */}
      <div className="flex border-b border-white/10">
        {(["stats", "history", "favorites"] as const).map((t) => {
          const badge =
            t === "history" && historyTotal > 0 ? historyTotal :
            t === "favorites" && stats ? stats.favoritesCount : null;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-[9px] uppercase tracking-[0.3em] transition-colors ${
                tab === t
                  ? "border-b-2 border-white text-white"
                  : "text-white/25 hover:text-white/50"
              }`}
            >
              {t === "stats" ? "Статистик" : t === "history" ? "Түүх" : "Дуртай"}
              {badge != null && badge > 0 && (
                <span className={`mono text-[8px] px-1.5 py-0.5 rounded-full ${tab === t ? "bg-white/10 text-white/60" : "bg-white/[0.04] text-white/20"}`}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── STATS TAB ── */}
      {tab === "stats" && (
        <div className="divide-y divide-white/[0.06]">

          {/* Monthly chart */}
          {stats && (
            <section className="px-6 py-8 md:px-12">
              <h3 className="text-[9px] uppercase tracking-[0.35em] text-white/30 mb-6">САРЫН ЗАРЦУУЛАЛТ</h3>
              <div className="flex items-end gap-2 h-32">
                {stats.monthlySpending.map((m) => {
                  const pct = (m.total / maxBar) * 100;
                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5">
                      <span className="mono text-[8px] text-white/25">
                        {m.total > 0 ? `${(m.total / 1000).toFixed(0)}к` : ""}
                      </span>
                      <div className="w-full flex items-end" style={{ height: 80 }}>
                        <div
                          className="w-full transition-all duration-500 hover:opacity-80"
                          style={{
                            height: `${Math.max(pct, m.total > 0 ? 4 : 0)}%`,
                            background: m.total > 0
                              ? "linear-gradient(to top, rgba(255,255,255,0.35), rgba(255,255,255,0.08))"
                              : "rgba(255,255,255,0.04)",
                          }}
                        />
                      </div>
                      <span className="mono text-[8px] text-white/20">{m.month.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Top centers */}
          {stats && stats.topCenters.length > 0 && (
            <section className="px-6 py-8 md:px-12">
              <h3 className="text-[9px] uppercase tracking-[0.35em] text-white/30 mb-6">ТОП ЦЕНТРҮҮД</h3>
              <div className="space-y-3">
                {stats.topCenters.map((tc, i) => (
                  <Link
                    key={tc.centerId}
                    href={`/centers/${tc.centerId}`}
                    className="flex items-center gap-4 border border-white/[0.06] bg-white/[0.02] p-4 hover:bg-white/[0.05] transition-colors"
                  >
                    <span className="mono text-2xl text-white/15 w-6 shrink-0">{i + 1}</span>
                    {tc.image && (
                      <div className="relative w-12 h-12 shrink-0 overflow-hidden bg-white/5">
                        <Image src={tc.image} alt={tc.name} fill className="object-cover opacity-70" sizes="48px" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold truncate">{tc.name}</div>
                      <div className="mono text-[10px] text-white/30 mt-0.5">
                        {tc.hours.toFixed(0)}ц · {tc.visits} удаа · {tc.spent.toLocaleString()}₮
                      </div>
                    </div>
                    <svg width="12" height="12" viewBox="0 0 20 20" fill="none" className="text-white/20 shrink-0">
                      <path d="M4 10h12M12 5l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Active bookings */}
          <section className="px-6 py-8 md:px-12">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[9px] uppercase tracking-[0.35em] text-white/30">ИДЭВХТЭЙ ЗАХИАЛГА</h3>
              <span className="mono text-[9px] text-white/20">{active.length}</span>
            </div>
            {active.length === 0 ? (
              <p className="text-sm text-white/15">Идэвхтэй захиалга байхгүй.</p>
            ) : (
              <div className="space-y-3">
                {active.map((b) => (
                  <div key={b.id} className="border border-white/[0.08] bg-white/[0.02] p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="mono text-[10px] text-white/25">{b.code}</div>
                        <div className="display text-2xl mt-0.5">
                          {b.bookingSeats.map((bs) => bs.seat.number).join(", ")}
                        </div>
                        <div className="mt-1 text-sm text-white/60">{b.center.name}</div>
                        <div className="mono text-[10px] text-white/25 mt-1">
                          {new Date(b.startTime).toLocaleDateString("mn-MN")} ·{" "}
                          {new Date(b.startTime).toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" })} ·{" "}
                          {b.hours}ц · {b.totalPrice.toLocaleString()}₮
                        </div>
                      </div>
                      <button
                        disabled={cancelling === b.id}
                        onClick={() => cancelMutation.mutate(b.id)}
                        className="shrink-0 border border-white/10 px-4 py-2 text-[9px] uppercase tracking-[0.25em] text-white/40 hover:border-red-400/50 hover:text-red-400 disabled:opacity-30 transition-colors"
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
          <div className="flex border-b border-white/[0.06]">
            {(["ALL", "CONFIRMED", "CANCELLED", "NOSHOW"] as const).map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setHistoryPage(1); }}
                className={`flex-1 py-3 text-[8px] uppercase tracking-[0.2em] transition-colors ${
                  statusFilter === s ? "text-white border-b border-white" : "text-white/20 hover:text-white/40"
                }`}
              >
                {s === "ALL" ? "Бүгд" : s === "CONFIRMED" ? "Баталгаасан" : s === "CANCELLED" ? "Цуцалсан" : "Ирээгүй"}
              </button>
            ))}
          </div>

          <div className="px-6 py-3 md:px-12">
            <span className="mono text-[9px] text-white/20">{historyTotal} захиалга</span>
          </div>

          {history.length === 0 && (
            <p className="px-6 py-12 text-sm text-white/15 md:px-12">Захиалга олдсонгүй.</p>
          )}

          <div className="divide-y divide-white/[0.05]">
            {history.map((b: any) => (
              <div key={b.id} className="flex items-center gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors md:px-12">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <span className="mono text-[10px] text-white/20">{b.code}</span>
                    <span className={`text-[9px] uppercase tracking-[0.2em] ${
                      b.status === "CONFIRMED" ? "text-green-400" :
                      b.status === "CANCELLED" ? "text-red-400/70" :
                      b.status === "NOSHOW" ? "text-orange-400/70" : "text-white/30"
                    }`}>
                      {b.status === "CONFIRMED" ? "✓" : b.status === "CANCELLED" ? "✕" : "—"}
                    </span>
                  </div>
                  <div className="mt-0.5 text-sm font-medium">
                    {b.bookingSeats.map((bs: any) => bs.seat.number).join(", ")}
                    <span className="ml-2 text-white/40 font-normal text-xs">{b.center.name}</span>
                  </div>
                  <div className="mono text-[10px] text-white/20 mt-0.5">
                    {new Date(b.startTime).toLocaleDateString("mn-MN")} · {b.hours}ц
                  </div>
                </div>
                <div className="text-right shrink-0 flex flex-col items-end gap-2">
                  <div className="mono text-sm text-white/60">{b.totalPrice.toLocaleString()}₮</div>
                  {b.status === "CONFIRMED" && new Date(b.endTime) < new Date() && (
                    b.review ? (
                      <span className="mono text-[9px] text-yellow-400/60">{"★".repeat(b.review.rating)}</span>
                    ) : (
                      <button
                        onClick={() => setReviewModal({ bookingId: b.id, centerName: b.center.name })}
                        className="text-[9px] uppercase tracking-[0.2em] text-white/25 hover:text-white border border-white/10 hover:border-white/30 px-2 py-1 transition-colors"
                      >
                        ҮНЭЛЭХ
                      </button>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>

          {totalHistoryPages > 1 && (
            <div className="flex items-center justify-center gap-6 border-t border-white/[0.06] py-5">
              <button
                disabled={historyPage <= 1}
                onClick={() => setHistoryPage((p) => p - 1)}
                className="text-[10px] uppercase tracking-[0.3em] text-white/20 hover:text-white disabled:opacity-20 transition-colors"
              >
                ← ӨМНӨХ
              </button>
              <span className="mono text-[10px] text-white/30">
                {historyPage} / {totalHistoryPages}
              </span>
              <button
                disabled={historyPage >= totalHistoryPages}
                onClick={() => setHistoryPage((p) => p + 1)}
                className="text-[10px] uppercase tracking-[0.3em] text-white/20 hover:text-white disabled:opacity-20 transition-colors"
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
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-white/10">
                <path d="M12 21C12 21 3 14.5 3 8.5C3 5.42 5.42 3 8.5 3C10.24 3 11.91 3.81 13 5.08C14.09 3.81 15.76 3 17.5 3C20.58 3 23 5.42 23 8.5C23 14.5 12 21 12 21Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              </svg>
              <p className="display text-2xl text-white/10">ДУРТАЙ ЦЕНТР БАЙХГҮЙ</p>
              <p className="text-sm text-white/20 text-center">Центрийн хуудсан дээрх ♡ дарж нэмнэ үү.</p>
              <Link href="/" className="mt-2 text-[10px] uppercase tracking-[0.3em] text-white/30 hover:text-white transition-colors">
                ЦЕНТРҮҮД ХАРАХ →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {favorites.map((c) => {
                const img = getMainImage(c.images);
                return (
                  <div key={c.id} className="group relative overflow-hidden border border-white/[0.08]">
                    <Link href={`/centers/${c.id}`} className="block">
                      <div className="relative aspect-[16/7] bg-white/[0.03]">
                        {img && (
                          <Image
                            src={img}
                            alt={c.name}
                            fill
                            className="object-cover opacity-50 group-hover:opacity-70 transition-opacity duration-500"
                            sizes="(max-width: 768px) 100vw, 50vw"
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-4">
                          <div className="text-[8px] uppercase tracking-[0.3em] text-white/40 mb-1">{c.district}</div>
                          <div className="display text-lg leading-tight">{c.name.toUpperCase()}</div>
                          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-white/40 mono">
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
                      className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center border border-white/20 bg-black/60 text-white/50 text-xs hover:border-red-400/60 hover:text-red-400 transition-colors"
                      title="Хасах"
                    >
                      ♥
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── REVIEW MODAL ── */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="w-full max-w-md border border-white/10 bg-[#111] p-6">
            <div className="mb-5">
              <p className="text-[9px] uppercase tracking-[0.3em] text-white/30">ҮНЭЛГЭЭ ҮЛДЭЭХ</p>
              <h3 className="display mt-1 text-2xl">{reviewModal.centerName.toUpperCase()}</h3>
            </div>

            {/* Star picker */}
            <div className="flex gap-2 mb-5">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  onClick={() => setReviewRating(s)}
                  className={`text-2xl transition-colors ${s <= reviewRating ? "text-yellow-400" : "text-white/15 hover:text-white/40"}`}
                >
                  ★
                </button>
              ))}
            </div>

            {/* Comment textarea */}
            <textarea
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder="Сэтгэгдэл бичих (заавал биш)..."
              maxLength={500}
              rows={4}
              className="w-full resize-none bg-white/[0.04] border border-white/10 px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 mb-5"
            />

            <div className="flex gap-3">
              <button
                onClick={() => { setReviewModal(null); setReviewRating(5); setReviewComment(""); }}
                className="flex-1 border border-white/10 py-3 text-[10px] uppercase tracking-[0.25em] text-white/30 hover:text-white transition-colors"
              >
                ЦУЦЛАХ
              </button>
              <button
                disabled={reviewMutation.isPending}
                onClick={() => reviewMutation.mutate({ bookingId: reviewModal.bookingId, rating: reviewRating, comment: reviewComment })}
                className="flex-1 bg-white py-3 text-[10px] uppercase tracking-[0.25em] text-black hover:bg-white/90 disabled:opacity-40 transition-colors"
              >
                {reviewMutation.isPending ? "..." : "ИЛГЭЭХ"}
              </button>
            </div>
            {reviewMutation.isError && (
              <p className="mt-3 text-xs text-red-400">Алдаа гарлаа. Дахин оролдоно уу.</p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
