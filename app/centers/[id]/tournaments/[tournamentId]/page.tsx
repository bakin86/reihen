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

const glass      = "rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl";
const glassStrong = "rounded-2xl border border-white/[0.11] bg-white/[0.07] backdrop-blur-2xl";

/** Staggered fadeUp shorthand */
const fu = (delay: number) =>
  ({ style: { animationDelay: `${delay}ms` }, className: "animate-[fadeUp_0.55s_cubic-bezier(0.22,1,0.36,1)_forwards] opacity-0" } as const);

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

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-7 w-7 animate-spin rounded-full border border-white/[0.08] border-t-white/40" />
          <p className="text-[9px] uppercase tracking-[0.35em] text-white/20">Loading</p>
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
  const fillPct = Math.min(100, Math.round((t._count.teams / t.maxTeams) * 100));
  const isLive = t.status === "LIVE";

  return (
    <main className="soft-glass-page text-white">

      {/* Ambient blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 top-20 h-[450px] w-[450px] rounded-full bg-white/[0.018] blur-[130px]" />
        <div className="absolute -right-32 top-1/2 h-[380px] w-[380px] rounded-full bg-white/[0.013] blur-[110px]" />
        {isLive && (
          <div className="absolute left-1/2 top-0 h-[300px] w-[600px] -translate-x-1/2 rounded-full bg-green-500/[0.03] blur-[120px]" />
        )}
      </div>

      <div className="relative mx-auto max-w-3xl px-4 pb-28 pt-24 md:pt-28">

        {/* ── Back ── */}
        <div {...fu(0)}>
          <Link
            href={`/centers/${params.id}`}
            className="mb-7 inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-white/45 transition-colors hover:text-white/90"
          >
            ← {t.center.name}
          </Link>
        </div>

        {/* ── Hero card ── */}
        <div {...fu(60)} className={`${fu(60).className} mb-4`}>
          <div className={`${glassStrong} overflow-hidden`}>
            <div className="p-6 md:p-8">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2.5">
                    <span className="mono rounded-full border border-white/[0.10] bg-white/[0.06] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-white/70">
                      {t.game}
                    </span>
                    <span className="text-[10px] text-white/30">{t.center.name}</span>
                  </div>
                  <h1
                    className="font-black leading-[1.05] text-white"
                    style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px,4.5vw,42px)", letterSpacing: "-0.03em" }}
                  >
                    {t.name}
                  </h1>
                </div>

                {/* Status badge */}
                <div className={`shrink-0 rounded-full px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest ${
                  isLive
                    ? "animate-pulse bg-green-500/20 text-green-400 shadow-[0_0_16px_rgba(34,197,94,0.2)]"
                    : t.status === "CANCELLED"
                    ? "bg-red-500/15 text-red-400"
                    : t.status === "COMPLETED"
                    ? "bg-white/[0.07] text-white/35"
                    : "bg-white/[0.09] text-white/65"
                }`}>
                  {isLive && <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-green-400" />}
                  {STATUS_LABELS[t.status] ?? t.status}
                </div>
              </div>
            </div>

            {/* Stats strip */}
            <div className="grid grid-cols-2 divide-x divide-white/[0.06] border-t border-white/[0.06] sm:grid-cols-4">
              {[
                { label: "ОГНОО", value: start.toLocaleDateString("mn-MN", { month: "short", day: "numeric" }) },
                {
                  label: "ЦАГ",
                  value: `${start.toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" })}${end ? `–${end.toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" })}` : ""}`,
                },
                { label: t.teamSize === 1 ? "ТОГЛОГЧ" : "БАГ", value: `${t._count.teams}/${t.maxTeams}` },
                { label: "ФОРМАТ", value: t.teamSize === 1 ? "Solo" : `${t.teamSize}v${t.teamSize}` },
              ].map(({ label, value }) => (
                <div key={label} className="px-5 py-4">
                  <div className="text-[8px] font-semibold uppercase tracking-[0.22em] text-white/45">{label}</div>
                  <div className="mono mt-1 font-black text-white" style={{ fontSize: "clamp(14px,2vw,18px)" }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Slot progress bar */}
            <div className="border-t border-white/[0.06] px-6 py-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[8px] font-medium uppercase tracking-[0.2em] text-white/40">
                  {isFull ? "БҮРТГЭЛ ДҮҮРСЭН" : `${slotsLeft} slot үлдсэн`}
                </span>
                <span className="mono text-[8px] text-white/35">{fillPct}%</span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.07]">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${isFull ? "bg-red-400" : isLive ? "bg-green-400" : "bg-white/40"}`}
                  style={{ width: `${fillPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Prize + Fee ── */}
        {(t.entryFee > 0 || t.prizePool > 0) && (
          <div {...fu(120)} className={`${fu(120).className} mb-4`}>
            <div className={`${glass} grid grid-cols-2 divide-x divide-white/[0.06]`}>
              <div className="px-6 py-5">
                <div className="text-[8px] font-semibold uppercase tracking-[0.22em] text-white/45">ОРОЛЦОХ ХУРААМЖ</div>
                <div className="mono mt-1.5 font-black text-white" style={{ fontSize: "clamp(18px,2.5vw,24px)" }}>
                  {t.entryFee > 0 ? `${t.entryFee.toLocaleString()}₮` : "ҮНЭГҮЙ"}
                </div>
              </div>
              <div className="px-6 py-5">
                <div className="text-[8px] font-semibold uppercase tracking-[0.22em] text-yellow-400/55">ШАГНАЛЫН САН</div>
                <div className="mono mt-1.5 font-black text-yellow-400" style={{ fontSize: "clamp(18px,2.5vw,24px)" }}>
                  {t.prizePool > 0 ? `${t.prizePool.toLocaleString()}₮` : "—"}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Description / Rules / Prize ── */}
        {[
          { label: "ТАЙЛБАР", content: t.description },
          { label: "ШАГНАЛ", content: t.prizeDescription },
          { label: "ДҮРЭМ", content: t.rules },
        ].filter((s) => s.content).map((s, i) => (
          <div key={s.label} {...fu(180 + i * 55)} className={`${fu(180 + i * 55).className} mb-4`}>
            <div className={`${glass} p-6`}>
              <div className="mb-3 text-[8px] font-semibold uppercase tracking-[0.25em] text-white/45">{s.label}</div>
              <p className="text-sm leading-relaxed text-white/65 whitespace-pre-wrap">{s.content}</p>
            </div>
          </div>
        ))}

        {/* ── Registration form ── */}
        {canRegister && (
          <div {...fu(300)} className={`${fu(300).className} mb-4`}>
            <div className={`${glassStrong} p-6`}>
              <h3
                className="mb-5 font-black text-white"
                style={{ fontFamily: "var(--font-display)", fontSize: "clamp(16px,2.5vw,22px)", letterSpacing: "-0.02em" }}
              >
                БҮРТГҮҮЛЭХ
              </h3>

              {error && (
                <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/[0.07] px-4 py-3 text-[11px] text-red-400 animate-[fadeDown_0.3s_ease_forwards]">
                  {error}
                </div>
              )}
              {success && (
                <div className="mb-4 rounded-xl border border-green-500/20 bg-green-500/[0.07] px-4 py-3 text-[11px] text-green-400 animate-[fadeDown_0.3s_ease_forwards]">
                  {success}
                </div>
              )}

              <div className="space-y-3">
                <input
                  type="text"
                  placeholder={t.teamSize === 1 ? "Нэр / IGN" : "Багийн нэр"}
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="w-full rounded-xl border border-white/10 !bg-[#1a1a1a] px-4 py-3 text-sm !text-white placeholder:text-white/30 outline-none transition-all duration-200 focus:border-white/25"
                  maxLength={64}
                />
                <textarea
                  placeholder={t.teamSize === 1 ? "Player name / IGN" : `Player names (${t.teamSize} lines)`}
                  value={playerNamesText}
                  onChange={(e) => setPlayerNamesText(e.target.value)}
                  rows={Math.min(Math.max(t.teamSize, 2), 5)}
                  className="w-full resize-none rounded-xl border border-white/10 !bg-[#1a1a1a] px-4 py-3 text-sm !text-white placeholder:text-white/30 outline-none transition-all duration-200 focus:border-white/25"
                  maxLength={400}
                />

                {t.entryFee > 0 && (
                  <div className="flex gap-2">
                    {(["QPAY", "BALANCE"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPayMethod(m)}
                        className={`flex-1 rounded-xl py-2.5 text-[10px] font-semibold uppercase tracking-[0.15em] transition-all duration-200 ${
                          payMethod === m
                            ? "bg-white text-black shadow-[0_0_16px_rgba(255,255,255,0.1)]"
                            : "border border-white/[0.10] bg-white/[0.05] text-white/60 hover:bg-white/[0.09] hover:text-white"
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
                  className="glass-action glass-action-primary w-full py-3.5 text-[11px] text-black uppercase tracking-[0.2em] transition-opacity disabled:opacity-40"
                >
                  {submitting ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border border-white/20 border-t-white/70" />
                      Боловсруулж байна…
                    </span>
                  ) : t.entryFee > 0 ? `БҮРТГҮҮЛЭХ · ${t.entryFee.toLocaleString()}₮` : "БҮРТГҮҮЛЭХ"}
                </button>
              </div>

              {qpayPending && (
                <div className={`${glass} mt-4 p-5 animate-[scaleIn_0.35s_cubic-bezier(0.22,1,0.36,1)_forwards]`}>
                  <div className="mb-3 text-[9px] font-semibold uppercase tracking-[0.25em] text-white/50">QPAY ТӨЛБӨР</div>
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
                  <p className="mt-3 text-[10px] text-white/45">Төлбөр төлсний дараа хуудсаа шинэчилнэ үү.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Already registered */}
        {myTeam && t.status === "UPCOMING" && (
          <div {...fu(300)} className={`${fu(300).className} mb-4`}>
            <div className={`${glass} flex items-center justify-between p-5`}>
              <div>
                <div className="text-[8px] font-semibold uppercase tracking-[0.22em] text-green-400/60">Бүртгэгдсэн</div>
                <div className="mt-0.5 font-semibold text-white">{myTeam.name}</div>
              </div>
              <button
                onClick={handleUnregister}
                disabled={submitting}
                className="glass-action min-h-0 rounded-lg border-red-400/25 bg-red-500/[0.08] px-4 py-2 text-[9px] uppercase tracking-[0.15em] text-red-300/80 transition-colors hover:bg-red-500/[0.15] hover:text-red-300 disabled:opacity-40"
              >
                {submitting ? "···" : "ЦУЦЛАХ"}
              </button>
            </div>
          </div>
        )}

        {!user && t.status === "UPCOMING" && !isFull && (
          <div {...fu(300)} className={`${fu(300).className} mb-4`}>
            <div className={`${glass} p-5 text-center`}>
              <p className="text-sm text-white/40">
                Бүртгүүлэхийн тулд{" "}
                <Link href="/login" className="text-white underline underline-offset-2 transition-opacity hover:opacity-60">нэвтрэх</Link>{" "}
                шаардлагатай.
              </p>
            </div>
          </div>
        )}

        {isFull && t.status === "UPCOMING" && !myTeam && (
          <div {...fu(300)} className={`${fu(300).className} mb-4`}>
            <div className={`${glass} p-5 text-center`}>
              <p className="text-sm text-white/40">Бүртгэл дүүрсэн байна.</p>
            </div>
          </div>
        )}

        {/* ── Teams ── */}
        <div {...fu(360)} className={`${fu(360).className} mb-4`}>
          <div className={`${glass} overflow-hidden`}>
            <div className="flex items-center justify-between px-6 py-5">
              <h3
                className="font-black text-white"
                style={{ fontFamily: "var(--font-display)", fontSize: "clamp(14px,2vw,18px)", letterSpacing: "-0.02em" }}
              >
                {t.teamSize === 1 ? "ТОГЛОГЧИД" : "БҮРТГЭГДСЭН БАГУУД"}
              </h3>
              <span className="mono text-[10px] text-white/45">{t._count.teams}/{t.maxTeams}</span>
            </div>

            {t.teams.length === 0 ? (
              <div className="px-6 pb-6 text-sm text-white/35">Одоогоор бүртгэл байхгүй.</div>
            ) : (
              <div className="divide-y divide-white/[0.05]">
                {t.teams.map((team, i) => {
                  const isMe = team.members.some((m) => m.user.id === user?.id);
                  return (
                    <div
                      key={team.id}
                      className={`group flex items-center gap-4 px-6 py-3.5 transition-colors duration-150 ${
                        isMe ? "bg-white/[0.03]" : "hover:bg-white/[0.02]"
                      }`}
                      style={{ animation: `fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) ${i * 40 + 400}ms both` }}
                    >
                      <span className="mono w-5 shrink-0 text-[10px] text-white/30">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className={`text-[13px] font-semibold transition-colors ${isMe ? "text-white" : "text-white/80 group-hover:text-white/95"}`}>
                          {team.name}
                        </div>
                        {(t.teamSize > 1 || team.playerNames.length > 0) && (
                          <div className="mt-0.5 truncate text-[10px] text-white/45">
                            {team.playerNames.length > 0 ? team.playerNames.join(", ") : team.members.map((m) => m.user.name).join(", ")}
                          </div>
                        )}
                      </div>
                      {isMe && (
                        <span className="rounded-full border border-white/[0.12] bg-white/[0.07] px-2.5 py-0.5 text-[8px] font-semibold uppercase tracking-widest text-white/60">
                          ТА
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {slotsLeft > 0 && t.status === "UPCOMING" && (
              <div className="border-t border-white/[0.05] px-6 py-3">
                <span className="text-[9px] text-white/40">{slotsLeft} slot үлдсэн</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Bracket ── */}
        {t.matches.length > 0 && (
          <div {...fu(420)} className={fu(420).className}>
            <div className={`${glass} overflow-hidden`}>
              <div className="flex items-center justify-between px-6 py-5">
                <h3
                  className="font-black text-white"
                  style={{ fontFamily: "var(--font-display)", fontSize: "clamp(14px,2vw,18px)", letterSpacing: "-0.02em" }}
                >
                  BRACKET
                </h3>
                <span className="mono text-[10px] text-white/40">{t.matches.length} match</span>
              </div>

              <div className="flex gap-3 overflow-x-auto px-6 pb-6">
                {bracketRounds.map((round) => (
                  <div key={round} className="min-w-[200px] flex-1">
                    <div className="mb-3 text-[9px] font-semibold uppercase tracking-[0.28em] text-white/40">
                      {round === bracketRounds.length ? "FINAL" : `ROUND ${round}`}
                    </div>
                    <div className="space-y-2.5">
                      {t.matches.filter((m) => m.round === round).map((match, mi) => (
                        <div
                          key={match.id}
                          className="group rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 transition-all duration-200 hover:border-white/[0.14] hover:bg-white/[0.06]"
                          style={{ animation: `fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) ${mi * 60 + 450}ms both` }}
                        >
                          <div className="mb-2.5 flex items-center justify-between">
                            <span className="mono text-[8px] text-white/35">M{match.matchNumber}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[7px] font-semibold uppercase tracking-widest ${
                              match.status === "LIVE"
                                ? "animate-pulse bg-green-500/20 text-green-400"
                                : match.status === "COMPLETED"
                                ? "bg-white/[0.08] text-white/40"
                                : "bg-white/[0.04] text-white/20"
                            }`}>
                              {match.status}
                            </span>
                          </div>

                          {[match.teamA, match.teamB].map((team, idx) => {
                            const isWinner = !!team && match.winnerTeam?.id === team.id;
                            const score = idx === 0 ? match.scoreA : match.scoreB;
                            return (
                              <div
                                key={team?.id ?? idx}
                                className={`mb-1 flex items-center justify-between rounded-lg px-3 py-2 transition-all duration-200 ${
                                  isWinner
                                    ? "bg-white text-black shadow-[0_0_12px_rgba(255,255,255,0.12)]"
                                    : "bg-white/[0.04] text-white/55 group-hover:bg-white/[0.07]"
                                }`}
                              >
                                <div className="flex min-w-0 items-center gap-2">
                                  <span className={`shrink-0 text-[8px] font-bold ${isWinner ? "text-black/40" : "text-white/20"}`}>
                                    {idx === 0 ? "A" : "B"}
                                  </span>
                                  <span className="truncate text-[11px] font-semibold">{team?.name ?? "TBD"}</span>
                                </div>
                                <span className={`mono ml-2 shrink-0 text-[11px] font-black ${isWinner ? "text-black" : "text-white/40"}`}>
                                  {score ?? "–"}
                                </span>
                              </div>
                            );
                          })}

                          {match.winnerTeam && (
                            <div className="mt-2 text-[8px] text-white/30">
                              Winner: <span className="font-semibold text-white/60">{match.winnerTeam.name}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
