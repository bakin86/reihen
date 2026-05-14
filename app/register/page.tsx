"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
  });
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
      // OWNER → subscription page, PLAYER → home
      router.push(role === "OWNER" ? "/owner/subscription" : "/");
    } catch (err: any) {
      setError(err.message ?? "Registration failed");
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
          <h1 className="display text-[14vw] md:text-[7vw]">
            SIGN<br />UP.
          </h1>
          <p className="mt-8 max-w-sm text-sm font-light text-gray">
            Тоглогч эсвэл PC Center эзэмшигч бүртгэл үүсгэх.
          </p>
        </div>
        <div className="mono text-xs text-gray">REIHEN · 2026</div>
      </section>

      {/* RIGHT */}
      <section className="flex flex-col justify-center p-10 md:p-16">
        <form onSubmit={submit} className="space-y-6">
          {/* Role selector */}
          <div>
            <label className="text-xs uppercase tracking-[0.3em] text-gray">БҮРТГЭЛИЙН ТӨРӨЛ</label>
            <div className="mt-3 grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => setRole("PLAYER")}
                className={`py-4 text-xs uppercase tracking-[0.3em] transition-colors ${
                  role === "PLAYER" ? "bg-black text-white" : "bg-black/[0.04] hover:bg-black hover:text-white"
                }`}
              >
                ТОГЛОГЧ
              </button>
              <button
                type="button"
                onClick={() => setRole("OWNER")}
                className={`py-4 text-xs uppercase tracking-[0.3em] transition-colors ${
                  role === "OWNER" ? "bg-black text-white" : "bg-black/[0.04] hover:bg-black hover:text-white"
                }`}
              >
                PC CENTER ЭЗЭН
              </button>
            </div>
            {role === "OWNER" && (
              <p className="mt-2 text-[10px] uppercase tracking-[0.3em] text-gray">
                Бүртгүүлсний дараа багц сонгох хуудас руу шилжинэ
              </p>
            )}
          </div>

          <Field label="NAME" type="text" value={form.name} onChange={set("name")} placeholder="Баатар" required />
          <Field label="EMAIL" type="email" value={form.email} onChange={set("email")} placeholder="email@example.com" required />
          <Field label="PHONE" type="tel" value={form.phone} onChange={set("phone")} placeholder="99112233" required pattern="\d{8,12}" />
          <Field label="PASSWORD" type="password" value={form.password} onChange={set("password")} placeholder="••••••••" required minLength={6} />

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
            {loading ? "..." : role === "OWNER" ? "БҮРТГҮҮЛЭХ → БАГЦ СОНГОХ" : "БҮРТГҮҮЛЭХ →"}
          </button>

          <p className="text-xs uppercase tracking-[0.3em] text-gray">
            Бүртгэлтэй юу?{" "}
            <Link href="/login" className="text-black underline">
              НЭВТРЭХ
            </Link>
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
      <label className="text-xs uppercase tracking-[0.3em] text-gray">{label}</label>
      <input
        {...rest}
        className="mt-2 block w-full border-b-2 border-black bg-transparent pb-3 text-xl font-black outline-none placeholder:text-gray"
      />
    </div>
  );
}
