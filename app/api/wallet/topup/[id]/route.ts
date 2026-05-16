import { NextResponse } from "next/server";
import { authErrorResponse, getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession(_req);
    const topUp = await prisma.walletTopUp.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        amount: true,
        paymentStatus: true,
        qpayInvoiceId: true,
        paidAt: true,
        userId: true,
      },
    });
    if (!topUp || topUp.userId !== session.sub) {
      return NextResponse.json({ error: "Top-up not found" }, { status: 404 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.sub },
      select: { balance: true },
    });

    return NextResponse.json({
      topUp: {
        id: topUp.id,
        amount: topUp.amount,
        paymentStatus: topUp.paymentStatus,
        qpayInvoiceId: topUp.qpayInvoiceId,
        paidAt: topUp.paidAt,
      },
      balance: user?.balance ?? 0,
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}
