"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { apiFetch, ApiError } from "@/lib/api";

interface TournamentDetail {
  id: string;
  name: string;
  game: string;
  description: string | null;
  rules: string | null;
  startTime: string;
  endTime: string | null;
  maxTeams: number;
  teamSize: number;
  entryFee: number;
  prizePool: number;
  prizeDescription: string | null;
  status: string;
  centerId: string;
  center: { id: string; name: string; address: string; district: string };
  teams: {
    id: string;
    name: string;
    playerNames: string[];
    paymentStatus: string;
    createdAt: string;
    members: { user: { id: string; name: string } }[];
  }[];
  matches: TournamentMatch[];
  _count: { teams: number };
}

interface TournamentMatch {
  id: string;
  round: number;
  matchNumber: number;
  scoreA: number | null;
  scoreB: number | null;
  status: string;
  scheduledAt: string | null;
  teamA: { id: string; name: string; playerNames: string[] } | null;
  teamB: { id: string; name: string; playerNames: string[] } | null;
  winnerTeam: { id: string; name: string } | null;
  stationSeat: { id: string; number: string } | null;
}

const STATUS_LABELS: Record<string, string> = {
  UPCOMING: "УДАХГҮЙ",
  REGISTRATION_CLOSED: "БҮРТГЭЛ ХААГДСАН",
  LIVE: "LIVE",
  COMPLETED: "ДУУССАН",
  CANCELLED: "ЦУЦЛАГДСАН",
};

/* ── Glassmorphism helpers ── */
const glass = "soft-glass-panel-muted rounded-2xl";
const glassStrong = "soft-glass-panel rounded-2xl";

