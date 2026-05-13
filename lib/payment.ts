import { prisma } from "./prisma";
import type { PaymentMethod } from "@prisma/client";
import {
  QPAY_MODE,
  createInvoice as qpayCreateInvoice,
  cancelInvoice as qpayCancelInvoice,
  refundPayment as qpayRefundPayment,
} from "./qpay";

// ─── Mode switch ─────────────────────────────────────────
// PAYMENT_MODE=mock (demo) | sandbox (QPay sandbox) | live (production)
export type PaymentMode = "mock" | "sandbox" | "live";
export const PAYMENT_MODE: PaymentMode =
  (process.env.PAYMENT_MODE as PaymentMode) ?? "mock";

// ─── Types ───────────────────────────────────────────────
export interface PaymentResult {
  ok: boolean;
  reference: string;
  method: PaymentMethod;
  amount: number;
  /** If true, payment is not yet confirmed. UI should show QR and wait for callback. */
  pending?: boolean;
  qrImage?: string;      // base64 QR PNG (QPay)
  qrText?: string;       // QR text (QPay)
  shortUrl?: string;      // Short URL (QPay)
  deeplinks?: { name: string; link: string }[];  // Bank app deeplinks
  invoiceId?: string;     // QPay invoice ID for tracking
  qrUrl?: string;         // legacy mock QR URL
  error?: string;
}

// ─── Helpers ─────────────────────────────────────────────
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ref = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
const placeholderQR = (payload: string) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(payload)}`;

// ─── QPay ────────────────────────────────────────────────

/**
 * Mock QPay: returns pending with fake QR + deeplinks (mimics real flow).
 * Schedules auto-confirm via /api/qpay/mock-confirm after 5 seconds.
 */
export async function mockQPay(bookingCode: string, amount: number): Promise<PaymentResult> {
  const invoiceId = ref("MOCK-INV");
  const qrText = `qpay_mock:${invoiceId}:${amount}`;

  // Schedule auto-confirm after 5s (fire-and-forget, mock mode only)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
  if (!process.env.NEXT_PUBLIC_APP_URL) {
    console.warn("[qpay:mock] NEXT_PUBLIC_APP_URL not set — callback will hit localhost:3000");
  }
  setTimeout(async () => {
    try {
      const url = `${appUrl}/api/qpay/callback?qpay_payment_id=${invoiceId}&mock=1`;
      await fetch(url);
      console.log(`[qpay:mock] Auto-confirmed invoice ${invoiceId}`);
    } catch (e) {
      console.error(`[qpay:mock] Auto-confirm failed:`, e);
    }
  }, 5000);

  return {
    ok: true,
    pending: true,
    reference: invoiceId,
    method: "QPAY",
    amount,
    invoiceId,
    qrImage: "", // no base64 in mock
    qrText,
    shortUrl: placeholderQR(qrText),
    deeplinks: [],
  };
}

/**
 * Real QPay (sandbox or live):
 * Creates invoice → returns QR + deeplinks.
 * Payment is PENDING until QPay calls our callback.
 */
export async function realQPay(
  bookingCode: string,
  amount: number
): Promise<PaymentResult> {
  try {
    const inv = await qpayCreateInvoice(bookingCode, amount);
    return {
      ok: true,
      pending: true,  // Not paid yet! Waiting for callback.
      reference: inv.invoiceId,
      method: "QPAY",
      amount,
      qrImage: inv.qrImage,
      qrText: inv.qrText,
      shortUrl: inv.shortUrl,
      deeplinks: inv.deeplinks,
      invoiceId: inv.invoiceId,
    };
  } catch (e: any) {
    console.error("[payment] QPay createInvoice failed:", e);
    return {
      ok: false,
      reference: "",
      method: "QPAY",
      amount,
      error: "QPay invoice creation failed",  // never expose internal error details
    };
  }
}

export function processQPay(bookingCode: string, amount: number) {
  if (PAYMENT_MODE === "mock") return mockQPay(bookingCode, amount);
  return realQPay(bookingCode, amount);
}

// ─── Wallet balance (always real DB) ─────────────────────
export async function processBalance(userId: string, amount: number): Promise<PaymentResult> {
  if (amount <= 0) {
    return { ok: false, reference: "", method: "BALANCE", amount, error: "Invalid amount" };
  }
  try {
    // Use transaction with row-level lock to prevent double-deduct race condition
    const ok = await prisma.$transaction(async (tx) => {
      // SELECT ... FOR UPDATE locks the row until transaction commits
      const rows: { balance: number }[] = await tx.$queryRaw`SELECT balance FROM User WHERE id = ${userId} FOR UPDATE`;
      if (!rows.length || rows[0].balance < amount) return false;
      await tx.user.update({
        where: { id: userId },
        data: { balance: { decrement: amount } },
      });
      return true;
    });
    if (!ok) {
      return { ok: false, reference: "", method: "BALANCE", amount, error: "Insufficient balance" };
    }
    return { ok: true, reference: ref("BAL"), method: "BALANCE", amount };
  } catch (e: any) {
    console.error("[payment] processBalance error:", e);
    return { ok: false, reference: "", method: "BALANCE", amount, error: "Payment processing failed" };
  }
}

export async function refundBalance(userId: string, amount: number): Promise<PaymentResult> {
  if (amount <= 0) return { ok: true, reference: "noop", method: "BALANCE", amount: 0 };
  await prisma.user.update({
    where: { id: userId },
    data: { balance: { increment: amount } },
  });
  return { ok: true, reference: ref("REFUND"), method: "BALANCE", amount };
}

// ─── Unified dispatcher (used by booking routes) ────────

export async function processPayment(
  userId: string,
  amount: number,
  method: PaymentMethod,
  bookingCode?: string
): Promise<PaymentResult> {
  switch (method) {
    case "BALANCE":
      return processBalance(userId, amount);
    case "QPAY":
      return processQPay(bookingCode ?? ref("BK"), amount);
    default:
      return { ok: false, reference: "", method, amount, error: "Unknown method" };
  }
}

export async function processRefund(
  userId: string,
  amount: number,
  method: PaymentMethod,
  qpayPaymentId?: string | null
): Promise<PaymentResult> {
  if (amount <= 0) return { ok: true, reference: "noop", method, amount: 0 };
  if (method === "BALANCE") return refundBalance(userId, amount);

  // QPay refund via API in sandbox/live mode
  if (method === "QPAY" && PAYMENT_MODE !== "mock" && qpayPaymentId) {
    const ok = await qpayRefundPayment(qpayPaymentId);
    if (!ok) {
      console.error(`[payment] QPay refund failed for paymentId=${qpayPaymentId}`);
    }
    return { ok, reference: qpayPaymentId, method, amount };
  }

  // Mock or other gateways
  if (PAYMENT_MODE === "mock") {
    console.log(`[payment:mock] refund ${amount}₮ via ${method} for user=${userId}`);
  }
  return { ok: true, reference: ref(`REFUND-${method}`), method, amount };
}

/**
 * Cancel a QPay invoice (when booking is cancelled before payment).
 * Only applicable when PAYMENT_MODE is sandbox/live.
 */
export async function cancelQPayInvoice(invoiceId: string): Promise<boolean> {
  if (PAYMENT_MODE === "mock" || !invoiceId) return true;
  return qpayCancelInvoice(invoiceId);
}
