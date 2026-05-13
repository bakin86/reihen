// SMS dispatcher for Reihen.
// SMS_MODE=mock (default) | live
// In mock mode, messages are console-logged and a masked phone string is
// returned so the UI can display: " +976 9911-XXXX руу код илгээгдлээ".
// Flip SMS_MODE=live to route through a real provider (no code changes elsewhere).

export type SmsMode = "mock" | "live";
export const SMS_MODE: SmsMode = (process.env.SMS_MODE as SmsMode) ?? "mock";

export interface SmsResult {
  ok: boolean;
  reference: string;
  phone: string;
  maskedPhone: string;
  uiMessage: string;
  error?: string;
}

const ref = () => `SMS-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;

/** Normalize a Mongolian phone to "+976XXXXXXXX". Accepts 8-digit local or +976 prefix. */
export function normalizeMNPhone(raw: string): string {
  const digits = raw.replace(/\D+/g, "");
  if (digits.startsWith("976")) return `+${digits}`;
  if (digits.length === 8) return `+976${digits}`;
  return `+${digits}`;
}

/** Mask the last 4 digits: "+976 9911-XXXX". */
export function maskPhone(raw: string): string {
  const norm = normalizeMNPhone(raw); // "+976XXXXXXXX"
  const body = norm.slice(4); // 8 digits
  if (body.length !== 8) return norm;
  return `+976 ${body.slice(0, 4)}-XXXX`;
}

export function maskedUiMessage(phone: string): string {
  return `${maskPhone(phone)} руу код илгээгдлээ`;
}

// ─── Mock ────────────────────────────────────────────────
export async function mockSMS(phone: string, message: string): Promise<SmsResult> {
  const masked = maskPhone(phone);
  console.log(`[sms:mock] → ${normalizeMNPhone(phone)} :: ${message}`);
  return {
    ok: true,
    reference: ref(),
    phone: normalizeMNPhone(phone),
    maskedPhone: masked,
    uiMessage: `${masked} руу код илгээгдлээ`,
  };
}

// ─── Live (Unitel/MobiCom gateway) ──────────────────────
async function liveSMS(phone: string, message: string): Promise<SmsResult> {
  const gateway = process.env.SMS_GATEWAY_URL;
  const apiKey = process.env.SMS_API_KEY;
  const sender = process.env.SMS_SENDER ?? "Reihen";
  const masked = maskPhone(phone);
  const normalized = normalizeMNPhone(phone);

  if (!gateway || !apiKey) {
    console.error("[sms] Live mode but SMS_GATEWAY_URL or SMS_API_KEY not set — falling back to mock");
    return mockSMS(phone, message);
  }

  try {
    const res = await fetch(gateway, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        to: normalized,
        from: sender,
        message,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[sms] Gateway error (${res.status}): ${text}`);
      return {
        ok: false, reference: ref(), phone: normalized,
        maskedPhone: masked, uiMessage: "SMS илгээхэд алдаа гарлаа",
        error: `Gateway ${res.status}`,
      };
    }

    const data = await res.json().catch(() => ({}));
    return {
      ok: true,
      reference: data.message_id ?? data.id ?? ref(),
      phone: normalized,
      maskedPhone: masked,
      uiMessage: `${masked} руу илгээгдлээ`,
    };
  } catch (e: any) {
    console.error("[sms] Send failed:", e);
    return {
      ok: false, reference: ref(), phone: normalized,
      maskedPhone: masked, uiMessage: "SMS илгээхэд алдаа гарлаа",
      error: e.message ?? "Network error",
    };
  }
}

// ─── Public dispatcher ───────────────────────────────────
export async function sendSMS(phone: string, message: string): Promise<SmsResult> {
  return SMS_MODE === "live" ? liveSMS(phone, message) : mockSMS(phone, message);
}

// ─── OTP helper ──────────────────────────────────────────
export function generateOTP(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) code += Math.floor(Math.random() * 10);
  return code;
}

export async function sendOTP(phone: string, code: string): Promise<SmsResult> {
  return sendSMS(phone, `Reihen баталгаажуулах код: ${code}. 5 минут хүчинтэй.`);
}

// ─── Booking SMS helpers ────────────────────────────────────

export async function sendBookingConfirm(
  phone: string,
  bookingCode: string,
  centerName: string,
  seatNumber: string,
  time: string
): Promise<SmsResult> {
  return sendSMS(
    phone,
    `Reihen: ${bookingCode} захиалга баталгаажлаа! ${centerName} · ${seatNumber} · ${time}. Цагтаа ирнэ үү!`
  );
}

export async function sendPaymentConfirm(
  phone: string,
  bookingCode: string,
  amount: number
): Promise<SmsResult> {
  return sendSMS(
    phone,
    `Reihen: ${bookingCode} төлбөр амжилттай. ${amount.toLocaleString()}₮. Баярлалаа!`
  );
}

export async function sendBookingCancel(
  phone: string,
  bookingCode: string
): Promise<SmsResult> {
  return sendSMS(
    phone,
    `Reihen: ${bookingCode} захиалга цуцлагдлаа.`
  );
}