export default function TournamentPage({
  params,
}: {
  params: { id: string; tournamentId: string };
}) {
  const { user, token } = useAuth();
  const [t, setT] = useState<TournamentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [teamName, setTeamName] = useState("");
  const [playerNamesText, setPlayerNamesText] = useState("");
  const [payMethod, setPayMethod] = useState<"QPAY" | "BALANCE">("QPAY");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [qpayPending, setQpayPending] = useState<{
    qrImage?: string;
    shortUrl?: string;
    deeplinks?: { name: string; link: string }[];
  } | null>(null);

  const fetchTournament = () => {
    apiFetch<{ tournament: TournamentDetail }>(`/api/tournaments/${params.tournamentId}`)
      .then(({ tournament }) => setT(tournament))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(fetchTournament, [params.tournamentId]);

  const myTeam = t?.teams.find((team) => team.members.some((m) => m.user.id === user?.id));
  const isFull = t ? t._count.teams >= t.maxTeams : false;
  const canRegister = t?.status === "UPCOMING" && !myTeam && !isFull && !!user;

  async function handleRegister() {
    if (!teamName.trim()) { setError("Багийн нэр оруулна уу"); return; }
    setSubmitting(true); setError(""); setSuccess(""); setQpayPending(null);
    try {
      const res = await apiFetch<{
        team: any;
        payment: { pending?: boolean; qrImage?: string; shortUrl?: string; deeplinks?: { name: string; link: string }[] } | null;
      }>(`/api/tournaments/${params.tournamentId}/register`, {
        method: "POST",
        body: JSON.stringify({
          teamName: teamName.trim(),
          playerNames: playerNamesText.split("\n").map((n) => n.trim()).filter(Boolean),
          paymentMethod: payMethod,
        }),
        token,
      });
      if (res.payment?.pending) {
        setQpayPending({ qrImage: res.payment.qrImage, shortUrl: res.payment.shortUrl, deeplinks: res.payment.deeplinks });
      } else {
        setSuccess("Бүртгэл амжилттай!");
        setTeamName(""); setPlayerNamesText("");
        fetchTournament();
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Алдаа гарлаа");
    } finally { setSubmitting(false); }
  }

  async function handleUnregister() {
    if (!confirm("Бүртгэлээ цуцлах уу?")) return;
    setSubmitting(true); setError(""); setSuccess("");
    try {
      await apiFetch(`/api/tournaments/${params.tournamentId}/register`, { method: "DELETE", token });
      setSuccess("Бүртгэл цуцлагдлаа");
      fetchTournament();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Алдаа гарлаа");
    } finally { setSubmitting(false); }
  }

  /* ── Loading ── */
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border border-white/10 border-t-white/50" />
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/20">Loading</p>
        </div>
      </main>
    );
  }

  if (!t) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0a0a0a]">
        <span className="text-2xl font-black text-white/20">ОЛДСОНГҮЙ</span>
        <Link href={`/centers/${params.id}`} className="text-[10px] uppercase tracking-[0.2em] text-white/30 hover:text-white">← Буцах</Link>
      </main>
    );
  }

  const start = new Date(t.startTime);
  const end = t.endTime ? new Date(t.endTime) : null;
  const bracketRounds = Array.from(new Set(t.matches.map((m) => m.round))).sort((a, b) => a - b);
  const slotsLeft = t.maxTeams - t._count.teams;

  return (
    <main className="soft-glass-page text-white">

      {/* Ambient blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 top-20 h-[400px] w-[400px] rounded-full bg-white/[0.02] blur-[120px]" />
        <div className="absolute -right-32 top-1/2 h-[350px] w-[350px] rounded-full bg-white/[0.015] blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-3xl px-4 pb-24 pt-24 md:pt-28">

        {/* Back */}
        <div className="mb-6 animate-[fadeUp_0.4s_ease_forwards] opacity-0" style={{ animationDelay: "0ms" }}>
          <Link href={`/centers/${params.id}`} className="inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-white/55 transition-colors hover:text-white">
            ← {t.center.name}
          </Link>
        </div>

        {/* ── Hero card ── */}
        <div className={`${glassStrong} mb-4 overflow-hidden animate-[fadeUp_0.5s_ease_forwards] opacity-0`} style={{ animationDelay: "60ms" }}>
          <div className="p-6 md:p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-center gap-2.5 flex-wrap">
                  <span className="mono text-[9px] font-medium uppercase tracking-[0.25em] text-white/58">{t.game}</span>
                  <span className="text-white/15">·</span>
                  <span className="mono text-[9px] text-white/50">{t.center.name}</span>
                </div>
                <h1 className="font-black text-white leading-tight" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px, 4vw, 40px)", letterSpacing: "-0.03em" }}>
                  {t.name}
                </h1>
              </div>
              <span className={`shrink-0 rounded-full px-3 py-1 text-[9px] font-semibold uppercase tracking-widest ${
                t.status === "LIVE"
                  ? "animate-pulse bg-green-500/20 text-green-400"
                  : t.status === "CANCELLED"
                  ? "bg-red-500/20 text-red-400"
                  : t.status === "COMPLETED"
                  ? "bg-white/10 text-white/40"
                  : "bg-white/10 text-white/70"
              }`}>
                {STATUS_LABELS[t.status] ?? t.status}
              </span>
            </div>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-2 divide-x divide-white/[0.06] border-t border-white/[0.06] sm:grid-cols-4">
            {[
              { label: "ОГНОО", value: start.toLocaleDateString("mn-MN", { month: "short", day: "numeric" }) },
              { label: "ЦАГ", value: `${start.toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" })}${end ? `–${end.toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" })}` : ""}` },
              { label: t.teamSize === 1 ? "ТОГЛОГЧ" : "БАГ", value: `${t._count.teams}/${t.maxTeams}` },
              { label: "ФОРМАТ", value: t.teamSize === 1 ? "Solo" : `${t.teamSize}v${t.teamSize}` },
            ].map(({ label, value }) => (
              <div key={label} className="px-5 py-4">
                <div className="text-[9px] font-medium uppercase tracking-[0.2em] text-white/55">{label}</div>
                <div className="mono mt-1 text-base font-black text-white">{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Prize + Fee ── */}
        {(t.entryFee > 0 || t.prizePool > 0) && (
          <div className={`${glass} mb-4 grid grid-cols-2 divide-x divide-white/[0.06] animate-[fadeUp_0.5s_ease_forwards] opacity-0`} style={{ animationDelay: "120ms" }}>
            <div className="px-6 py-5">
              <div className="text-[9px] font-medium uppercase tracking-[0.2em] text-white/55">ОРОЛЦОХ ХУРААМЖ</div>
              <div className="mono mt-1 text-xl font-black text-white">{t.entryFee > 0 ? `${t.entryFee.toLocaleString()}₮` : "ҮНЭГҮЙ"}</div>
            </div>
            <div className="px-6 py-5">
              <div className="text-[9px] font-medium uppercase tracking-[0.2em] text-yellow-400/60">ШАГНАЛЫН САН</div>
              <div className="mono mt-1 text-xl font-black text-yellow-400">{t.prizePool > 0 ? `${t.prizePool.toLocaleString()}₮` : "—"}</div>
            </div>
          </div>
        )}

        {/* ── Description / Rules / Prize desc ── */}
        {[
          { label: "ТАЙЛБАР", content: t.description },
          { label: "ШАГНАЛ", content: t.prizeDescription },
          { label: "ДҮРЭМ", content: t.rules },
        ].filter((s) => s.content).map((s, i) => (
          <div key={s.label} className={`${glass} mb-4 p-6 animate-[fadeUp_0.5s_ease_forwards] opacity-0`} style={{ animationDelay: `${180 + i * 60}ms` }}>
            <div className="mb-3 text-[9px] font-medium uppercase tracking-[0.25em] text-white/55">{s.label}</div>
            <p className="text-sm leading-relaxed text-white/70 whitespace-pre-wrap">{s.content}</p>
          </div>
        ))}

        {/* ── Registration ── */}
        {canRegister && (
          <div className={`${glassStrong} mb-4 p-6 animate-[fadeUp_0.5s_ease_forwards] opacity-0`} style={{ animationDelay: "300ms" }}>
            <h3 className="mb-5 font-black text-white" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(16px, 2.5vw, 22px)", letterSpacing: "-0.02em" }}>
              БҮРТГҮҮЛЭХ
            </h3>

            {error && <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/[0.08] px-4 py-3 text-[11px] text-red-400">{error}</div>}
            {success && <div className="mb-4 rounded-xl border border-green-500/20 bg-green-500/[0.08] px-4 py-3 text-[11px] text-green-400">{success}</div>}

            <div className="space-y-3">
              <input
                type="text"
                placeholder={t.teamSize === 1 ? "Нэр / IGN" : "Багийн нэр"}
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="w-full rounded-xl border border-white/[0.10] bg-white/[0.05] px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-white/30 focus:bg-white/[0.08] transition-all"
                maxLength={64}
              />
              <textarea
                placeholder={t.teamSize === 1 ? "Player name / IGN" : `Player names (${t.teamSize} lines)`}
                value={playerNamesText}
                onChange={(e) => setPlayerNamesText(e.target.value)}
                rows={Math.min(Math.max(t.teamSize, 2), 5)}
                className="w-full rounded-xl border border-white/[0.10] bg-white/[0.05] px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-white/30 focus:bg-white/[0.08] transition-all resize-none"
                maxLength={400}
              />

              {t.entryFee > 0 && (
                <div className="flex gap-2">
                  {(["QPAY", "BALANCE"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPayMethod(m)}
                      className={`flex-1 rounded-xl py-2.5 text-[10px] font-semibold uppercase tracking-[0.15em] transition-all ${
                        payMethod === m ? "bg-white text-black" : "border border-white/[0.14] bg-white/[0.07] text-white/70 hover:bg-white/[0.12] hover:text-white"
                      }`}
                    >
                      {m === "BALANCE" ? "ҮЛДЭГДЭЛ" : m}
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={handleRegister}
                disabled={submitting}
                className="glass-action glass-action-primary w-full py-3.5 text-[11px] uppercase tracking-[0.2em] disabled:opacity-45"
              >
                {submitting ? "..." : t.entryFee > 0 ? `БҮРТГҮҮЛЭХ · ${t.entryFee.toLocaleString()}₮` : "БҮРТГҮҮЛЭХ"}
              </button>
            </div>

            {qpayPending && (
              <div className={`${glass} mt-4 p-5`}>
                <div className="mb-3 text-[9px] font-medium uppercase tracking-[0.25em] text-white/55">QPAY ТӨЛБӨР</div>
                {(qpayPending.qrImage || qpayPending.shortUrl) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qpayPending.qrImage || qpayPending.shortUrl} alt="QPay QR" className="mx-auto mb-4 h-44 w-44 rounded-xl bg-white p-2" />
                )}
                {qpayPending.deeplinks && qpayPending.deeplinks.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {qpayPending.deeplinks.map((dl) => (
                      <a key={dl.name} href={dl.link} className="glass-action min-h-0 rounded-lg px-3 py-1.5 text-[10px]">
                        {dl.name}
                      </a>
                    ))}
                  </div>
                )}
                <p className="mt-3 text-[10px] text-white/50">Төлбөр төлсний дараа хуудсаа шинэчилнэ үү.</p>
              </div>
            )}
          </div>
        )}

        {/* ── Already registered ── */}
        {myTeam && t.status === "UPCOMING" && (
          <div className={`${glass} mb-4 flex items-center justify-between p-5 animate-[fadeUp_0.5s_ease_forwards] opacity-0`} style={{ animationDelay: "300ms" }}>
            <div>
              <div className="text-[9px] font-medium uppercase tracking-[0.2em] text-white/55">Бүртгэгдсэн</div>
              <div className="mt-0.5 font-semibold text-white">{myTeam.name}</div>
            </div>
            <button
              onClick={handleUnregister}
              disabled={submitting}
              className="glass-action min-h-0 rounded-lg border-red-400/30 bg-red-500/[0.10] px-4 py-2 text-[9px] uppercase tracking-[0.15em] text-red-300 hover:bg-red-500/[0.18] disabled:opacity-45"
            >
              {submitting ? "..." : "ЦУЦЛАХ"}
            </button>
          </div>
        )}

        {!user && t.status === "UPCOMING" && !isFull && (
          <div className={`${glass} mb-4 p-5 text-center animate-[fadeUp_0.5s_ease_forwards] opacity-0`} style={{ animationDelay: "300ms" }}>
            <p className="text-sm text-white/40">
              Бүртгүүлэхийн тулд{" "}
              <Link href="/login" className="text-white underline underline-offset-2 hover:text-white/70">нэвтрэх</Link>{" "}
              шаардлагатай.
            </p>
          </div>
        )}

        {isFull && t.status === "UPCOMING" && !myTeam && (
          <div className={`${glass} mb-4 p-5 text-center animate-[fadeUp_0.5s_ease_forwards] opacity-0`} style={{ animationDelay: "300ms" }}>
            <p className="text-sm text-white/40">Бүртгэл дүүрсэн байна.</p>
          </div>
        )}

        {/* ── Teams ── */}
        <div className={`${glass} mb-4 overflow-hidden animate-[fadeUp_0.5s_ease_forwards] opacity-0`} style={{ animationDelay: "360ms" }}>
          <div className="flex items-center justify-between px-6 py-5">
            <h3 className="font-black text-white" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(14px, 2vw, 18px)", letterSpacing: "-0.02em" }}>
              {t.teamSize === 1 ? "ТОГЛОГЧИД" : "БҮРТГЭГДСЭН БАГУУД"}
            </h3>
            <span className="mono text-[10px] text-white/55">{t._count.teams}/{t.maxTeams}</span>
          </div>

          {t.teams.length === 0 ? (
            <div className="px-6 pb-6 text-sm text-white/45">Одоогоор бүртгэл байхгүй.</div>
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {t.teams.map((team, i) => (
                <div key={team.id} className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-white/[0.02]">
                  <span className="mono w-5 shrink-0 text-[10px] text-white/42">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-white/90">{team.name}</div>
                    {(t.teamSize > 1 || team.playerNames.length > 0) && (
                      <div className="mt-0.5 truncate text-[10px] text-white/52">
                        {team.playerNames.length > 0 ? team.playerNames.join(", ") : team.members.map((m) => m.user.name).join(", ")}
                      </div>
                    )}
                  </div>
                  {team.members.some((m) => m.user.id === user?.id) && (
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[8px] font-medium uppercase tracking-widest text-white/50">ТА</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {slotsLeft > 0 && t.status === "UPCOMING" && (
            <div className="border-t border-white/[0.05] px-6 py-3">
              <span className="text-[10px] text-white/48">{slotsLeft} slot үлдсэн</span>
            </div>
          )}
        </div>

        {/* ── Bracket ── */}
        {t.matches.length > 0 && (
          <div className={`${glass} overflow-hidden animate-[fadeUp_0.5s_ease_forwards] opacity-0`} style={{ animationDelay: "420ms" }}>
            <div className="flex items-center justify-between px-6 py-5">
              <h3 className="font-black text-white" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(14px, 2vw, 18px)", letterSpacing: "-0.02em" }}>
                BRACKET
              </h3>
              <span className="mono text-[10px] text-white/48">{t.matches.length} matches</span>
            </div>
            <div className="flex gap-3 overflow-x-auto px-6 pb-6">
              {bracketRounds.map((round) => (
                <div key={round} className="min-w-[220px] flex-1">
                  <div className="mb-3 text-[9px] font-medium uppercase tracking-[0.25em] text-white/48">
                    {round === bracketRounds.length ? "Final" : `Round ${round}`}
                  </div>
                  <div className="space-y-2">
                    {t.matches.filter((m) => m.round === round).map((match) => (
                      <div key={match.id} className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="mono text-[9px] text-white/48">Match {match.matchNumber}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[8px] font-medium uppercase tracking-widest ${
                            match.status === "LIVE" ? "animate-pulse bg-green-500/20 text-green-400" :
                            match.status === "COMPLETED" ? "bg-white/10 text-white/50" :
                            "bg-white/[0.06] text-white/25"
                          }`}>
                            {match.status}
                          </span>
                        </div>
                        {[match.teamA, match.teamB].map((team, idx) => {
                          const isWinner = !!team && match.winnerTeam?.id === team.id;
                          const score = idx === 0 ? match.scoreA : match.scoreB;
                          return (
                            <div key={team?.id ?? idx} className={`mb-1 flex items-center justify-between rounded-lg px-3 py-2 ${
                              isWinner ? "bg-white text-black" : "bg-white/[0.04] text-white/60"
                            }`}>
                              <div className="flex min-w-0 items-center gap-2">
                                <span className={`text-[9px] font-medium ${isWinner ? "text-black/50" : "text-white/25"}`}>
                                  {idx === 0 ? "A" : "B"}
                                </span>
                                <span className="truncate text-[11px] font-semibold">{team?.name ?? "TBD"}</span>
                              </div>
                              <span className="mono ml-2 shrink-0 text-[11px]">{score ?? "–"}</span>
                            </div>
                          );
                        })}
                        {match.winnerTeam && (
                          <div className="mt-2 text-[9px] text-white/30">
                            Winner: <span className="text-white/70">{match.winnerTeam.name}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
