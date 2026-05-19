"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { apiFetch } from "@/lib/api";

interface StaffMember {
  id: string;
  canCheckin: boolean;
  canSeatStatus: boolean;
  canViewBookings: boolean;
  createdAt: string;
  user: { id: string; name: string; phone: string; email: string };
  center: { id: string; name: string };
}

interface Invite {
  id: string;
  phone: string;
  token: string;
  expiresAt: string;
  center: { id: string; name: string };
}

interface CenterOption {
  id: string;
  name: string;
}

const PERMS = [
  { key: "canCheckin", label: "Check-in", desc: "Захиалга баталгаажуулах" },
  { key: "canSeatStatus", label: "Суудал", desc: "Суудлын төлөв өөрчлөх" },
  { key: "canViewBookings", label: "Захиалга харах", desc: "Захиалгын жагсаалт үзэх" },
] as const;

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-200 disabled:opacity-40 ${
        checked
          ? "border-green-500/50 bg-green-500/20"
          : "border-white/15 bg-white/5"
      }`}
    >
      <span
        className={`inline-block h-3 w-3 rounded-full transition-transform duration-200 ${
          checked
            ? "translate-x-[18px] bg-green-400"
            : "translate-x-[3px] bg-white/30"
        }`}
      />
    </button>
  );
}

export default function OwnerStaffPage() {
  const { token, user, loading: authLoading } = useAuth();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [centers, setCenters] = useState<CenterOption[]>([]);
  const [identifier, setIdentifier] = useState("");
  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [centerId, setCenterId] = useState("");
  const [assignCenterIds, setAssignCenterIds] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    if (!token) return;
    apiFetch<{ staff: StaffMember[]; invites: Invite[]; centers: CenterOption[] }>(
      "/api/owner/staff",
      { token }
    )
      .then((data) => {
        setFetchError(null);
        setStaff(data.staff);
        setInvites(data.invites);
        setCenters(data.centers);
        if (data.centers.length > 0 && !centerId) setCenterId(data.centers[0].id);
      })
      .catch((e: any) => setFetchError(e?.message ?? "Мэдээлэл авахад алдаа гарлаа"));
  }, [token, centerId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const invite = async () => {
    const effectiveCenterId = centerId || centers[0]?.id || "";
    if (!token) return;
    if (!staffName.trim() || !staffEmail.trim() || !identifier.trim()) {
      setMsg({ text: "Staff name, email, phone bugdiig buglunu.", ok: false });
      return;
    }
    setSubmitting(true);
    setMsg(null);
    try {
      const cleanIdentifier = identifier.trim();
      const res = await apiFetch<{ added?: boolean; created?: boolean; invited?: boolean; user?: { name: string } }>(
        "/api/owner/staff",
        {
          method: "POST",
          token,
          body: JSON.stringify({
            name: staffName.trim(),
            email: staffEmail.trim(),
            phone: cleanIdentifier,
            ...(effectiveCenterId ? { centerId: effectiveCenterId } : {}),
          }),
        }
      );
      if (res.added) {
        setMsg({ text: `${res.user?.name ?? identifier} ажилтнаар нэмэгдлээ!`, ok: true });
      } else if (res.invited) {
        setMsg({ text: `${identifier} руу урилга илгээгдлээ.`, ok: true });
      }
      setIdentifier("");
      setStaffName("");
      setStaffEmail("");
      fetchData();
    } catch (e: any) {
      setMsg({ text: e.message ?? "Алдаа гарлаа", ok: false });
    }
    setSubmitting(false);
  };

  const removeStaff = async (id: string) => {
    if (!token) return;
    setBusy(id);
    try {
      await apiFetch(`/api/owner/staff/${id}`, { method: "DELETE", token });
      setStaff((prev) => prev.filter((s) => s.id !== id));
    } catch {}
    setBusy(null);
  };

  const togglePerm = async (id: string, perm: string, value: boolean) => {
    if (!token) return;
    setBusy(id);
    try {
      await apiFetch(`/api/owner/staff/${id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ [perm]: value }),
      });
      setStaff((prev) =>
        prev.map((s) => (s.id === id ? { ...s, [perm]: value } : s))
      );
    } catch {}
    setBusy(null);
  };

  const assignStaff = async (member: StaffMember) => {
    const targetCenterId = assignCenterIds[member.user.id] || centerId || centers[0]?.id || "";
    if (!token || !targetCenterId) {
      setMsg({ text: "Assign hiih PC center alga. Ehlee center uusge.", ok: false });
      return;
    }
    setBusy(member.id);
    setMsg(null);
    try {
      await apiFetch("/api/owner/staff", {
        method: "POST",
        token,
        body: JSON.stringify({
          phone: member.user.phone,
          email: member.user.email,
          centerId: targetCenterId,
        }),
      });
      setMsg({ text: `${member.user.name} center deer huwaarilagdlaa.`, ok: true });
      fetchData();
    } catch (e: any) {
      setMsg({ text: e.message ?? "Assign hiih ued aldaa garlaa", ok: false });
    }
    setBusy(null);
  };

  // Group staff by center
  const groupedStaff: Record<string, StaffMember[]> = {};
  for (const s of staff) {
    const key = s.center.id;
    if (!groupedStaff[key]) groupedStaff[key] = [];
    groupedStaff[key].push(s);
  }

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <span className="text-sm text-white/30 animate-pulse">LOADING...</span>
      </main>
    );
  }

  if (!user || (user.role !== "OWNER" && user.role !== "ADMIN")) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#0a0a0a]">
        <h1 className="display text-5xl text-white">OWNERS ONLY</h1>
        <Link href="/login" className="text-xs uppercase tracking-[0.3em] text-white/40 hover:text-white transition-colors">
          НЭВТРЭХ →
        </Link>
      </main>
    );
  }

  return (
    <main className="owner-dark min-h-screen text-white">
      {/* Header */}
      <header className="owner-topbar flex flex-wrap items-center justify-between gap-3 px-5 py-4 md:px-12">
        <Link
          href="/owner/dashboard"
          className="text-xs uppercase tracking-[0.3em] text-white/50 hover:text-white transition-colors"
        >
          ← DASHBOARD
        </Link>
        <span className="display text-xl">STAFF</span>
        <span className="text-xs uppercase tracking-[0.3em] text-white/30">
          {staff.length} MEMBERS
        </span>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8 md:px-12 md:py-10">

        {/* ── Invite form ── */}
        <div className="owner-card-dark mb-10 p-6 md:p-8">
          <h2 className="display text-2xl mb-1">АЖИЛТАН НЭМЭХ</h2>
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/30 mb-8">
            Утасны дугаараар хайна. Бүртгэлтэй бол шууд нэмнэ, үгүй бол урилга явуулна.
          </p>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/70">
                STAFF NAME
              </label>
              <input
                type="text"
                placeholder="Staff name"
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                className="owner-field-dark px-4 py-3 text-sm font-semibold placeholder:text-white/30 outline-none transition-colors"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/70">
                LOGIN EMAIL
              </label>
              <input
                type="email"
                placeholder="staff@mail.com"
                value={staffEmail}
                onChange={(e) => setStaffEmail(e.target.value)}
                className="owner-field-dark px-4 py-3 text-sm font-semibold placeholder:text-white/30 outline-none transition-colors"
              />
            </div>

            {/* Center picker */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/70">
                PC CENTER
              </label>
              {fetchError ? (
                <p className="text-xs text-red-400/70">{fetchError}</p>
              ) : centers.length === 0 ? (
                <div className="rounded-lg border border-yellow-400/20 bg-yellow-400/10 px-4 py-3">
                  <p className="text-xs text-white/20">Center бүртгэлгүй байна.</p>
                  <Link href="/owner/dashboard" className="text-[10px] text-white/40 underline underline-offset-2 hover:text-white transition-colors">
                    Dashboard → Center нэмэх
                  </Link>
                </div>
              ) : centers.length === 1 ? (
                <div className="owner-field-dark px-4 py-3 text-sm font-semibold">
                  {centers[0].name}
                </div>
              ) : (
                <select
                  value={centerId}
                  onChange={(e) => setCenterId(e.target.value)}
                  className="owner-field-dark px-4 py-3 text-sm font-semibold outline-none transition-colors"
                >
                  {centers.map((c) => (
                    <option key={c.id} value={c.id} className="bg-black text-white">
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Identifier input */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/70">
                УТАС ЭСВЭЛ ИМЭЙЛ
              </label>
              <input
                type="tel"
                inputMode="tel"
                placeholder="99001122 эсвэл user@mail.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && invite()}
                className="owner-field-dark px-4 py-3 text-sm font-semibold placeholder:text-white/30 outline-none transition-colors"
              />
              <p className="text-[10px] leading-4 text-white/45">
                8 оронтой дугаар, зайтай дугаар, эсвэл +976 format бүгд болно.
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={invite}
              disabled={submitting}
              className="owner-action staff-create-button border border-green-400/40 bg-green-400 px-8 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-black shadow-[0_0_24px_rgba(74,222,128,0.18)] transition-all hover:bg-green-300 disabled:border-white/10 disabled:bg-white/10 disabled:text-white/30 disabled:shadow-none disabled:cursor-not-allowed"
            >
              {submitting ? "..." : "УРИХ"}
            </button>
            {msg && (
              <p className={`text-sm ${msg.ok ? "text-green-400" : "text-red-400"}`}>
                {msg.text}
              </p>
            )}
          </div>
        </div>

        {/* ── Staff list grouped by center ── */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="display text-2xl">АЖИЛТНУУД</h2>
          <span className="text-[10px] uppercase tracking-[0.3em] text-white/20">
            {staff.length} нийт
          </span>
        </div>

        {staff.length === 0 ? (
          <div className="border border-dashed border-white/10 py-16 text-center">
            <p className="text-sm text-white/20">Ажилтан нэмээгүй байна.</p>
            <p className="mt-1 text-[11px] text-white/10">Дээрх формыг ашиглан нэмнэ үү.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedStaff).map(([, members]) => {
              const centerName = members[0].center.name;
              const isUnassigned = members[0].center.id === "unassigned";
              return (
                <div key={centerName} className={`owner-card-dark ${isUnassigned ? "border-yellow-400/25" : ""}`}>
                  {/* Center header */}
                  <div className={`border-b px-6 py-3 ${isUnassigned ? "border-yellow-400/20 bg-yellow-400/[0.06]" : "border-white/10 bg-white/[0.02]"}`}>
                    <span className={`text-[9px] uppercase tracking-[0.3em] ${isUnassigned ? "text-yellow-200/70" : "text-white/40"}`}>
                      {centerName}
                    </span>
                  </div>

                  {/* Members */}
                  <ul className="divide-y divide-white/5">
                    {members.map((s) => (
                      <li key={s.id} className="px-6 py-5">
                        {/* Top row: avatar + name + remove */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-white/10 text-[11px] font-black text-white">
                              {s.user.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-bold leading-tight">{s.user.name}</p>
                              <p className="text-[10px] text-white/30 mt-0.5">{s.user.phone}</p>
                            </div>
                          </div>
                          {isUnassigned && centers.length > 0 && (
                            <div className="flex items-center gap-2">
                              <select
                                value={assignCenterIds[s.user.id] || centerId || centers[0]?.id || ""}
                                onChange={(e) =>
                                  setAssignCenterIds((prev) => ({ ...prev, [s.user.id]: e.target.value }))
                                }
                                className="rounded-full border border-white/15 bg-white px-3 py-1 text-[9px] font-semibold uppercase tracking-widest text-black outline-none"
                              >
                                {centers.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                              <button
                                disabled={busy === s.id}
                                onClick={() => assignStaff(s)}
                                className="rounded-full border border-green-400/30 px-3 py-1 text-[9px] uppercase tracking-widest text-green-300 hover:bg-green-400 hover:text-black disabled:opacity-30 transition-colors"
                              >
                                ASSIGN
                              </button>
                              <button
                                disabled={busy === s.id}
                                onClick={() => removeStaff(s.id)}
                                className="text-[9px] uppercase tracking-[0.25em] text-red-400/50 hover:text-red-400 disabled:opacity-30 transition-colors"
                              >
                                REMOVE
                              </button>
                            </div>
                          )}
                          {!isUnassigned && (
                          <button
                            disabled={busy === s.id}
                            onClick={() => removeStaff(s.id)}
                            className="text-[9px] uppercase tracking-[0.25em] text-red-400/70 hover:text-red-300 disabled:opacity-30 transition-colors"
                            aria-label="Remove staff"
                          >
                            ХАСАХ
                          </button>
                          )}
                        </div>

                        {/* Permissions */}
                        {isUnassigned && (
                          <p className="mt-3 pl-12 text-[10px] uppercase tracking-widest text-yellow-100/35">
                            Login account ready. Create/select a PC center, then assign this staff.
                          </p>
                        )}
                        {!isUnassigned && (
                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3 pl-12">
                          {PERMS.map(({ key, label, desc }) => (
                            <div
                              key={key}
                              className="flex items-center justify-between gap-3 border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
                            >
                              <div>
                                <p className="text-[10px] font-medium text-white/70">{label}</p>
                                <p className="text-[9px] text-white/25 mt-0.5 leading-tight">{desc}</p>
                              </div>
                              <Toggle
                                checked={s[key]}
                                onChange={() => togglePerm(s.id, key, !s[key])}
                                disabled={busy === s.id}
                              />
                            </div>
                          ))}
                        </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Pending invites ── */}
        {false && invites.length > 0 && (
          <div className="mt-8">
            <h2 className="display text-xl mb-4 text-white/40">ХҮЛЭЭГДЭЖ БУЙ УРИЛГА</h2>
            <div className="border border-white/10 divide-y divide-white/5">
              {invites.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-1.5 w-1.5 rounded-full bg-yellow-400 animate-pulse" />
                    <span className="text-sm font-mono">{inv.phone}</span>
                    <span className="text-[10px] text-white/30">{inv.center.name}</span>
                  </div>
                  <span className="text-[10px] text-white/20">
                    {new Date(inv.expiresAt).toLocaleDateString("mn-MN")} хүртэл
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
