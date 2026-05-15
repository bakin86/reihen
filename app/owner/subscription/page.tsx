"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { apiFetch } from "@/lib/api";

type Plan = "STARTER" | "PRO" | "ENTERPRISE";
type Method = "QPAY" | "BALANCE";

interface PlanInfo {
  name: string;
  maxCenters: number;
  maxSeats: number;
  monthlyPrice: number;
  features: string[];
}

interface SubData {
  subscription: {
    plan: Plan;
    status: string;
    maxCenters: number;
    maxSeats: number;
    monthlyPrice: number;
    expiresAt: string;
  } | null;
  usage: { centers: number; seats: number };
  plans: Record<Plan, PlanInfo>;
}

const PLAN_ORDER: Plan[] = ["STARTER", "PRO", "ENTERPRISE"];

export default function SubscriptionPage() {
  const { user, token, loading: authLoading } = useAuth();
  const [data, setData] = useState<SubData | null>(null);
  const [selected, setSelected] = useState<Plan | null>(null);
  const [method, setMethod] = useState<Method>("QPAY");
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    apiFetch<SubData>("/api/owner/subscription", { token })
      .then(setData)
      .catch(() => {});
  }, [token]);

  const subscribe = async () => {
    if (!selected || !token) return;
    setError("");
    setProcessing(true);
    try {
      const isUpgrade = data?.subscription;
      const endpoint = isUpgrade
        ? "/api/owner/subscription/upgrade"
        : "/api/owner/subscription";
      const res = await apiFetch<{ subscription: any }>(endpoint, {
        method: isUpgrade ? "PATCH" : "POST",
        token,
        body: JSON.stringify({ plan: selected, paymentMethod: method }),
      });
      setData((d) => d ? { ...d, subscription: res.subscription } : d);
      setSuccess(true);
    } catch (e: any) {
      setError(e.message ?? "Failed");
    } finally {
      setProcessing(false);
    }
  };

  if (authLoading) return null;
  if (!user || (user.role !== "OWNER" && user.role !== "ADMIN")) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6">
        <h1 className="display text-5xl">OWNERS ONLY</h1>
        <Link href="/login" className="text-xs uppercase tracking-[0.3em] text-gray">НЭВТРЭХ →</Link>
      </main>
    );
  }

  const sub = data?.subscription;
  const plans = data?.plans;
  const usage = data?.usage;

  // Success screen
  if (success && sub) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-black p-10 text-white">
        <p className="text-xs uppercase tracking-[0.3em] text-gray">SUBSCRIBED</p>
        <div className="display mt-6 text-[16vw] md:text-[10vw]">{sub.plan}</div>
        <p className="mono mt-6 text-sm text-gray">
          {sub.maxCenters} centers · {sub.maxSeats} seats · {sub.monthlyPrice.toLocaleString()}₮/mo
        </p>
        <p className="mono mt-2 text-xs text-gray">
          Expires: {new Date(sub.expiresAt).toLocaleDateString("mn-MN")}
        </p>
        <div className="mt-12 flex gap-4">
          <Link
            href="/owner/dashboard"
            className="bg-white px-6 py-4 text-xs uppercase tracking-[0.3em] text-black"
          >
            DASHBOARD →
          </Link>
          <Link
            href="/owner/centers/new"
            className="border border-white px-6 py-4 text-xs uppercase tracking-[0.3em] hover:bg-white hover:text-black"
          >
            ADD CENTER →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="owner-light min-h-screen text-black">
      <header className="owner-topbar grid grid-cols-[auto_1fr_auto] items-center gap-3 px-5 py-4 md:px-12">
        <Link href="/owner/dashboard" className="text-xs uppercase tracking-[0.3em]">← DASHBOARD</Link>
        <span className="display text-center text-xl">SUBSCRIPTION</span>
        <span className="text-xs uppercase tracking-[0.3em] text-gray">{user.name}</span>
      </header>

      {/* Current subscription */}
      {sub && (
        <section className="mx-auto grid max-w-6xl grid-cols-2 gap-3 px-5 py-6 md:grid-cols-4 md:px-12">
          {[
            [sub.plan, "CURRENT PLAN"],
            [`${usage?.centers ?? 0}/${sub.maxCenters}`, "CENTERS"],
            [`${usage?.seats ?? 0}/${sub.maxSeats}`, "SEATS"],
            [new Date(sub.expiresAt).toLocaleDateString("mn-MN"), "EXPIRES"],
          ].map(([n, l], i) => (
            <div key={i} className="owner-card-light p-6 md:p-8">
              <div className="display text-2xl md:text-4xl">{n}</div>
              <div className="mt-2 text-[10px] uppercase tracking-[0.3em] text-gray">{l}</div>
            </div>
          ))}
        </section>
      )}

      {!sub && (
        <section className="mx-auto max-w-6xl px-5 py-10 md:px-12 md:py-16">
          <h1 className="display text-5xl md:text-8xl">SUBSCRIBE<br />TO LIST<br />YOUR CENTER.</h1>
          <p className="mt-6 max-w-lg text-sm font-light text-gray">
            PC Center-ээ Reihen платформд нэмэхийн тулд багц сонгоно уу.
            Mock төлбөр — demo горимд автоматаар баталгаажна.
          </p>
        </section>
      )}

      {/* Plans grid */}
      {plans && (
        <section className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-5 py-6 md:grid-cols-3 md:px-12">
          {PLAN_ORDER.map((key) => {
            const p = plans[key];
            const isCurrent = sub?.plan === key;
            const isLower = sub ? PLAN_ORDER.indexOf(key) <= PLAN_ORDER.indexOf(sub.plan as Plan) : false;
            const isSelected = selected === key;
            return (
              <div
                key={key}
                className={`owner-card-light flex flex-col justify-between p-8 md:p-10 ${
                  isSelected ? "bg-black text-white" : ""
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="display text-3xl md:text-5xl">{p.name}</h3>
                    {isCurrent && (
                      <span className="text-[10px] uppercase tracking-[0.3em] text-gray">CURRENT</span>
                    )}
                  </div>

                  <div className="display mono mt-6 text-5xl md:text-6xl">
                    {(p.monthlyPrice / 1000).toFixed(0)}K₮
                  </div>
                  <div className="mt-1 text-xs uppercase tracking-[0.3em] text-gray">/ СAР</div>

                  <div className="mt-8 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="display text-2xl">{p.maxCenters === 999 ? "∞" : p.maxCenters}</div>
                      <div className="text-[10px] uppercase tracking-[0.3em] text-gray">CENTER</div>
                    </div>
                    <div>
                      <div className="display text-2xl">{p.maxSeats === 9999 ? "∞" : p.maxSeats}</div>
                      <div className="text-[10px] uppercase tracking-[0.3em] text-gray">SEAT</div>
                    </div>
                  </div>

                  <ul className="mt-8 space-y-2">
                    {p.features.map((f) => (
                      <li key={f} className="text-xs">— {f}</li>
                    ))}
                  </ul>
                </div>

                <button
                  disabled={isCurrent || (sub ? isLower : false)}
                  onClick={() => setSelected(key)}
                  className={`owner-action mt-10 w-full border py-4 text-xs uppercase tracking-[0.3em] disabled:opacity-30 ${
                    isSelected
                      ? "border-white bg-white text-black"
                      : "border-black hover:bg-black hover:text-white"
                  }`}
                >
                  {isCurrent ? "CURRENT PLAN" : isLower ? "—" : sub ? "UPGRADE" : "SELECT"}
                </button>
              </div>
            );
          })}
        </section>
      )}

      {/* Payment + confirm */}
      {selected && (
        <section className="px-5 py-8 md:px-12">
          <div className="owner-card-light mx-auto max-w-xl p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-gray">PAYMENT METHOD</p>
            <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
              {(["QPAY", "BALANCE"] as Method[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`owner-action border border-black py-4 text-xs uppercase tracking-[0.3em] ${
                    method === m ? "bg-black text-white" : "hover:bg-black hover:text-white"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <div className="mt-8 grid grid-cols-2 items-end border-y border-black py-6">
              <span className="text-xs uppercase tracking-[0.3em] text-gray">
                {sub ? "UPGRADE TO" : "SUBSCRIBE"} {selected}
              </span>
              <span className="display mono text-right text-4xl">
                {plans ? plans[selected].monthlyPrice.toLocaleString() : "—"}₮
              </span>
            </div>

            {error && (
              <div className="mt-4 border border-black bg-black p-4 text-xs uppercase tracking-[0.3em] text-white">
                {error}
              </div>
            )}

            <button
              onClick={subscribe}
              disabled={processing}
              className="owner-action mt-6 w-full bg-black px-6 py-5 text-xs uppercase tracking-[0.3em] text-white disabled:opacity-40"
            >
              {processing ? "PROCESSING..." : "CONFIRM PAYMENT →"}
            </button>
            <p className="mt-3 text-center text-[10px] uppercase tracking-[0.3em] text-gray">
              MOCK PAYMENT — DEMO MODE · AUTO-CONFIRMED
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
