import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authErrorResponse, getCurrentUser } from "@/lib/auth";
import { PLANS, getActiveSubscription } from "@/lib/subscription";

// GET /api/owner/subscription - current subscription + available plans.
// A PLAYER may read this page because subscribing is how a normal account
// becomes a PC owner.
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    const [sub, centerCount, seatCount] = await Promise.all([
      getActiveSubscription(user.id),
      prisma.pCCenter.count({ where: { ownerId: user.id } }),
      prisma.seat.count({ where: { center: { ownerId: user.id } } }),
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

// POST /api/owner/subscription - subscribe with mock payment.
// If the authenticated user is still PLAYER, this promotes them to OWNER
// after payment succeeds.
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (user.role !== "PLAYER" && user.role !== "OWNER" && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only players or owners can subscribe" }, { status: 403 });
    }

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    const { plan, paymentMethod } = parsed.data;
    const info = PLANS[plan];

    const existing = await getActiveSubscription(user.id);
    if (existing) {
      return NextResponse.json(
        { error: "Already subscribed", currentPlan: existing.plan, expiresAt: existing.expiresAt },
        { status: 409 }
      );
    }

    const reference = `SUB-${plan}-${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
    console.log(
      `[subscription:mock] ${user.email} -> ${plan} · ${info.monthlyPrice} MNT via ${paymentMethod} · ref=${reference}`
    );

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    const [sub, updatedUser] = await prisma.$transaction([
      prisma.subscription.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
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
      }),
      prisma.user.update({
        where: { id: user.id },
        data: user.role === "PLAYER" ? { role: "OWNER" } : {},
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          balance: true,
          noShowCount: true,
          avatarUrl: true,
          isActive: true,
          createdAt: true,
        },
      }),
    ]);

    return NextResponse.json(
      {
        subscription: sub,
        user: updatedUser,
        payment: { ok: true, reference, method: paymentMethod, amount: info.monthlyPrice },
      },
      { status: 201 }
    );
  } catch (e) {
    return authErrorResponse(e);
  }
}
