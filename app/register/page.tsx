"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SignUp } from "@clerk/nextjs";
import { useAuth } from "@/lib/useAuth";

export default function RegisterPage() {
  const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [role, setRole] = useState<"PLAYER" | "OWNER">("PLAYER");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showLegacy, setShowLegacy] = useState(!clerkEnabled);

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
      <section className="flex flex-col justify-between bg-black p-10 md:p-16">
        <Link href="/" className="text-[10px] font-medium uppercase tracking-[0.3em] text-white/30 transition-colors hover:text-white">
          REIHEN
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
            Create a player or PC center owner account.
          </p>
        </div>
        <div className="mono text-xs text-white/20">REIHEN · 2026</div>
      </section>

      <section className="flex flex-col justify-center p-6 md:p-16">
        <div className="mx-auto mb-5 w-full max-w-[430px]">
          <label className="text-[10px] font-medium uppercase tracking-[0.3em] text-black/35">ACCOUNT TYPE</label>
          <div className="mt-3 grid grid-cols-2 gap-1">
            {(["PLAYER", "OWNER"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`py-4 text-[10px] font-semibold uppercase tracking-[0.2em] transition-all ${
                  role === r ? "bg-black text-white" : "bg-black/[0.05] text-black/40 hover:bg-black/[0.08]"
                }`}
              >
                {r === "PLAYER" ? "PLAYER" : "PC OWNER"}
              </button>
            ))}
          </div>
        </div>

        {clerkEnabled && (
          <div className="mx-auto w-full max-w-[430px]">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-black/45">SECURE SIGN UP</p>
              <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-black/25">EMAIL OTP READY</span>
            </div>
            <SignUp
              routing="hash"
              signInUrl="/login"
              fallbackRedirectUrl={role === "OWNER" ? "/owner/subscription" : "/"}
              unsafeMetadata={{ role, phone: form.phone }}
              appearance={{
                layout: {
                  socialButtonsPlacement: "bottom",
                  socialButtonsVariant: "blockButton",
                },
                elements: {
                  rootBox: "w-full",
                  card: "w-full rounded-none border border-black/10 bg-white shadow-none",
                  headerTitle: "text-black text-xl font-black",
                  headerSubtitle: "text-black/40",
                  socialButtonsBlockButton: "rounded-none border-black/10",
                  formFieldInput: "rounded-none border-black/15 focus:border-black focus:ring-0",
                  footerActionLink: "text-black font-semibold",
                  formButtonPrimary: "bg-black hover:bg-black/80",
                },
              }}
            />
            <button
              type="button"
              onClick={() => setShowLegacy((v) => !v)}
              className="mt-4 w-full border border-black/10 bg-white px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.25em] text-black/35 transition-colors hover:border-black/30 hover:text-black"
            >
              {showLegacy ? "Hide legacy sign up" : "Use legacy demo sign up"}
            </button>
          </div>
        )}

        {showLegacy && (
          <form onSubmit={submit} className={`mx-auto w-full max-w-[430px] space-y-6 ${clerkEnabled ? "mt-6" : ""}`}>
            {clerkEnabled && (
              <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-black/25">
                Legacy registration remains for seeded demo and staff flows
              </p>
            )}

            <Field label="NAME" type="text" value={form.name} onChange={set("name")} placeholder="Baatar" required />
            <Field label="EMAIL" type="email" value={form.email} onChange={set("email")} placeholder="email@example.com" required />
            <Field label="PHONE" type="tel" value={form.phone} onChange={set("phone")} placeholder="99112233" required pattern="\d{8,12}" />
            <Field label="PASSWORD" type="password" value={form.password} onChange={set("password")} placeholder="••••••••" required minLength={6} />

            {error && (
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-red-500/80">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black py-4 text-[11px] font-semibold uppercase tracking-[0.3em] text-white transition-opacity hover:opacity-60 disabled:opacity-30"
            >
              {loading ? "..." : role === "OWNER" ? "CREATE OWNER ACCOUNT" : "CREATE PLAYER ACCOUNT"}
            </button>

            <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-black/30">
              Already registered?{" "}
              <Link href="/login" className="text-black underline transition-colors hover:opacity-50">LOGIN</Link>
            </p>
          </form>
        )}
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
