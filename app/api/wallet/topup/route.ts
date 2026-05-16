import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { processQPay } from "@/lib/payment";

const schema = z.object({
  amount: z.number().int().min(5_000).max(1_000_000),
});

export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid amount", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { amount } = parsed.data;
    const reference = `TOPUP-${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
    const payment = await processQPay(reference, amount);
    if (!payment.ok || !payment.invoiceId) {
      return NextResponse.json(
        { error: payment.error ?? "QPay invoice creation failed" },
        { status: 402 }
      );
    }

    const topUp = await prisma.walletTopUp.create({
      data: {
        userId: session.sub,
        amount,
        paymentMethod: "QPAY",
        paymentStatus: "UNPAID",
        paymentRef: payment.reference,
        qpayInvoiceId: payment.invoiceId,
      },
    });

    return NextResponse.json({ topUp, payment }, { status: 201 });
  } catch (e) {
    return authErrorResponse(e);
  }
}
