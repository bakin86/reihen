"use client";

import { useEffect, useRef, useState } from "react";
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
const METHODS: Method[] = ["QPAY", "BALANCE"];

export default function SubscriptionPage() {
  const { user, token, loading: authLoading } = useAuth();
  const [data, setData] = useState<SubData | null>(null);
  const [selected, setSelected] = useState<Plan | null>(null);
  const [method, setMethod] = useState<Method>("QPAY");
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const confirmRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!token) return;
    apiFetch<SubData>("/api/owner/subscription", { token })
      .then(setData)
      .catch((e: any) => setError(e.message ?? "Subscription data failed to load"));
  }, [token]);

  const choosePlan = (plan: Plan) => {
    setSelected(plan);
    setSuccess(false);
    setError("");
    window.setTimeout(() => {
      confirmRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  };

  const subscribe = async () => {
    if (!selected || !token) return;
    setError("");
    setProcessing(true);
    try {
      const isUpgrade = Boolean(data?.subscription);
      const endpoint = isUpgrade ? "/api/owner/subscription/upgrade" : "/api/owner/subscription";
      const res = await apiFetch<{ subscription: SubData["subscription"] }>(endpoint, {
        method: isUpgrade ? "PATCH" : "POST",
        token,
        body: JSON.stringify({ plan: selected, paymentMethod: method }),
      });
      setData((d) => (d ? { ...d, subscription: res.subscription } : d));
      setSuccess(true);
      setSelected(null);
    } catch (e: any) {
      setError(e.message ?? "Payment failed");
    } finally {
      setProcessing(false);
    }
  };

  if (authLoading) return null;
  if (!user || (user.role !== "OWNER" && user.role !== "ADMIN")) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6">
        <h1 className="display text-5xl">OWNERS ONLY</h1>
        <Link href="/login" className="text-xs uppercase tracking-[0.3em] text-gray">
          {"LOGIN ->"}
        </Link>
      </main>
    );
  }

  const sub = data?.subscription;
  const plans = data?.plans;
  const usage = data?.usage;

  if (success && sub) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-black p-10 text-white">
        <p className="text-xs uppercase tracking-[0.3em] text-gray">SUBSCRIPTION ACTIVE</p>
        <div className="display mt-6 text-[16vw] md:text-[10vw]">{sub.plan}</div>
        <p className="mono mt-6 text-sm text-gray">
          {sub.maxCenters} centers · {sub.maxSeats} seats · {sub.monthlyPrice.toLocaleString()}₮/mo
        </p>
        <p className="mono mt-2 text-xs text-gray">
          Expires: {new Date(sub.expiresAt).toLocaleDateString("mn-MN")}
        </p>
        <div className="mt-12 flex flex-wrap justify-center gap-4">
          <Link href="/owner/dashboard" className="bg-white px-6 py-4 text-xs uppercase tracking-[0.3em] text-black">
            {"DASHBOARD ->"}
          </Link>
          <Link href="/owner/centers/new" className="border border-white px-6 py-4 text-xs uppercase tracking-[0.3em] hover:bg-white hover:text-black">
            {"ADD CENTER ->"}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="owner-light min-h-screen text-black">
      <header className="owner-topbar grid grid-cols-[auto_1fr_auto] items-center gap-3 px-5 py-4 md:px-12">
        <Link href="/owner/dashboard" className="text-xs uppercase tracking-[0.3em]">
          {"<- DASHBOARD"}
        </Link>
        <span className="display text-center text-xl">SUBSCRIPTION</span>
        <span className="max-w-[220px] truncate text-xs uppercase tracking-[0.3em] text-gray">{user.name}</span>
      </header>

      {sub ? (
        <section className="mx-auto grid max-w-6xl grid-cols-2 gap-3 px-5 py-6 md:grid-cols-4 md:px-12">
          {[
            [sub.plan, "CURRENT PLAN"],
            [`${usage?.centers ?? 0}/${sub.maxCenters}`, "CENTERS"],
            [`${usage?.seats ?? 0}/${sub.maxSeats}`, "SEATS"],
            [new Date(sub.expiresAt).toLocaleDateString("mn-MN"), "EXPIRES"],
          ].map(([n, l]) => (
            <div key={`${n}-${l}`} className="owner-card-light p-6 md:p-8">
              <div className="display text-2xl md:text-4xl">{n}</div>
              <div className="mt-2 text-[10px] uppercase tracking-[0.3em] text-gray">{l}</div>
            </div>
          ))}
        </section>
      ) : (
        <section className="mx-auto max-w-6xl px-5 py-10 md:px-12 md:py-16">
          <h1 className="display text-5xl md:text-8xl">
            SUBSCRIBE
            <br />
            TO LIST
            <br />
            YOUR CENTER.
          </h1>
          <p className="mt-6 max-w-lg text-sm font-light text-gray">
            PC Center-ee Reihen platform-d nemehiin tuld bagts songono. Mock tulbur demo gorimd
            automataar batalgaajina.
          </p>
        </section>
      )}

      {error && !selected ? (
        <div className="mx-auto mb-4 max-w-6xl px-5 md:px-12">
          <div className="border border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        </div>
      ) : null}

      {plans ? (
        <section className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-5 py-6 md:grid-cols-3 md:px-12">
          {PLAN_ORDER.map((key) => {
            const p = plans[key];
            const isCurrent = sub?.plan === key;
            const isLower = sub ? PLAN_ORDER.indexOf(key) <= PLAN_ORDER.indexOf(sub.plan) : false;
            const isSelected = selected === key;
            return (
              <div
                key={key}
                className={`owner-card-light flex min-h-[530px] flex-col justify-between p-8 md:p-10 ${
                  isSelected ? "!border-black !bg-black text-white shadow-[0_26px_80px_rgba(0,0,0,0.18)]" : ""
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="display text-3xl md:text-5xl">{p.name}</h3>
                    {isCurrent ? (
                      <span className="text-[10px] uppercase tracking-[0.3em] text-gray">CURRENT</span>
                    ) : null}
                    {isSelected && !isCurrent ? (
                      <span className="rounded-full border border-white px-3 py-1 text-[9px] uppercase tracking-[0.25em] text-white">
                        SELECTED
                      </span>
                    ) : null}
                  </div>

                  <div className="display mono mt-6 text-5xl md:text-6xl">
                    {(p.monthlyPrice / 1000).toFixed(0)}K₮
                  </div>
                  <div className={`mt-1 text-xs uppercase tracking-[0.3em] ${isSelected ? "text-white/55" : "text-gray"}`}>
                    / SAR
                  </div>

                  <div className="mt-8 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="display text-2xl">{p.maxCenters === 999 ? "∞" : p.maxCenters}</div>
                      <div className={`text-[10px] uppercase tracking-[0.3em] ${isSelected ? "text-white/55" : "text-gray"}`}>
                        CENTER
                      </div>
                    </div>
                    <div>
                      <div className="display text-2xl">{p.maxSeats === 9999 ? "∞" : p.maxSeats}</div>
                      <div className={`text-[10px] uppercase tracking-[0.3em] ${isSelected ? "text-white/55" : "text-gray"}`}>
                        SEAT
                      </div>
                    </div>
                  </div>

                  <ul className="mt-8 space-y-2">
                    {p.features.map((f) => (
                      <li key={f} className="text-xs">
                        - {f}
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  disabled={isCurrent || isLower}
                  onClick={() => choosePlan(key)}
                  className={`owner-action mt-10 w-full border py-4 text-xs uppercase tracking-[0.3em] disabled:opacity-30 ${
                    isSelected ? "border-white bg-white text-black" : "border-black hover:bg-black hover:text-white"
                  }`}
                >
                  {isCurrent ? "CURRENT PLAN" : isLower ? "-" : isSelected ? "SELECTED - CONTINUE" : sub ? "UPGRADE" : "SELECT"}
                </button>
              </div>
            );
          })}
        </section>
      ) : null}

      {selected && plans ? (
        <section ref={confirmRef} className="px-5 py-8 md:px-12">
          <div className="owner-card-light mx-auto max-w-xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-gray">SELECTED PLAN</p>
                <h2 className="display mt-2 text-4xl">{selected}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="owner-action border border-black px-4 py-2 text-[10px] uppercase tracking-[0.25em] hover:bg-black hover:text-white"
              >
                CHANGE
              </button>
            </div>

            <p className="mt-8 text-xs uppercase tracking-[0.3em] text-gray">PAYMENT METHOD</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {METHODS.map((m) => (
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
              <span className="display mono text-right text-4xl">{plans[selected].monthlyPrice.toLocaleString()}₮</span>
            </div>

            {error ? (
              <div className="mt-4 border border-red-500 bg-red-50 p-4 text-sm text-red-700">{error}</div>
            ) : null}

            <button
              onClick={subscribe}
              disabled={processing}
              className="owner-action mt-6 w-full bg-black px-6 py-5 text-xs uppercase tracking-[0.3em] text-white disabled:opacity-40"
            >
              {processing ? "PROCESSING..." : "CONFIRM PAYMENT ->"}
            </button>
            <p className="mt-3 text-center text-[10px] uppercase tracking-[0.3em] text-gray">
              MOCK PAYMENT - DEMO MODE · AUTO-CONFIRMED
            </p>
          </div>
        </section>
      ) : null}
    </main>
  );
}
