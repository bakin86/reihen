/**
 * QPay Integration for Reihen
 *
 * PAYMENT_MODE:
 *   "mock"    → fake QR, auto-confirms (dev/demo)
 *   "sandbox" → real QPay sandbox API (https://merchant-sandbox.qpay.mn)
 *   "live"    → production QPay API (https://merchant.qpay.mn)
 *
 * Flow:
 *   1. getToken()        → cached access_token
 *   2. createInvoice()   → QR image, deeplinks
 *   3. callback (GET)    → QPay hits our /api/qpay/callback
 *   4. checkPayment()    → verify PAID status
 *   5. createEbarimt()   → e-barimt receipt
 *   6. cancelInvoice()   → on booking cancel
 *   7. refundPayment()   → on refund
 */

// ─── Config ─────────────────────────────────────────────────

export type QPayMode = "mock" | "sandbox" | "live";
export const QPAY_MODE: QPayMode =
  (process.env.PAYMENT_MODE as QPayMode) ?? "mock";

if (QPAY_MODE === "live") {
  const missing = ["QPAY_USERNAME", "QPAY_PASSWORD", "QPAY_INVOICE_CODE"].filter(
    (k) => !process.env[k]
  );
  if (missing.length) {
    throw new Error(`QPay live mode requires: ${missing.join(", ")}`);
  }
}

const CONFIG = {
  sandbox: {
    baseUrl: "https://merchant-sandbox.qpay.mn",
    username: process.env.QPAY_USERNAME ?? "TEST_MERCHANT",
    password: process.env.QPAY_PASSWORD ?? "123456",
    invoiceCode: process.env.QPAY_INVOICE_CODE ?? "TEST_INVOICE",
    ebarimtPath: "/v2/ebarimt_v3/create",
  },
  live: {
    baseUrl: "https://merchant.qpay.mn",
    username: process.env.QPAY_USERNAME!,
    password: process.env.QPAY_PASSWORD!,
    invoiceCode: process.env.QPAY_INVOICE_CODE!,
    ebarimtPath: "/v2/ebarimt/create",
  },
} as const;

function getConfig() {
  if (QPAY_MODE === "mock") return CONFIG.sandbox; // not used, but safe fallback
  return QPAY_MODE === "live" ? CONFIG.live : CONFIG.sandbox;
}

if (QPAY_MODE !== "mock" && !process.env.NEXT_PUBLIC_APP_URL) {
  throw new Error("NEXT_PUBLIC_APP_URL must be set when PAYMENT_MODE is sandbox or live — QPay needs it to send payment callbacks");
}
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// ─── Token Cache ────────────────────────────────────────────

let tokenCache: { accessToken: string; expiresAt: number } | null = null;

export async function getToken(): Promise<string> {
  // Return cached token if still valid (with 60s safety margin)
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.accessToken;
  }

  const cfg = getConfig();
  const basic = Buffer.from(`${cfg.username}:${cfg.password}`).toString("base64");

  const res = await fetch(`${cfg.baseUrl}/v2/auth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`QPay auth failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  // QPay returns: { access_token, token_type, expires_in, refresh_token, ... }
  tokenCache = {
    accessToken: data.access_token,
    // expires_in is in seconds
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };

  return tokenCache.accessToken;
}

// ─── Types ──────────────────────────────────────────────────

export interface QPayInvoice {
  invoiceId: string;
  qrImage: string;       // base64 PNG
  qrText: string;
  shortUrl: string;
  deeplinks: { name: string; link: string }[];
}

export interface QPayPaymentRow {
  payment_id: string;
  payment_status: string;
  payment_amount: number;
  payment_date: string;
}

export interface QPayCheckResult {
  paid: boolean;
  paymentId: string | null;
  rows: QPayPaymentRow[];
}

// ─── Create Invoice ─────────────────────────────────────────

export async function createInvoice(
  bookingCode: string,
  amount: number
): Promise<QPayInvoice> {
  const cfg = getConfig();
  const token = await getToken();

  const body = {
    invoice_code: cfg.invoiceCode,
    sender_invoice_no: bookingCode,       // #BK code — unique per booking
    invoice_receiver_code: "terminal",
    invoice_description: `Reihen - ${bookingCode}`,
    sender_branch_code: "SALBAR1",
    amount,
    callback_url: `${APP_URL}/api/qpay/callback`,
  };

  const res = await fetch(`${cfg.baseUrl}/v2/invoice`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`QPay createInvoice failed (${res.status}): ${text}`);
  }

  const data = await res.json();

  return {
    invoiceId: data.invoice_id,
    qrImage: data.qr_image,               // base64 PNG
    qrText: data.qr_text,
    shortUrl: data.qPay_shortUrl ?? "",
    deeplinks: (data.urls ?? []).map((u: any) => ({
      name: u.name,
      link: u.link,
    })),
  };
}

// ─── Check Payment ──────────────────────────────────────────

export async function checkPayment(invoiceId: string): Promise<QPayCheckResult> {
  const cfg = getConfig();
  const token = await getToken();

  const res = await fetch(`${cfg.baseUrl}/v2/payment/check`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      object_type: "INVOICE",
      object_id: invoiceId,
      offset: { page_number: 1, page_limit: 100 },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`QPay checkPayment failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const rows: QPayPaymentRow[] = data.rows ?? [];
  const paidRow = rows.find((r) => r.payment_status === "PAID");

  return {
    paid: !!paidRow,
    paymentId: paidRow?.payment_id ?? null,
    rows,
  };
}

// ─── Create E-Barimt ────────────────────────────────────────

export async function createEbarimt(paymentId: string): Promise<any> {
  const cfg = getConfig();
  const token = await getToken();

  const res = await fetch(`${cfg.baseUrl}${cfg.ebarimtPath}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      payment_id: paymentId,
      ebarimt_receiver_type: "CITIZEN",
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[qpay] ebarimt failed (${res.status}): ${text}`);
    return null; // Non-fatal — booking still valid
  }

  return res.json();
}

// ─── Cancel Invoice ─────────────────────────────────────────

export async function cancelInvoice(invoiceId: string): Promise<boolean> {
  const cfg = getConfig();
  const token = await getToken();

  const res = await fetch(`${cfg.baseUrl}/v2/invoice/${invoiceId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[qpay] cancelInvoice failed (${res.status}): ${text}`);
    return false;
  }
  return true;
}

// ─── Refund Payment ─────────────────────────────────────────

export async function refundPayment(paymentId: string): Promise<boolean> {
  const cfg = getConfig();
  const token = await getToken();

  const res = await fetch(`${cfg.baseUrl}/v2/payment/refund/${paymentId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[qpay] refundPayment failed (${res.status}): ${text}`);
    return false;
  }
  return true;
}
