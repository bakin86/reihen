"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [role, setRole] = useState<"PLAYER" | "OWNER">("PLAYER");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register({ ...form, role });
      router.push(role === "OWNER" ? "/owner/subscription" : "/");
    } catch (err: any) {
      setError(err.message ?? "Registration failed");
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
            SIGN<br />UP.
          </h1>
          <p className="mt-8 max-w-sm text-sm font-light text-white/30">
            Тоглогч эсвэл PC Center эзэмшигч бүртгэл үүсгэх.
          </p>
        </div>
        <div className="mono text-xs text-white/20">REIHEN · 2026</div>
      </section>

      {/* RIGHT */}
      <section className="flex flex-col justify-center p-10 md:p-16">
        <form onSubmit={submit} className="space-y-6">
          <div>
            <label className="text-[10px] font-medium uppercase tracking-[0.3em] text-black/35">БҮРТГЭЛИЙН ТӨРӨЛ</label>
            <div className="mt-3 grid grid-cols-2 gap-1">
              {(["PLAYER", "OWNER"] as const).map((r) => (
                <button
                  key={r} type="button" onClick={() => setRole(r)}
                  className={`py-4 text-[10px] font-semibold uppercase tracking-[0.2em] transition-all ${
                    role === r ? "bg-black text-white" : "bg-black/[0.05] text-black/40 hover:bg-black/[0.08]"
                  }`}
                >
                  {r === "PLAYER" ? "ТОГЛОГЧ" : "PC CENTER ЭЗЭН"}
                </button>
              ))}
            </div>
            {role === "OWNER" && (
              <p className="mt-2 text-[9px] font-medium uppercase tracking-[0.25em] text-black/25">
                Бүртгүүлсний дараа багц сонгох хуудас руу шилжинэ
              </p>
            )}
          </div>

          <Field label="NAME"     type="text"     value={form.name}     onChange={set("name")}     placeholder="Баатар"            required />
          <Field label="EMAIL"    type="email"    value={form.email}    onChange={set("email")}    placeholder="email@example.com" required />
          <Field label="PHONE"    type="tel"      value={form.phone}    onChange={set("phone")}    placeholder="99112233"          required pattern="\d{8,12}" />
          <Field label="PASSWORD" type="password" value={form.password} onChange={set("password")} placeholder="••••••••"          required minLength={6} />

          {error && (
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-red-500/80">{error}</p>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full bg-black py-4 text-[11px] font-semibold uppercase tracking-[0.3em] text-white transition-opacity hover:opacity-60 disabled:opacity-30"
          >
            {loading ? "..." : role === "OWNER" ? "БҮРТГҮҮЛЭХ → БАГЦ СОНГОХ" : "БҮРТГҮҮЛЭХ →"}
          </button>

          <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-black/30">
            Бүртгэлтэй юу?{" "}
            <Link href="/login" className="text-black underline transition-colors hover:opacity-50">НЭВТРЭХ</Link>
          </p>
        </form>
      </section>
    </main>
  );
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <div>
      <label className="text-[10px] font-medium uppercase tracking-[0.3em] text-black/35">{label}</label>
      <input
        {...rest}
        className="mt-2 block w-full bg-transparent pb-3 text-xl font-black text-black outline-none placeholder:text-black/15"
        style={{ borderBottom: "1px solid rgba(0,0,0,0.15)" }}
      />
    </div>
  );
}
