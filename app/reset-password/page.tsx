"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center">LOADING...</main>}>
      <ResetPasswordInner />
    </Suspense>
  );
}

function ResetPasswordInner() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    if (password !== confirm) {
      setMessage("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Reset failed");
      setOk(true);
      setMessage("Password updated. You can login now.");
    } catch (err: any) {
      setMessage(err.message ?? "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen grid-cols-1 md:grid-cols-2">
      <section className="flex flex-col justify-between bg-black p-10 text-white md:p-16">
        <Link href="/login" className="text-xs uppercase tracking-[0.3em] text-gray">← LOGIN</Link>
        <div>
          <h1 className="display text-[13vw] md:text-[7vw]">NEW<br />PASS.</h1>
          <p className="mt-8 max-w-sm text-sm font-light text-gray">
            Choose a new password for your Reihen account.
          </p>
        </div>
        <div className="mono text-xs text-gray">RESET LINK EXPIRES IN 15 MIN</div>
      </section>

      <section className="flex flex-col justify-center p-10 md:p-16">
        {!token ? (
          <div className="space-y-6">
            <p className="text-sm uppercase tracking-[0.2em] text-gray">Missing reset token.</p>
            <Link href="/forgot-password" className="inline-block bg-black px-6 py-4 text-xs uppercase tracking-[0.3em] text-white">
              Request new link
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-8">
            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-gray">NEW PASSWORD</label>
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
            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-gray">CONFIRM</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
                className="mt-2 block w-full border-b-2 border-black bg-transparent pb-3 text-2xl font-black outline-none placeholder:text-gray"
                placeholder="••••••••"
              />
            </div>

            {message && (
              <div className={`border p-4 text-xs uppercase tracking-[0.2em] ${ok ? "border-green-600 bg-green-50 text-green-700" : "border-black bg-black text-white"}`}>
                {message}
              </div>
            )}

            {ok ? (
              <Link href="/login" className="block w-full bg-black px-6 py-5 text-center text-xs uppercase tracking-[0.3em] text-white">
                Go to login
              </Link>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-black px-6 py-5 text-xs uppercase tracking-[0.3em] text-white disabled:opacity-40"
              >
                {loading ? "..." : "UPDATE PASSWORD"}
              </button>
            )}
          </form>
        )}
      </section>
    </main>
  );
}
