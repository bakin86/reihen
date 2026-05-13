"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";

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
    captain: { id: string; name: string; phone: string };
    members: { user: { id: string; name: string } }[];
    paymentStatus: string;
  }[];
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
  const router = useRouter();
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

  const selected = tournaments.find((t) => t.id === selectedId);

  if (authLoading || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-5 w-5 animate-spin border-2 border-black border-t-transparent" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-black">
      {/* Toast */}
      {toast && (
        <div className={`fixed left-1/2 top-4 z-50 -translate-x-1/2 border px-6 py-3 text-xs uppercase tracking-widest ${toast.err ? "border-red-500 bg-red-50 text-red-600" : "border-black bg-black text-white"}`}>
          {toast.text}
        </div>
      )}

      {/* Header */}
      <div className="border-b border-black px-6 py-6 md:px-12">
        <Link href={`/owner/centers/${params.id}`} className="text-[10px] uppercase tracking-[0.3em] text-gray hover:text-black">
          ← CENTER
        </Link>
        <h1 className="display mt-2 text-4xl md:text-6xl">TOURNAMENTS</h1>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between border-b border-black px-6 py-4 md:px-12">
        <span className="text-[10px] uppercase tracking-[0.3em] text-gray">
          {tournaments.length} ТЭМЦЭЭН
        </span>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="border border-black px-4 py-2 text-xs uppercase tracking-widest hover:bg-black hover:text-white transition-colors"
        >
          {showCreate ? "ХААХ" : "+ ТЭМЦЭЭН НЭМЭХ"}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="border-b border-black p-6 md:p-12 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-[10px] uppercase tracking-[0.3em] text-gray">НЭР *</label>
              <input value={name} onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full border border-black px-3 py-2 text-sm" placeholder="CS2 5v5 Tournament" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.3em] text-gray">ТОГЛООМ *</label>
              <select value={game} onChange={(e) => setGame(e.target.value)}
                className="mt-1 w-full border border-black px-3 py-2 text-sm bg-white">
                {GAMES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.3em] text-gray">ЭХЛЭХ ОГНОО *</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 w-full border border-black px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.3em] text-gray">ЭХЛЭХ ЦАГ *</label>
              <input type="time" value={startHour} onChange={(e) => setStartHour(e.target.value)}
                className="mt-1 w-full border border-black px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.3em] text-gray">ДУУСАХ ОГНОО</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 w-full border border-black px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] uppercase tracking-[0.3em] text-gray">MAX TEAMS</label>
                <input type="number" min={2} max={256} value={maxTeams} onChange={(e) => setMaxTeams(+e.target.value)}
                  className="mt-1 w-full border border-black px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-[0.3em] text-gray">TEAM SIZE</label>
                <input type="number" min={1} max={10} value={teamSize} onChange={(e) => setTeamSize(+e.target.value)}
                  className="mt-1 w-full border border-black px-3 py-2 text-sm" />
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.3em] text-gray">ОРОЛЦОХ ХУРААМЖ (₮)</label>
              <input type="number" min={0} value={entryFee} onChange={(e) => setEntryFee(+e.target.value)}
                className="mt-1 w-full border border-black px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.3em] text-gray">ШАГНАЛЫН САН (₮)</label>
              <input type="number" min={0} value={prizePool} onChange={(e) => setPrizePool(+e.target.value)}
                className="mt-1 w-full border border-black px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.3em] text-gray">ТАЙЛБАР</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              rows={3} className="mt-1 w-full border border-black px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.3em] text-gray">ДҮРЭМ</label>
            <textarea value={rules} onChange={(e) => setRules(e.target.value)}
              rows={3} className="mt-1 w-full border border-black px-3 py-2 text-sm" />
          </div>
          <button
            onClick={createTournament}
            disabled={saving || !name.trim() || !startDate}
            className="w-full bg-black py-3 text-xs uppercase tracking-widest text-white hover:bg-[#333] transition-colors disabled:opacity-50"
          >
            {saving ? "CREATING..." : "ТЭМЦЭЭН ҮҮСГЭХ"}
          </button>
        </div>
      )}

      {/* Tournament list */}
      <div className="divide-y divide-black">
        {tournaments.map((t) => (
          <div key={t.id} className="px-6 py-6 md:px-12">
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
                  className="border border-black px-3 py-1.5 text-[10px] uppercase tracking-widest hover:bg-black hover:text-white transition-colors"
                >
                  {selectedId === t.id ? "ХААХ" : "ДЭЛГЭРЭНГҮЙ"}
                </button>

                {t.status === "UPCOMING" && (
                  <button onClick={() => updateStatus(t.id, "REGISTRATION_CLOSED")} disabled={saving}
                    className="border border-black px-3 py-1.5 text-[10px] uppercase tracking-widest hover:bg-black hover:text-white transition-colors disabled:opacity-50">
                    БҮРТГЭЛ ХААХ
                  </button>
                )}
                {t.status === "REGISTRATION_CLOSED" && (
                  <button onClick={() => updateStatus(t.id, "LIVE")} disabled={saving}
                    className="bg-black px-3 py-1.5 text-[10px] uppercase tracking-widest text-white hover:bg-[#333] transition-colors disabled:opacity-50">
                    ЭХЛҮҮЛЭХ
                  </button>
                )}
                {t.status === "LIVE" && (
                  <button onClick={() => updateStatus(t.id, "COMPLETED")} disabled={saving}
                    className="border border-black px-3 py-1.5 text-[10px] uppercase tracking-widest hover:bg-black hover:text-white transition-colors disabled:opacity-50">
                    ДУУСГАХ
                  </button>
                )}
                {!["COMPLETED", "CANCELLED"].includes(t.status) && (
                  <button onClick={() => deleteTournament(t.id)} disabled={saving}
                    className="border border-red-500 px-3 py-1.5 text-[10px] uppercase tracking-widest text-red-500 hover:bg-red-500 hover:text-white transition-colors disabled:opacity-50">
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
                            ({team.members.map((m) => m.user.name).join(", ")})
                          </span>
                        </div>
                        <span className={`text-[9px] uppercase tracking-widest ${team.paymentStatus === "PAID" ? "text-black" : "text-[#888]"}`}>
                          {team.paymentStatus}
                        </span>
                      </div>
                    ))}
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
              className="mt-4 border border-black px-6 py-2 text-xs uppercase tracking-widest hover:bg-black hover:text-white transition-colors">
              + ТЭМЦЭЭН НЭМЭХ
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
