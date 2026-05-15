"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSignIn } from "@clerk/nextjs";

type Mode = "email" | "sms";
type SmsStep = "phone" | "code";

export default function ForgotPasswordPage() {
  const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const [mode, setMode] = useState<Mode>("email");

  // Email flow
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  // SMS flow
  const [phone, setPhone] = useState("");
  const [smsStep, setSmsStep] = useState<SmsStep>("phone");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [smsDone, setSmsDone] = useState(false);
  const [smsError, setSmsError] = useState("");

  const [loading, setLoading] = useState(false);

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setEmailSent(true);
    } finally {
      setLoading(false);
    }
  };

  const sendSmsOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSmsError("");
    try {
      await fetch("/api/auth/forgot-password-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      setSmsStep("code");
    } finally {
      setLoading(false);
    }
  };

  const resetWithSms = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSmsError("");
    try {
      const res = await fetch("/api/auth/reset-password-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code, password }),
      });
      if (res.ok) {
        setSmsDone(true);
      } else {
        const body = await res.json();
        setSmsError(body.error ?? "Алдаа гарлаа");
      }
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
            {mode === "email"
              ? "Enter your account email. The reset link is valid for 15 minutes."
              : "Enter your phone number. A 6-digit code will be sent via SMS. Valid for 10 minutes."}
          </p>
        </div>
        <div className="mono text-xs text-gray">REIHEN · PASSWORD RECOVERY</div>
      </section>

      <section className="flex flex-col justify-center p-10 md:p-16">
        {/* Mode tabs */}
        <div className="flex border border-black mb-8">
          <button
            onClick={() => setMode("email")}
            className={`flex-1 py-3 text-xs uppercase tracking-[0.2em] transition-colors ${
              mode === "email" ? "bg-black text-white" : "hover:bg-black/5"
            }`}
          >
            EMAIL
          </button>
          <button
            onClick={() => setMode("sms")}
            className={`flex-1 py-3 text-xs uppercase tracking-[0.2em] transition-colors ${
              mode === "sms" ? "bg-black text-white" : "hover:bg-black/5"
            }`}
          >
            SMS
          </button>
        </div>

        {/* Email flow */}
        {mode === "email" && clerkEnabled && <ClerkEmailReset />}
        {mode === "email" && !clerkEnabled && (
          <form onSubmit={submitEmail} className="space-y-8">
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
            {emailSent && (
              <div className="border border-black bg-black p-4 text-xs uppercase tracking-[0.2em] text-white">
                If an account exists, reset instructions were sent.
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
        )}

        {/* SMS flow */}
        {mode === "sms" && !smsDone && (
          <>
            {smsStep === "phone" && (
              <form onSubmit={sendSmsOtp} className="space-y-8">
                <div>
                  <label className="text-xs uppercase tracking-[0.3em] text-gray">УТАСНЫ ДУГААР</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    className="mt-2 block w-full border-b-2 border-black bg-transparent pb-3 text-2xl font-black outline-none placeholder:text-gray"
                    placeholder="99001234"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-black px-6 py-5 text-xs uppercase tracking-[0.3em] text-white disabled:opacity-40"
                >
                  {loading ? "..." : "КОД ИЛГЭЭХ"}
                </button>
              </form>
            )}

            {smsStep === "code" && (
              <form onSubmit={resetWithSms} className="space-y-8">
                <div>
                  <label className="text-xs uppercase tracking-[0.3em] text-gray">6 ОРОНТОЙ КОД</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    required
                    maxLength={6}
                    className="mt-2 block w-full border-b-2 border-black bg-transparent pb-3 text-2xl font-black outline-none placeholder:text-gray tracking-[0.5em]"
                    placeholder="______"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.3em] text-gray">ШИНЭ НУУЦ ҮГ</label>
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
                {smsError && (
                  <div className="border border-red-400 bg-red-50 p-3 text-xs text-red-700">
                    {smsError}
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setSmsStep("phone"); setCode(""); setSmsError(""); }}
                    className="flex-1 border border-black px-6 py-5 text-xs uppercase tracking-[0.3em] hover:bg-black/5"
                  >
                    БУЦАХ
                  </button>
                  <button
                    type="submit"
                    disabled={loading || code.length !== 6}
                    className="flex-1 bg-black px-6 py-5 text-xs uppercase tracking-[0.3em] text-white disabled:opacity-40"
                  >
                    {loading ? "..." : "СОЛИХ"}
                  </button>
                </div>
              </form>
            )}
          </>
        )}

        {mode === "sms" && smsDone && (
          <div className="space-y-6">
            <div className="border border-black bg-black p-4 text-xs uppercase tracking-[0.2em] text-white">
              Нууц үг амжилттай солигдлоо.
            </div>
            <Link
              href="/login"
              className="block w-full bg-black px-6 py-5 text-center text-xs uppercase tracking-[0.3em] text-white"
            >
              НЭВТРЭХ
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}

function ClerkEmailReset() {
  const router = useRouter();
  const { isLoaded, signIn, setActive } = useSignIn();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"email" | "code" | "done">("email");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signIn) return;
    setLoading(true);
    setError("");
    try {
      await signIn.create({
        strategy: "reset_password_email_code",
        identifier: email,
      } as any);
      setStep("code");
    } catch (err: any) {
      setError(err?.errors?.[0]?.message ?? "Could not send reset code");
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signIn) return;
    setLoading(true);
    setError("");
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code,
        password,
      } as any);
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        setStep("done");
        router.push("/");
        return;
      }
      setError("Additional verification is required");
    } catch (err: any) {
      setError(err?.errors?.[0]?.message ?? "Invalid code or password");
    } finally {
      setLoading(false);
    }
  };

  if (step === "done") {
    return (
      <div className="space-y-6">
        <div className="border border-black bg-black p-4 text-xs uppercase tracking-[0.2em] text-white">
          Password changed successfully.
        </div>
        <Link href="/" className="block w-full bg-black px-6 py-5 text-center text-xs uppercase tracking-[0.3em] text-white">
          GO HOME
        </Link>
      </div>
    );
  }

  if (step === "code") {
    return (
      <form onSubmit={resetPassword} className="space-y-8">
        <div className="border border-black bg-black p-4 text-xs uppercase tracking-[0.2em] text-white">
          Clerk sent a reset code to {email}.
        </div>
        <div>
          <label className="text-xs uppercase tracking-[0.3em] text-gray">EMAIL CODE</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.trim())}
            required
            className="mt-2 block w-full border-b-2 border-black bg-transparent pb-3 text-2xl font-black outline-none placeholder:text-gray"
            placeholder="123456"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-[0.3em] text-gray">NEW PASSWORD</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="mt-2 block w-full border-b-2 border-black bg-transparent pb-3 text-2xl font-black outline-none placeholder:text-gray"
            placeholder="••••••••"
          />
        </div>
        {error && <div className="border border-red-400 bg-red-50 p-3 text-xs text-red-700">{error}</div>}
        <button type="submit" disabled={loading} className="w-full bg-black px-6 py-5 text-xs uppercase tracking-[0.3em] text-white disabled:opacity-40">
          {loading ? "..." : "RESET WITH CLERK"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={sendCode} className="space-y-8">
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
      <div className="border border-black/20 p-4 text-[10px] uppercase tracking-[0.2em] text-black/45">
        Clerk will send the password reset OTP to this email.
      </div>
      {error && <div className="border border-red-400 bg-red-50 p-3 text-xs text-red-700">{error}</div>}
      <button type="submit" disabled={loading} className="w-full bg-black px-6 py-5 text-xs uppercase tracking-[0.3em] text-white disabled:opacity-40">
        {loading ? "..." : "SEND CLERK OTP"}
      </button>
    </form>
  );
}
