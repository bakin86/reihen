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
    <main className="grid min-h-screen grid-cols-1 md:grid-cols-2">
      {/* LEFT */}
      <section className="flex flex-col justify-between bg-black p-10 text-white md:p-16">
        <Link href="/" className="text-xs uppercase tracking-[0.3em] text-gray">
          ← REIHEN
        </Link>
        <div>
          <h1 className="display text-[14vw] md:text-[8vw]">
            LOG<br />IN.
          </h1>
          <p className="mt-8 max-w-sm text-sm font-light text-gray">
            Бүртгэлтэй хэрэглэгч имэйл, нууц үгээр нэвтэрнэ үү.
          </p>
        </div>
        <div className="mono text-xs text-gray">REIHEN · 2026</div>
      </section>

      {/* RIGHT */}
      <section className="flex flex-col justify-center p-10 md:p-16">
        <form onSubmit={submit} className="space-y-8">
          <div>
            <label className="text-xs uppercase tracking-[0.3em] text-gray">EMAIL</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-2 block w-full border-b-2 border-black bg-transparent pb-3 text-2xl font-black outline-none placeholder:text-gray"
              placeholder="email@example.com"
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs uppercase tracking-[0.3em] text-gray">PASSWORD</label>
              <Link href="/forgot-password" className="text-[10px] uppercase tracking-[0.2em] text-gray underline underline-offset-4 hover:text-black">
                Forgot?
              </Link>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="mt-2 block w-full border-b-2 border-black bg-transparent pb-3 text-2xl font-black outline-none placeholder:text-gray"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-black px-4 py-3 text-[11px] uppercase tracking-[0.25em] text-white/70">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black px-6 py-5 text-xs uppercase tracking-[0.3em] text-white disabled:opacity-40"
          >
            {loading ? "..." : "НЭВТРЭХ →"}
          </button>

          <p className="text-xs uppercase tracking-[0.3em] text-gray">
            Бүртгэлгүй юу?{" "}
            <Link href="/register" className="text-black underline">
              БҮРТГҮҮЛЭХ
            </Link>
          </p>
        </form>
      </section>
    </main>
  );
}
