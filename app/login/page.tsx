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
    <main className="grid min-h-screen grid-cols-1 bg-white md:grid-cols-2">
      {/* LEFT */}
      <section className="flex flex-col justify-between bg-black p-10 md:p-16">
        <Link href="/" className="text-[10px] font-medium uppercase tracking-[0.3em] text-white/30 transition-colors hover:text-white">
          ← REIHEN
        </Link>
        <div>
          <h1
            className="font-black text-white"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(72px, 10vw, 160px)",
              lineHeight: 0.84,
              letterSpacing: "-0.05em",
              fontWeight: 900,
            }}
          >
            LOG<br />IN.
          </h1>
          <p className="mt-8 max-w-sm text-sm font-light text-white/30">
            Бүртгэлтэй хэрэглэгч имэйл, нууц үгээр нэвтэрнэ үү.
          </p>
        </div>
        <div className="mono text-xs text-white/20">REIHEN · 2026</div>
      </section>

      {/* RIGHT */}
      <section className="flex flex-col justify-center p-10 md:p-16">
        <form onSubmit={submit} className="space-y-8">
          <div>
            <label className="text-[10px] font-medium uppercase tracking-[0.3em] text-black/35">EMAIL</label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="mt-2 block w-full bg-transparent pb-3 text-2xl font-black text-black outline-none placeholder:text-black/15"
              style={{ borderBottom: "1px solid rgba(0,0,0,0.15)" }}
              placeholder="email@example.com"
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-medium uppercase tracking-[0.3em] text-black/35">PASSWORD</label>
              <Link href="/forgot-password" className="text-[10px] font-medium uppercase tracking-[0.2em] text-black/25 underline underline-offset-4 transition-colors hover:text-black">
                Forgot?
              </Link>
            </div>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
              className="mt-2 block w-full bg-transparent pb-3 text-2xl font-black text-black outline-none placeholder:text-black/15"
              style={{ borderBottom: "1px solid rgba(0,0,0,0.15)" }}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-red-500/80">{error}</p>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full bg-black py-4 text-[11px] font-semibold uppercase tracking-[0.3em] text-white transition-opacity hover:opacity-60 disabled:opacity-30"
          >
            {loading ? "..." : "НЭВТРЭХ →"}
          </button>

          <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-black/30">
            Бүртгэлгүй юу?{" "}
            <Link href="/register" className="text-black underline transition-colors hover:opacity-50">
              БҮРТГҮҮЛЭХ
            </Link>
          </p>
        </form>
      </section>
    </main>
  );
}
