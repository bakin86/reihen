"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.push("/");
    } catch (err: any) {
      setError(err.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen grid-cols-1 md:grid-cols-2" style={{ background: "#0F0E0B" }}>
      {/* LEFT — dark accent panel */}
      <section className="flex flex-col justify-between p-10 md:p-16" style={{ background: "#0C0B09" }}>
        <Link href="/" className="text-xs uppercase tracking-[0.3em] transition-colors"
          style={{ color: "rgba(237,232,224,0.30)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "#EDE8E0")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(237,232,224,0.30)")}
        >
          ← REIHEN
        </Link>
        <div>
          <h1 className="display leading-none" style={{ fontSize: "clamp(72px, 10vw, 140px)", color: "#EDE8E0" }}>
            LOG<br />IN.
          </h1>
          <p className="mt-8 max-w-sm text-sm font-light" style={{ color: "rgba(237,232,224,0.30)" }}>
            Бүртгэлтэй хэрэглэгч имэйл, нууц үгээр нэвтэрнэ үү.
          </p>
        </div>
        <div className="mono text-xs" style={{ color: "rgba(237,232,224,0.20)" }}>REIHEN · 2026</div>
      </section>

      {/* RIGHT — form */}
      <section className="flex flex-col justify-center p-10 md:p-16">
        <form onSubmit={submit} className="space-y-8">
          <div>
            <label className="text-xs uppercase tracking-[0.3em]" style={{ color: "rgba(237,232,224,0.35)" }}>EMAIL</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-2 block w-full bg-transparent pb-3 text-2xl font-black outline-none"
              style={{
                color: "#EDE8E0",
                borderBottom: "1px solid rgba(237,232,224,0.18)",
              }}
              placeholder="email@example.com"
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs uppercase tracking-[0.3em]" style={{ color: "rgba(237,232,224,0.35)" }}>PASSWORD</label>
              <Link href="/forgot-password" className="text-[10px] uppercase tracking-[0.2em] underline underline-offset-4 transition-colors"
                style={{ color: "rgba(237,232,224,0.25)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#EDE8E0")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(237,232,224,0.25)")}
              >
                Forgot?
              </Link>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="mt-2 block w-full bg-transparent pb-3 text-2xl font-black outline-none"
              style={{
                color: "#EDE8E0",
                borderBottom: "1px solid rgba(237,232,224,0.18)",
              }}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="px-4 py-3 text-[11px] uppercase tracking-[0.25em]"
              style={{ background: "rgba(239,68,68,0.1)", color: "rgba(239,68,68,0.8)" }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-4 text-xs uppercase tracking-[0.3em] font-semibold transition-all disabled:opacity-40"
            style={{ background: "#F5C000", color: "#0C0B09" }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = "#EDE8E0"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#F5C000"; }}
          >
            {loading ? "..." : "НЭВТРЭХ →"}
          </button>

          <p className="text-xs uppercase tracking-[0.3em]" style={{ color: "rgba(237,232,224,0.30)" }}>
            Бүртгэлгүй юу?{" "}
            <Link href="/register" className="underline transition-colors"
              style={{ color: "#EDE8E0" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#F5C000")}
              onMouseLeave={e => (e.currentTarget.style.color = "#EDE8E0")}
            >
              БҮРТГҮҮЛЭХ
            </Link>
          </p>
        </form>
      </section>
    </main>
  );
}
