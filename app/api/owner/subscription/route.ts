import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authErrorResponse, requireOwner } from "@/lib/auth";
import { PLANS, getActiveSubscription } from "@/lib/subscription";

// GET /api/owner/subscription — current sub + plans
export async function GET(req: Request) {
  try {
    const session = await requireOwner(req);
    const [sub, centerCount, seatCount] = await Promise.all([
      getActiveSubscription(session.sub),
      prisma.pCCenter.count({ where: { ownerId: session.sub } }),
      prisma.seat.count({ where: { center: { ownerId: session.sub } } }),
    ]);
    return NextResponse.json({
      subscription: sub,
      usage: { centers: centerCount, seats: seatCount },
      plans: PLANS,
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}

const schema = z.object({
  plan: z.enum(["STARTER", "PRO", "ENTERPRISE"]),
  paymentMethod: z.enum(["QPAY", "BALANCE"]),
});

// POST /api/owner/subscription — subscribe (mock payment)
export async function POST(req: Request) {
  try {
    const session = await requireOwner(req);
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    const { plan, paymentMethod } = parsed.data;
    const info = PLANS[plan];

    // Check existing active sub
    const existing = await getActiveSubscription(session.sub);
    if (existing) {
      return NextResponse.json(
        { error: "Already subscribed", currentPlan: existing.plan, expiresAt: existing.expiresAt },
        { status: 409 }
      );
    }

    // Mock payment — always succeeds
    const reference = `SUB-${plan}-${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
    console.log(
      `[subscription:mock] ${session.email} → ${plan} · ${info.monthlyPrice}₮ via ${paymentMethod} · ref=${reference}`
    );

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    const sub = await prisma.subscription.upsert({
      where: { userId: session.sub },
      create: {
        userId: session.sub,
        plan,
        status: "ACTIVE",
        maxCenters: info.maxCenters,
        maxSeats: info.maxSeats,
        monthlyPrice: info.monthlyPrice,
        paymentMethod,
        reference,
        startsAt: now,
        expiresAt,
      },
      update: {
        plan,
        status: "ACTIVE",
        maxCenters: info.maxCenters,
        maxSeats: info.maxSeats,
        monthlyPrice: info.monthlyPrice,
        paymentMethod,
        reference,
        startsAt: now,
        expiresAt,
        cancelledAt: null,
      },
    });

    return NextResponse.json({
      subscription: sub,
      payment: { ok: true, reference, method: paymentMethod, amount: info.monthlyPrice },
    }, { status: 201 });
  } catch (e) {
    return authErrorResponse(e);
  }
}
