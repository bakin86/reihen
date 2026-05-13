import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authErrorResponse, requireOwner } from "@/lib/auth";
import { PLANS, getActiveSubscription } from "@/lib/subscription";

const schema = z.object({
  plan: z.enum(["STARTER", "PRO", "ENTERPRISE"]),
  paymentMethod: z.enum(["QPAY", "BALANCE"]),
});

// PATCH /api/owner/subscription/upgrade
export async function PATCH(req: Request) {
  try {
    const session = await requireOwner(req);
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    const { plan, paymentMethod } = parsed.data;

    const current = await getActiveSubscription(session.sub);
    if (!current) {
      return NextResponse.json({ error: "No active subscription" }, { status: 400 });
    }

    const tiers = ["STARTER", "PRO", "ENTERPRISE"] as const;
    if (tiers.indexOf(plan) <= tiers.indexOf(current.plan)) {
      return NextResponse.json({ error: "Can only upgrade to a higher plan" }, { status: 400 });
    }

    const info = PLANS[plan];
    const reference = `UPGRADE-${plan}-${Date.now()}`;
    console.log(
      `[subscription:mock] upgrade ${current.plan}→${plan} · ${info.monthlyPrice}₮ via ${paymentMethod}`
    );

    const sub = await prisma.subscription.update({
      where: { userId: session.sub },
      data: {
        plan,
        maxCenters: info.maxCenters,
        maxSeats: info.maxSeats,
        monthlyPrice: info.monthlyPrice,
        paymentMethod,
        reference,
      },
    });

    return NextResponse.json({ subscription: sub, payment: { ok: true, reference, amount: info.monthlyPrice } });
  } catch (e) {
    return authErrorResponse(e);
  }
}
