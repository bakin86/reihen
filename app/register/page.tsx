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
    <main className="grid min-h-screen grid-cols-1 md:grid-cols-2" style={{ background: "#0F0E0B" }}>
      {/* LEFT */}
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
            SIGN<br />UP.
          </h1>
          <p className="mt-8 max-w-sm text-sm font-light" style={{ color: "rgba(237,232,224,0.30)" }}>
            Тоглогч эсвэл PC Center эзэмшигч бүртгэл үүсгэх.
          </p>
        </div>
        <div className="mono text-xs" style={{ color: "rgba(237,232,224,0.20)" }}>REIHEN · 2026</div>
      </section>

      {/* RIGHT */}
      <section className="flex flex-col justify-center p-10 md:p-16">
        <form onSubmit={submit} className="space-y-6">
          {/* Role selector */}
          <div>
            <label className="text-xs uppercase tracking-[0.3em]" style={{ color: "rgba(237,232,224,0.35)" }}>
              БҮРТГЭЛИЙН ТӨРӨЛ
            </label>
            <div className="mt-3 grid grid-cols-2 gap-1">
              {(["PLAYER", "OWNER"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className="py-4 text-xs uppercase tracking-[0.3em] transition-all"
                  style={role === r
                    ? { background: "#F5C000", color: "#0C0B09", fontWeight: 600 }
                    : { background: "rgba(237,232,224,0.05)", color: "rgba(237,232,224,0.40)" }
                  }
                  onMouseEnter={e => { if (role !== r) e.currentTarget.style.background = "rgba(237,232,224,0.09)"; }}
                  onMouseLeave={e => { if (role !== r) e.currentTarget.style.background = "rgba(237,232,224,0.05)"; }}
                >
                  {r === "PLAYER" ? "ТОГЛОГЧ" : "PC CENTER ЭЗЭН"}
                </button>
              ))}
            </div>
            {role === "OWNER" && (
              <p className="mt-2 text-[10px] uppercase tracking-[0.3em]" style={{ color: "rgba(237,232,224,0.25)" }}>
                Бүртгүүлсний дараа багц сонгох хуудас руу шилжинэ
              </p>
            )}
          </div>

          <Field label="NAME"     type="text"     value={form.name}     onChange={set("name")}     placeholder="Баатар"            required />
          <Field label="EMAIL"    type="email"    value={form.email}    onChange={set("email")}    placeholder="email@example.com" required />
          <Field label="PHONE"    type="tel"      value={form.phone}    onChange={set("phone")}    placeholder="99112233"          required pattern="\d{8,12}" />
          <Field label="PASSWORD" type="password" value={form.password} onChange={set("password")} placeholder="••••••••"          required minLength={6} />

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
            {loading ? "..." : role === "OWNER" ? "БҮРТГҮҮЛЭХ → БАГЦ СОНГОХ" : "БҮРТГҮҮЛЭХ →"}
          </button>

          <p className="text-xs uppercase tracking-[0.3em]" style={{ color: "rgba(237,232,224,0.30)" }}>
            Бүртгэлтэй юу?{" "}
            <Link href="/login" className="underline transition-colors"
              style={{ color: "#EDE8E0" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#F5C000")}
              onMouseLeave={e => (e.currentTarget.style.color = "#EDE8E0")}
            >
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
      <label className="text-xs uppercase tracking-[0.3em]" style={{ color: "rgba(237,232,224,0.35)" }}>{label}</label>
      <input
        {...rest}
        className="mt-2 block w-full bg-transparent pb-3 text-xl font-black outline-none"
        style={{
          color: "#EDE8E0",
          borderBottom: "1px solid rgba(237,232,224,0.18)",
        }}
      />
    </div>
  );
}
