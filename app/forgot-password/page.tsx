"use client";
import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen grid-cols-1 md:grid-cols-2">
      <section className="flex flex-col justify-between bg-black p-10 text-white md:p-16">
        <Link href="/login" className="text-xs uppercase tracking-[0.3em] text-gray">← LOGIN</Link>
        <div>
          <h1 className="display text-[13vw] md:text-[7vw]">RESET<br />PASS.</h1>
          <p className="mt-8 max-w-sm text-sm font-light text-gray">
            Enter your account email. The reset link is valid for 15 minutes.
          </p>
        </div>
        <div className="mono text-xs text-gray">REIHEN · PASSWORD RECOVERY</div>
      </section>

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

          {sent && (
            <div className="border border-black bg-black p-4 text-xs uppercase tracking-[0.2em] text-white">
              If an account exists, reset instructions were sent. In local mode, check the terminal log.
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black px-6 py-5 text-xs uppercase tracking-[0.3em] text-white disabled:opacity-40"
          >
            {loading ? "..." : "SEND RESET LINK"}
          </button>
        </form>
      </section>
    </main>
  );
}
