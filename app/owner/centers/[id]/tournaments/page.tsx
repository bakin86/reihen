"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { apiFetch } from "@/lib/api";

interface Tournament {
  id: string;
  name: string;
  game: string;
  description: string | null;
  startTime: string;
  endTime: string | null;
  maxTeams: number;
  teamSize: number;
  entryFee: number;
  prizePool: number;
  prizeDescription: string | null;
  rules: string | null;
  status: string;
  _count: { teams: number };
  teams?: {
    id: string;
    name: string;
    playerNames: string[];
    captain: { id: string; name: string; phone: string };
    members: { user: { id: string; name: string } }[];
    paymentStatus: string;
  }[];
  matches?: TournamentMatch[];
}

interface TournamentMatch {
  id: string;
  round: number;
  matchNumber: number;
  teamAId: string | null;
  teamBId: string | null;
  scoreA: number | null;
  scoreB: number | null;
  status: string;
  scheduledAt: string | null;
  teamA: { id: string; name: string; playerNames: string[] } | null;
  teamB: { id: string; name: string; playerNames: string[] } | null;
  winnerTeam: { id: string; name: string } | null;
  stationSeat: { id: string; number: string } | null;
}

const STATUS_LABEL: Record<string, string> = {
  UPCOMING: "УДАХГҮЙ",
  REGISTRATION_CLOSED: "БҮРТГЭЛ ХААСАН",
  LIVE: "ЯВАГДАЖ БУЙ",
  COMPLETED: "ДУУССАН",
  CANCELLED: "ЦУЦЛАГДСАН",
};

const STATUS_STYLE: Record<string, string> = {
  UPCOMING: "bg-white text-black border border-black",
  REGISTRATION_CLOSED: "bg-[#888] text-white",
  LIVE: "bg-black text-white animate-pulse",
  COMPLETED: "bg-white text-[#888] border border-[#ddd]",
  CANCELLED: "bg-white text-[#888] line-through border border-[#ddd]",
};

const GAMES = ["CS2", "Valorant", "Dota 2", "League of Legends", "PUBG", "Overwatch 2", "Fortnite", "Other"];

