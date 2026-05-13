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
    createdAt: string;
    members: { user: { id: string; name: string } }[];
  }[];
  _count: { teams: number };
}

export default function TournamentPage({
  params,
}: {
  params: { id: string; tournamentId: string };
}) {
  const { user, token } = useAuth();
  const [t, setT] = useState<TournamentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [teamName, setTeamName] = useState("");
  const [payMethod, setPayMethod] = useState<"QPAY" | "BALANCE">("QPAY");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // QPay pending state
  const [qpayPending, setQpayPending] = useState<{
    qrImage?: string;
    shortUrl?: string;
    deeplinks?: { name: string; link: string }[];
  } | null>(null);

  const fetchTournament = () => {
    apiFetch<{ tournament: TournamentDetail }>(
      `/api/tournaments/${params.tournamentId}`
    )
      .then(({ tournament }) => setT(tournament))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(fetchTournament, [params.tournamentId]);

  // Check if current user is already registered
  const myTeam = t?.teams.find((team) =>
    team.members.some((m) => m.user.id === user?.id)
  );

  const isFull = t ? t._count.teams >= t.maxTeams : false;
  const canRegister =
    t?.status === "UPCOMING" && !myTeam && !isFull && !!user;

  async function handleRegister() {
    if (!teamName.trim()) {
      setError("Багийн нэр оруулна уу");
      return;
    }
    setSubmitting(true);
    setError("");
    setSuccess("");
    setQpayPending(null);
    try {
      const res = await apiFetch<{
        team: any;
        payment: { pending?: boolean; qrImage?: string; shortUrl?: string; deeplinks?: { name: string; link: string }[] } | null;
      }>(`/api/tournaments/${params.tournamentId}/register`, {
        method: "POST",
        body: JSON.stringify({ teamName: teamName.trim(), paymentMethod: payMethod }),
        token,
      });

      if (res.payment?.pending) {
        setQpayPending({
          qrImage: res.payment.qrImage,
          shortUrl: res.payment.shortUrl,
          deeplinks: res.payment.deeplinks,
        });
      } else {
        setSuccess("Бүртгэл амжилттай!");
        setTeamName("");
        fetchTournament();
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Алдаа гарлаа");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUnregister() {
    if (!confirm("Бүртгэлээ цуцлах уу?")) return;
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      await apiFetch(`/api/tournaments/${params.tournamentId}/register`, {
        method: "DELETE",
        token,
      });
      setSuccess("Бүртгэл цуцлагдлаа");
      fetchTournament();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Алдаа гарлаа");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <span className="mono text-xs animate-pulse">LOADING...</span>
      </main>
    );
  }

  if (!t) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4">
        <span className="display text-2xl">ОЛДСОНГҮЙ</span>
        <Link href={`/centers/${params.id}`} className="mono text-xs underline">
          ← Буцах
        </Link>
      </main>
    );
  }

  const start = new Date(t.startTime);
  const end = t.endTime ? new Date(t.endTime) : null;
  const statusLabel: Record<string, string> = {
    UPCOMING: "УДАХГҮЙ",
    REGISTRATION_CLOSED: "БҮРТГЭЛ ХААГДСАН",
    LIVE: "LIVE",
    COMPLETED: "ДУУССАН",
    CANCELLED: "ЦУЦЛАГДСАН",
  };

  return (
    <main className="min-h-screen bg-white text-black">
      {/* Header */}
      <div className="border-b border-black px-6 py-5 md:px-12">
        <Link
          href={`/centers/${params.id}`}
          className="mono text-[10px] text-[#888] hover:text-black transition-colors"
        >
          ← {t.center.name}
        </Link>
      </div>

      {/* Title + Status */}
      <div className="border-b border-black px-6 py-8 md:px-12">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="display text-3xl md:text-5xl">{t.name}</h1>
            <p className="mt-2 text-sm text-[#888]">{t.game}</p>
          </div>
          <span
            className={`shrink-0 px-3 py-1 text-[10px] uppercase tracking-widest ${
              t.status === "LIVE"
                ? "bg-black text-white animate-pulse"
                : t.status === "CANCELLED"
                ? "bg-red-500 text-white"
                : "border border-black"
            }`}
          >
            {statusLabel[t.status] ?? t.status}
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-black divide-x divide-black">
        <div className="px-6 py-5 md:px-12">
          <div className="mono text-xl md:text-2xl">
            {start.toLocaleDateString("mn-MN", { month: "short", day: "numeric" })}
          </div>
          <div className="text-[9px] text-[#888] tracking-widest mt-1">ОГНОО</div>
        </div>
        <div className="px-6 py-5 md:px-12">
          <div className="mono text-xl md:text-2xl">
            {start.toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" })}
            {end && ` — ${end.toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" })}`}
          </div>
          <div className="text-[9px] text-[#888] tracking-widest mt-1">ЦАГ</div>
        </div>
        <div className="px-6 py-5 md:px-12">
          <div className="mono text-xl md:text-2xl">
            {t._count.teams}/{t.maxTeams}
          </div>
          <div className="text-[9px] text-[#888] tracking-widest mt-1">
            {t.teamSize === 1 ? "ТОГЛОГЧ" : "БАГ"}
          </div>
        </div>
        <div className="px-6 py-5 md:px-12">
          <div className="mono text-xl md:text-2xl">
            {t.teamSize === 1 ? "Solo" : `${t.teamSize}v${t.teamSize}`}
          </div>
          <div className="text-[9px] text-[#888] tracking-widest mt-1">ФОРМАТ</div>
        </div>
      </div>

      {/* Prize + Fee row */}
      {(t.entryFee > 0 || t.prizePool > 0) && (
        <div className="grid grid-cols-2 border-b border-black divide-x divide-black">
          <div className="px-6 py-5 md:px-12">
            <div className="mono text-xl md:text-2xl">
              {t.entryFee > 0 ? `${t.entryFee.toLocaleString()}₮` : "ҮНЭГҮЙ"}
            </div>
            <div className="text-[9px] text-[#888] tracking-widest mt-1">ОРОЛЦОХ ХУРААМЖ</div>
          </div>
          <div className="px-6 py-5 md:px-12">
            <div className="mono text-xl md:text-2xl">
              {t.prizePool > 0 ? `${t.prizePool.toLocaleString()}₮` : "—"}
            </div>
            <div className="text-[9px] text-[#888] tracking-widest mt-1">ШАГНАЛЫН САН</div>
          </div>
        </div>
      )}

      {/* Description */}
      {t.description && (
        <div className="border-b border-black px-6 py-6 md:px-12">
          <h3 className="text-[10px] text-[#888] tracking-widest mb-3">ТАЙЛБАР</h3>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{t.description}</p>
        </div>
      )}

      {/* Prize description */}
      {t.prizeDescription && (
        <div className="border-b border-black px-6 py-6 md:px-12">
          <h3 className="text-[10px] text-[#888] tracking-widest mb-3">ШАГНАЛ</h3>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{t.prizeDescription}</p>
        </div>
      )}

      {/* Rules */}
      {t.rules && (
        <div className="border-b border-black px-6 py-6 md:px-12">
          <h3 className="text-[10px] text-[#888] tracking-widest mb-3">ДҮРЭМ</h3>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{t.rules}</p>
        </div>
      )}

      {/* Registration section */}
      {canRegister && (
        <div className="border-b border-black px-6 py-8 md:px-12">
          <h3 className="display text-xl mb-5">БҮРТГҮҮЛЭХ</h3>

          {error && (
            <div className="mb-4 border border-red-400 bg-red-50 px-4 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 border border-green-400 bg-green-50 px-4 py-2 text-xs text-green-700">
              {success}
            </div>
          )}

          <div className="flex flex-col gap-4 max-w-md">
            <input
              type="text"
              placeholder={t.teamSize === 1 ? "Нэр / IGN" : "Багийн нэр"}
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="border border-black px-4 py-3 text-sm focus:outline-none"
              maxLength={64}
            />

            {t.entryFee > 0 && (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setPayMethod("QPAY")}
                  className={`flex-1 border px-4 py-3 text-xs transition-colors ${
                    payMethod === "QPAY"
                      ? "border-black bg-black text-white"
                      : "border-black/20 hover:border-black"
                  }`}
                >
                  QPAY
                </button>
                <button
                  type="button"
                  onClick={() => setPayMethod("BALANCE")}
                  className={`flex-1 border px-4 py-3 text-xs transition-colors ${
                    payMethod === "BALANCE"
                      ? "border-black bg-black text-white"
                      : "border-black/20 hover:border-black"
                  }`}
                >
                  ҮЛДЭГДЭЛ
                </button>
              </div>
            )}

            <button
              onClick={handleRegister}
              disabled={submitting}
              className="bg-black text-white px-6 py-3 text-sm hover:bg-black/80 transition-colors disabled:opacity-50"
            >
              {submitting
                ? "..."
                : t.entryFee > 0
                ? `БҮРТГҮҮЛЭХ · ${t.entryFee.toLocaleString()}₮`
                : "БҮРТГҮҮЛЭХ"}
            </button>
          </div>

          {/* QPay pending */}
          {qpayPending && (
            <div className="mt-6 border border-black p-6 max-w-md">
              <h4 className="display text-sm mb-4">QPAY ТӨЛБӨР</h4>
              {(qpayPending.qrImage || qpayPending.shortUrl) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qpayPending.qrImage || qpayPending.shortUrl}
                  alt="QPay QR"
                  className="w-48 h-48 mx-auto mb-4"
                />
              )}
              {qpayPending.deeplinks && qpayPending.deeplinks.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {qpayPending.deeplinks.map((dl) => (
                    <a
                      key={dl.name}
                      href={dl.link}
                      className="border border-black px-3 py-1.5 text-[10px] hover:bg-black hover:text-white transition-colors"
                    >
                      {dl.name}
                    </a>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-[#888] mt-4">
                Төлбөр төлсний дараа хуудсаа дахин ачаалж бүртгэлээ шалгана уу.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Already registered — unregister option */}
      {myTeam && t.status === "UPCOMING" && (
        <div className="border-b border-black px-6 py-6 md:px-12">
          <div className="flex items-center justify-between max-w-md">
            <div>
              <span className="text-sm">Бүртгэгдсэн: </span>
              <span className="display text-sm">{myTeam.name}</span>
            </div>
            <button
              onClick={handleUnregister}
              disabled={submitting}
              className="border border-red-400 text-red-600 px-4 py-2 text-xs hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {submitting ? "..." : "ЦУЦЛАХ"}
            </button>
          </div>
          {error && (
            <div className="mt-3 text-xs text-red-600">{error}</div>
          )}
          {success && (
            <div className="mt-3 text-xs text-green-600">{success}</div>
          )}
        </div>
      )}

      {/* Not logged in prompt */}
      {!user && t.status === "UPCOMING" && !isFull && (
        <div className="border-b border-black px-6 py-6 md:px-12">
          <p className="text-sm text-[#888]">
            Бүртгүүлэхийн тулд{" "}
            <Link href="/login" className="underline text-black">
              нэвтрэх
            </Link>{" "}
            шаардлагатай.
          </p>
        </div>
      )}

      {/* Full notice */}
      {isFull && t.status === "UPCOMING" && !myTeam && (
        <div className="border-b border-black px-6 py-6 md:px-12">
          <p className="text-sm text-[#888]">Бүртгэл дүүрсэн байна.</p>
        </div>
      )}

      {/* Teams list */}
      <div className="px-6 py-8 md:px-12">
        <div className="flex items-center justify-between mb-5">
          <h3 className="display text-xl">
            {t.teamSize === 1 ? "ТОГЛОГЧИД" : "БҮРТГЭГДСЭН БАГУУД"}
          </h3>
          <span className="mono text-xs text-[#888]">
            {t._count.teams}/{t.maxTeams}
          </span>
        </div>

        {t.teams.length === 0 ? (
          <p className="text-sm text-[#888]">Одоогоор бүртгэл байхгүй.</p>
        ) : (
          <div className="divide-y divide-black/10">
            {t.teams.map((team, i) => (
              <div key={team.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-4">
                  <span className="mono text-xs text-[#888] w-6">{i + 1}</span>
                  <div>
                    <span className="text-sm font-medium">{team.name}</span>
                    {t.teamSize > 1 && (
                      <div className="text-[11px] text-[#888] mt-0.5">
                        {team.members.map((m) => m.user.name).join(", ")}
                      </div>
                    )}
                  </div>
                </div>
                {team.members.some((m) => m.user.id === user?.id) && (
                  <span className="text-[9px] tracking-widest text-[#888]">ТА</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Center info footer */}
      <div className="border-t border-black px-6 py-5 md:px-12">
        <Link
          href={`/centers/${params.id}`}
          className="text-xs text-[#888] hover:text-black transition-colors"
        >
          {t.center.name} · {t.center.district} · {t.center.address}
        </Link>
      </div>
    </main>
  );
}
