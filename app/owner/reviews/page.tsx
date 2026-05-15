"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/useAuth";
import { apiFetch } from "@/lib/api";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  ownerReply: string | null;
  createdAt: string;
  user: { id: string; name: string; phone: string };
  center: { id: string; name: string };
}

interface Center {
  id: string;
  name: string;
}

export default function OwnerReviewsPage() {
  const { token, loading: authLoading } = useAuth();
  const qc = useQueryClient();
  const [centerId, setCenterId] = useState<string>("");
  const [page, setPage] = useState(1);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const { data, isLoading } = useQuery<{ reviews: Review[]; total: number; centers: Center[] }>({
    queryKey: ["owner", "reviews", centerId, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page) });
      if (centerId) params.set("centerId", centerId);
      return apiFetch(`/api/owner/reviews?${params}`, { token });
    },
    enabled: !!token,
    staleTime: 30_000,
  });

  const replyMutation = useMutation({
    mutationFn: ({ id, ownerReply }: { id: string; ownerReply: string }) =>
      apiFetch(`/api/owner/reviews/${id}/reply`, {
        method: "PATCH", token,
        body: JSON.stringify({ ownerReply }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["owner", "reviews"] });
      setReplyingId(null);
      setReplyText("");
    },
  });

  const reviews = data?.reviews ?? [];
  const centers = data?.centers ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  if (authLoading) return null;

  return (
    <main className="owner-dark min-h-screen text-white">

      {/* Header */}
      <header className="owner-topbar flex flex-wrap items-center justify-between gap-3 px-5 py-4 md:px-12">
        <Link href="/owner/dashboard" className="text-[10px] uppercase tracking-[0.3em] text-white/40 hover:text-white transition-colors">
          ← DASHBOARD
        </Link>
        <span className="display text-xl">REVIEWS</span>
        <span className="mono text-[10px] text-white/20">{total} нийт</span>
      </header>

      {/* Filter bar */}
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-5 md:px-12">
        <select
          value={centerId}
          onChange={(e) => { setCenterId(e.target.value); setPage(1); }}
          className="owner-field-dark px-3 py-2 text-[11px] uppercase tracking-[0.15em] text-white/70 focus:outline-none"
        >
          <option value="">Бүх центр</option>
          {centers.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Review list */}
      {isLoading ? (
        <div className="mx-auto max-w-6xl space-y-3 px-5 py-6 md:px-12">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse bg-white/[0.03] border border-white/[0.05]" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="flex min-h-[320px] flex-col items-center justify-center text-center px-6">
          <p className="display text-3xl text-white/10">ҮНЭЛГЭЭ БАЙХГҮЙ</p>
          <p className="mt-2 text-sm text-white/20">Хэрэглэгчид үнэлгээ үлдээгээгүй байна.</p>
        </div>
      ) : (
        <div className="mx-auto grid max-w-6xl gap-4 px-5 pb-10 md:px-12">
          {reviews.map((r) => (
            <div key={r.id} className="owner-card-dark p-5">
              {/* Top row */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center bg-white/10 text-[11px] font-black text-white shrink-0">
                    {r.user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{r.user.name}</span>
                      <span className="mono text-[9px] text-white/25">{r.user.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="mono text-[10px] text-yellow-400">
                        {"★".repeat(r.rating)}
                        <span className="text-white/15">{"★".repeat(5 - r.rating)}</span>
                      </span>
                      <span className="text-[9px] text-white/20">{r.center.name}</span>
                      <span className="text-[9px] text-white/15">
                        {new Date(r.createdAt).toLocaleDateString("mn-MN")}
                      </span>
                    </div>
                  </div>
                </div>

                {!r.ownerReply && replyingId !== r.id && (
                  <button
                    onClick={() => { setReplyingId(r.id); setReplyText(""); }}
                    className="owner-action shrink-0 border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[9px] uppercase tracking-[0.2em] text-white/40 hover:border-white/30 hover:text-white transition-colors"
                  >
                    ХАРИУЛАХ
                  </button>
                )}
              </div>

              {/* Comment */}
              {r.comment && (
                <p className="mt-3 text-sm leading-relaxed text-white/50 pl-12">{r.comment}</p>
              )}

              {/* Owner reply display */}
              {r.ownerReply && (
                <div className="mt-3 ml-12 border-l-2 border-white/10 pl-3">
                  <span className="text-[9px] uppercase tracking-[0.2em] text-white/25">Таны хариу</span>
                  <p className="mt-1 text-sm leading-relaxed text-white/40">{r.ownerReply}</p>
                  <button
                    onClick={() => { setReplyingId(r.id); setReplyText(r.ownerReply ?? ""); }}
                    className="mt-1 text-[9px] text-white/20 hover:text-white/50 transition-colors"
                  >
                    засах
                  </button>
                </div>
              )}

              {/* Reply form */}
              {replyingId === r.id && (
                <div className="mt-3 ml-12 space-y-2">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Хариу бичих..."
                    maxLength={500}
                    rows={3}
                    className="owner-field-dark w-full resize-none px-3 py-2 text-sm placeholder-white/20 focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setReplyingId(null); setReplyText(""); }}
                      className="owner-action border border-white/10 px-4 py-2 text-[9px] uppercase tracking-[0.2em] text-white/30 hover:text-white transition-colors"
                    >
                      ЦУЦЛАХ
                    </button>
                    <button
                      disabled={!replyText.trim() || replyMutation.isPending}
                      onClick={() => replyMutation.mutate({ id: r.id, ownerReply: replyText.trim() })}
                      className="owner-action bg-white px-4 py-2 text-[9px] uppercase tracking-[0.2em] text-black hover:bg-white/90 disabled:opacity-40 transition-colors"
                    >
                      {replyMutation.isPending ? "..." : "ХАДГАЛАХ"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-6 border-t border-white/[0.06] py-5">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="text-[10px] uppercase tracking-[0.3em] text-white/20 hover:text-white disabled:opacity-20 transition-colors"
          >
            ← ӨМНӨХ
          </button>
          <span className="mono text-[10px] text-white/30">{page} / {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="text-[10px] uppercase tracking-[0.3em] text-white/20 hover:text-white disabled:opacity-20 transition-colors"
          >
            ДАРААХ →
          </button>
        </div>
      )}
    </main>
  );
}