export default function OwnerTournamentsPage({ params }: { params: { id: string } }) {
  const { token, loading: authLoading } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ text: string; err?: boolean } | null>(null);

  // Create form
  const [name, setName] = useState("");
  const [game, setGame] = useState("CS2");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startHour, setStartHour] = useState("14:00");
  const [endDate, setEndDate] = useState("");
  const [maxTeams, setMaxTeams] = useState(16);
  const [teamSize, setTeamSize] = useState(5);
  const [entryFee, setEntryFee] = useState(0);
  const [prizePool, setPrizePool] = useState(0);
  const [rules, setRules] = useState("");

  const showToast = (text: string, err = false) => {
    setToast({ text, err });
    setTimeout(() => setToast(null), 2500);
  };

  const fetchTournaments = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiFetch<{ tournaments: Tournament[] }>(
        `/api/owner/centers/${params.id}/tournaments`,
        { token }
      );
      setTournaments(res.tournaments);
    } catch {
      showToast("Failed to load tournaments", true);
    } finally {
      setLoading(false);
    }
  }, [token, params.id]);

  useEffect(() => {
    if (!authLoading && token) fetchTournaments();
  }, [authLoading, token, fetchTournaments]);

  const createTournament = async () => {
    if (!name.trim() || !startDate) return;
    setSaving(true);
    try {
      const startTime = new Date(`${startDate}T${startHour}`).toISOString();
      const endTime = endDate ? new Date(`${endDate}T23:00`).toISOString() : undefined;
      await apiFetch(`/api/owner/centers/${params.id}/tournaments`, {
        token,
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          game,
          description: description.trim() || undefined,
          startTime,
          endTime,
          maxTeams,
          teamSize,
          entryFee,
          prizePool,
          rules: rules.trim() || undefined,
        }),
      });
      showToast("Tournament created!");
      setShowCreate(false);
      setName(""); setDescription(""); setRules("");
      fetchTournaments();
    } catch (e: any) {
      showToast(e?.message ?? "Failed to create", true);
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (tournamentId: string, status: string) => {
    setSaving(true);
    try {
      await apiFetch(`/api/owner/centers/${params.id}/tournaments/${tournamentId}`, {
        token,
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      showToast(`Status → ${STATUS_LABEL[status] ?? status}`);
      fetchTournaments();
    } catch (e: any) {
      showToast(e?.message ?? "Failed to update", true);
    } finally {
      setSaving(false);
    }
  };

  const deleteTournament = async (tournamentId: string) => {
    setSaving(true);
    try {
      await apiFetch(`/api/owner/centers/${params.id}/tournaments/${tournamentId}`, {
        token,
        method: "DELETE",
      });
      showToast("Tournament cancelled");
      setSelectedId(null);
      fetchTournaments();
    } catch (e: any) {
      showToast(e?.message ?? "Failed to cancel", true);
    } finally {
      setSaving(false);
    }
  };

  const fetchDetail = async (id: string) => {
    if (!token) return;
    try {
      const res = await apiFetch<{ tournament: Tournament }>(
        `/api/owner/centers/${params.id}/tournaments/${id}`,
        { token }
      );
      setTournaments((prev) =>
        prev.map((t) => (t.id === id ? res.tournament : t))
      );
      setSelectedId(id);
    } catch {
      showToast("Failed to load detail", true);
    }
  };

  const generateBracket = async (tournamentId: string) => {
    const current = tournaments.find((t) => t.id === tournamentId);
    if (current?.matches?.length && !confirm("Existing bracket will be replaced. Continue?")) return;
    setSaving(true);
    try {
      const res = await apiFetch<{ matches: TournamentMatch[] }>(
        `/api/owner/centers/${params.id}/tournaments/${tournamentId}/bracket`,
        { token, method: "POST" }
      );
      setTournaments((prev) =>
        prev.map((t) => (t.id === tournamentId ? { ...t, matches: res.matches } : t))
      );
      showToast("Bracket generated");
    } catch (e: any) {
      showToast(e?.message ?? "Failed to generate bracket", true);
    } finally {
      setSaving(false);
    }
  };

  const updateMatch = async (
    tournamentId: string,
    matchId: string,
    data: Partial<{
      teamAId: string | null;
      teamBId: string | null;
      scoreA: number | null;
      scoreB: number | null;
      winnerTeamId: string | null;
      scheduledAt: string | null;
      stationSeatId: string | null;
      status: string;
    }>
  ) => {
    setSaving(true);
    try {
      const res = await apiFetch<{ matches: TournamentMatch[] }>(
        `/api/owner/centers/${params.id}/tournaments/${tournamentId}/bracket`,
        {
          token,
          method: "PATCH",
          body: JSON.stringify({ matchId, ...data }),
        }
      );
      setTournaments((prev) =>
        prev.map((t) => (t.id === tournamentId ? { ...t, matches: res.matches } : t))
      );
    } catch (e: any) {
      showToast(e?.message ?? "Failed to update match", true);
    } finally {
      setSaving(false);
    }
  };

  const selected = tournaments.find((t) => t.id === selectedId);
  const paidTeams = selected?.teams?.filter((team) => team.paymentStatus === "PAID") ?? [];

  if (authLoading || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-5 w-5 animate-spin border-2 border-black border-t-transparent" />
      </main>
    );
  }

  return (
    <main className="soft-glass-page-light min-h-screen text-black">
      {/* Toast */}
      {toast && (
        <div className={`fixed left-1/2 top-4 z-50 -translate-x-1/2 border px-6 py-3 text-xs uppercase tracking-widest ${toast.err ? "border-red-500 bg-red-50 text-red-600" : "border-black bg-black text-white"}`}>
          {toast.text}
        </div>
      )}

      {/* Header */}
      <div className="owner-topbar px-5 py-5 md:px-12">
        <Link href={`/owner/centers/${params.id}`} className="text-[10px] uppercase tracking-[0.3em] text-gray hover:text-black">
          ← CENTER
        </Link>
        <h1 className="display mt-2 text-4xl md:text-6xl">TOURNAMENTS</h1>
      </div>

      {/* Action bar */}
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-5 md:px-12">
        <span className="text-[10px] uppercase tracking-[0.3em] text-gray">
          {tournaments.length} ТЭМЦЭЭН
        </span>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="soft-action-light soft-action-light-primary px-4 py-2 text-xs uppercase tracking-widest"
        >
          {showCreate ? "ХААХ" : "+ ТЭМЦЭЭН НЭМЭХ"}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="mx-auto max-w-6xl px-5 pb-6 md:px-12">
        <div className="soft-glass-panel-light space-y-4 rounded-2xl p-6 md:p-8">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-[10px] uppercase tracking-[0.3em] text-gray">НЭР *</label>
              <input value={name} onChange={(e) => setName(e.target.value)}
                className="owner-field-light mt-1 w-full px-3 py-2 text-sm outline-none" placeholder="CS2 5v5 Tournament" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.3em] text-gray">ТОГЛООМ *</label>
              <select value={game} onChange={(e) => setGame(e.target.value)}
                className="owner-field-light mt-1 w-full px-3 py-2 text-sm outline-none">
                {GAMES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.3em] text-gray">ЭХЛЭХ ОГНОО *</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="owner-field-light mt-1 w-full px-3 py-2 text-sm outline-none" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.3em] text-gray">ЭХЛЭХ ЦАГ *</label>
              <input type="time" value={startHour} onChange={(e) => setStartHour(e.target.value)}
                className="owner-field-light mt-1 w-full px-3 py-2 text-sm outline-none" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.3em] text-gray">ДУУСАХ ОГНОО</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="owner-field-light mt-1 w-full px-3 py-2 text-sm outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] uppercase tracking-[0.3em] text-gray">MAX TEAMS</label>
                <input type="number" min={2} max={256} value={maxTeams} onChange={(e) => setMaxTeams(+e.target.value)}
                  className="owner-field-light mt-1 w-full px-3 py-2 text-sm outline-none" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-[0.3em] text-gray">TEAM SIZE</label>
                <input type="number" min={1} max={10} value={teamSize} onChange={(e) => setTeamSize(+e.target.value)}
                  className="owner-field-light mt-1 w-full px-3 py-2 text-sm outline-none" />
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.3em] text-gray">ОРОЛЦОХ ХУРААМЖ (₮)</label>
              <input type="number" min={0} value={entryFee} onChange={(e) => setEntryFee(+e.target.value)}
                className="owner-field-light mt-1 w-full px-3 py-2 text-sm outline-none" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.3em] text-gray">ШАГНАЛЫН САН (₮)</label>
              <input type="number" min={0} value={prizePool} onChange={(e) => setPrizePool(+e.target.value)}
                className="owner-field-light mt-1 w-full px-3 py-2 text-sm outline-none" />
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.3em] text-gray">ТАЙЛБАР</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              rows={3} className="owner-field-light mt-1 w-full px-3 py-2 text-sm outline-none" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.3em] text-gray">ДҮРЭМ</label>
            <textarea value={rules} onChange={(e) => setRules(e.target.value)}
              rows={3} className="owner-field-light mt-1 w-full px-3 py-2 text-sm outline-none" />
          </div>
          <button
            onClick={createTournament}
            disabled={saving || !name.trim() || !startDate}
            className="soft-action-light soft-action-light-primary w-full py-3 text-xs uppercase tracking-widest disabled:opacity-50"
          >
            {saving ? "CREATING..." : "ТЭМЦЭЭН ҮҮСГЭХ"}
          </button>
        </div>
        </div>
      )}

      {/* Tournament list */}
      <div className="mx-auto grid max-w-6xl gap-4 px-5 pb-10 md:px-12">
        {tournaments.map((t) => (
          <div key={t.id} className="soft-glass-panel-light rounded-2xl p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <h3 className="display text-xl truncate">{t.name}</h3>
                  <span className={`inline-block px-2 py-0.5 text-[9px] uppercase tracking-widest ${STATUS_STYLE[t.status]}`}>
                    {STATUS_LABEL[t.status] ?? t.status}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-4 text-xs text-[#888]">
                  <span>{t.game}</span>
                  <span>{new Date(t.startTime).toLocaleDateString("mn-MN")} {new Date(t.startTime).toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" })}</span>
                  <span>{t._count.teams}/{t.maxTeams} баг</span>
                  <span>{t.teamSize === 1 ? "Solo" : `${t.teamSize}v${t.teamSize}`}</span>
                  {t.entryFee > 0 && <span>{t.entryFee.toLocaleString()}₮</span>}
                  {t.prizePool > 0 && <span>Шагнал: {t.prizePool.toLocaleString()}₮</span>}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => selectedId === t.id ? setSelectedId(null) : fetchDetail(t.id)}
                  className="soft-action-light px-3 py-1.5 text-[10px] uppercase tracking-widest"
                >
                  {selectedId === t.id ? "ХААХ" : "ДЭЛГЭРЭНГҮЙ"}
                </button>

                {t.status === "UPCOMING" && (
                  <button onClick={() => updateStatus(t.id, "REGISTRATION_CLOSED")} disabled={saving}
                    className="soft-action-light px-3 py-1.5 text-[10px] uppercase tracking-widest disabled:opacity-50">
                    БҮРТГЭЛ ХААХ
                  </button>
                )}
                {t.status === "REGISTRATION_CLOSED" && (
                  <button onClick={() => updateStatus(t.id, "LIVE")} disabled={saving}
                    className="soft-action-light soft-action-light-primary px-3 py-1.5 text-[10px] uppercase tracking-widest disabled:opacity-50">
                    ЭХЛҮҮЛЭХ
                  </button>
                )}
                {t.status === "LIVE" && (
                  <button onClick={() => updateStatus(t.id, "COMPLETED")} disabled={saving}
                    className="soft-action-light px-3 py-1.5 text-[10px] uppercase tracking-widest disabled:opacity-50">
                    ДУУСГАХ
                  </button>
                )}
                {!["COMPLETED", "CANCELLED"].includes(t.status) && (
                  <button onClick={() => deleteTournament(t.id)} disabled={saving}
                    className="soft-action-light border-red-500/35 bg-red-500/[0.06] px-3 py-1.5 text-[10px] uppercase tracking-widest text-red-600 hover:bg-red-500 hover:text-white disabled:opacity-50">
                    ЦУЦЛАХ
                  </button>
                )}
              </div>
            </div>

            {/* Detail view */}
            {selectedId === t.id && selected?.teams && (
              <div className="mt-6 border-t border-[#ddd] pt-4">
                <h4 className="text-[10px] uppercase tracking-[0.3em] text-gray mb-3">
                  БҮРТГҮҮЛСЭН БАГУУД ({selected.teams.length}/{selected.maxTeams})
                </h4>
                <button
                  onClick={() => generateBracket(selected.id)}
                  disabled={saving || selected.teams.filter((team) => team.paymentStatus === "PAID").length < 2}
                  className="soft-action-light mb-4 px-3 py-1.5 text-[10px] uppercase tracking-widest disabled:opacity-40"
                  title={selected.matches?.length ? "Existing bracket will be replaced" : undefined}
                >
                  {selected.matches?.length ? "REGENERATE BRACKET" : "GENERATE BRACKET"}
                </button>
                <span className="ml-3 text-[10px] uppercase tracking-[0.25em] text-[#888]">
                  {paidTeams.length} PAID TEAMS READY
                </span>
                {selected.teams.length === 0 ? (
                  <p className="text-sm text-[#888]">Одоогоор бүртгэл алга</p>
                ) : (
                  <div className="space-y-2">
                    {selected.teams.map((team, i) => (
                      <div key={team.id} className="flex items-center justify-between border border-[#ddd] px-4 py-3">
                        <div>
                          <span className="text-xs text-[#888] mr-2">#{i + 1}</span>
                          <span className="font-medium text-sm">{team.name}</span>
                          <span className="ml-2 text-xs text-[#888]">
                            ({team.playerNames.length > 0
                              ? team.playerNames.join(", ")
                              : team.members.map((m) => m.user.name).join(", ")})
                          </span>
                        </div>
                        <span className={`text-[9px] uppercase tracking-widest ${team.paymentStatus === "PAID" ? "text-black" : "text-[#888]"}`}>
                          {team.paymentStatus}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {!!selected.matches?.length && (
                  <div className="mt-6">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <h4 className="text-[10px] uppercase tracking-[0.3em] text-gray">
                        BRACKET EDITOR ({selected.matches.length} MATCHES)
                      </h4>
                      <span className="text-[10px] uppercase tracking-[0.25em] text-[#888]">
                        Team slots, scores, status, winner
                      </span>
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-3">
                      {Array.from(new Set(selected.matches.map((match) => match.round))).sort((a, b) => a - b).map((round) => (
                        <div key={round} className="min-w-[340px] flex-1">
                          <div className="mb-2 text-[10px] uppercase tracking-[0.3em] text-[#888]">Round {round}</div>
                          <div className="space-y-3">
                            {selected.matches!
                              .filter((match) => match.round === round)
                              .map((match) => (
                                <div key={match.id} className="rounded-xl border border-black/10 bg-white/70 p-3 shadow-[0_12px_34px_rgba(0,0,0,0.08)] backdrop-blur">
                                  <div className="mb-3 flex items-center justify-between gap-3 text-[10px] text-[#888]">
                                    <span>Match {match.matchNumber}</span>
                                    <select
                                      value={match.status}
                                      onChange={(e) => updateMatch(selected.id, match.id, { status: e.target.value })}
                                      disabled={saving}
                                      className="border border-black/20 bg-white px-2 py-1 text-[10px] uppercase tracking-widest text-black"
                                    >
                                      <option value="PENDING">PENDING</option>
                                      <option value="LIVE">LIVE</option>
                                      <option value="COMPLETED">COMPLETED</option>
                                    </select>
                                  </div>
                                  {[match.teamA, match.teamB].map((team, index) => {
                                    const isWinner = !!team && match.winnerTeam?.id === team.id;
                                    const score = index === 0 ? match.scoreA : match.scoreB;
                                    const slotKey = index === 0 ? "teamAId" : "teamBId";
                                    const scoreKey = index === 0 ? "scoreA" : "scoreB";
                                    const selectedTeamId = index === 0 ? match.teamAId : match.teamBId;
                                    return (
                                      <div key={`${match.id}-${index}`} className={`mb-2 border p-2 ${isWinner ? "border-black bg-black text-white" : "border-[#ddd]"}`}>
                                        <div className="mb-2 flex items-center gap-2">
                                          <span className={`w-5 text-[10px] font-semibold ${isWinner ? "text-white" : "text-[#888]"}`}>
                                            {index === 0 ? "A" : "B"}
                                          </span>
                                          <select
                                            value={selectedTeamId ?? ""}
                                            onChange={(e) =>
                                              updateMatch(selected.id, match.id, {
                                                [slotKey]: e.target.value || null,
                                                winnerTeamId: null,
                                              })
                                            }
                                            disabled={saving}
                                            className="min-w-0 flex-1 border border-[#ddd] bg-white px-2 py-1 text-xs text-black"
                                          >
                                            <option value="">TBD</option>
                                            {paidTeams.map((teamOption) => (
                                              <option key={teamOption.id} value={teamOption.id}>
                                                {teamOption.name}
                                              </option>
                                            ))}
                                          </select>
                                          <input
                                            type="number"
                                            min={0}
                                            value={score ?? ""}
                                            onChange={(e) =>
                                              updateMatch(selected.id, match.id, {
                                                [scoreKey]: e.target.value === "" ? null : Number(e.target.value),
                                              })
                                            }
                                            className="w-16 border border-[#ddd] px-2 py-1 text-sm text-black"
                                            disabled={saving}
                                            aria-label={`${index === 0 ? "Team A" : "Team B"} score`}
                                          />
                                        </div>
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="min-w-0">
                                            <div className="truncate text-sm font-medium">{team?.name ?? "TBD"}</div>
                                            {!!team?.playerNames?.length && (
                                              <div className={`truncate text-[10px] ${isWinner ? "text-white/70" : "text-[#888]"}`}>
                                                {team.playerNames.join(", ")}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                        {team && (
                                          <button
                                            onClick={() => updateMatch(selected.id, match.id, { winnerTeamId: team.id })}
                                            disabled={saving || isWinner}
                                            className="soft-action-light mt-2 w-full px-2 py-1 text-[10px] uppercase tracking-widest disabled:opacity-40"
                                          >
                                            {isWinner ? "WINNER" : "SET WINNER"}
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })}
                                  {match.winnerTeam && (
                                    <button
                                      onClick={() => updateMatch(selected.id, match.id, { winnerTeamId: null })}
                                      disabled={saving}
                                      className="soft-action-light mt-1 w-full px-2 py-1 text-[10px] uppercase tracking-widest disabled:opacity-40"
                                    >
                                      CLEAR WINNER
                                    </button>
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
            )}
          </div>
        ))}

        {tournaments.length === 0 && (
          <div className="px-6 py-16 text-center md:px-12">
            <p className="text-sm text-[#888]">Тэмцээн алга</p>
            <button onClick={() => setShowCreate(true)}
              className="soft-action-light soft-action-light-primary mt-4 px-6 py-2 text-xs uppercase tracking-widest">
              + ТЭМЦЭЭН НЭМЭХ
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
