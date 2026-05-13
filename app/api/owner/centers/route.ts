import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authErrorResponse, requireOwner } from "@/lib/auth";
import { checkCanAddCenter, getActiveSubscription, PLANS } from "@/lib/subscription";

const floorSchema = z.object({
  floorNumber: z.number().int().min(1),
  name: z.string().min(1).max(64),
});

const seatTypeSchema = z.object({
  name: z.string().min(1).max(64),
  pricePerHour: z.number().int().min(0),
  description: z.string().max(500).optional(),
  images: z.array(z.string()).default([]),
});

const schema = z.object({
  name: z.string().min(2).max(128),
  address: z.string().min(2).max(255),
  district: z.string().min(1).max(64),
  description: z.string().max(2000).optional(),
  images: z.array(z.string()).default([]),
  floors: z.array(floorSchema).min(1),
  seatTypes: z.array(seatTypeSchema).min(1),
  cancelPolicy: z
    .object({
      cancelMinutes: z.number().int().min(0).default(30),
      noShowMinutes: z.number().int().min(0).default(60),
      refundPolicy: z.enum(["FULL", "PARTIAL", "NONE"]).default("FULL"),
    })
    .optional(),
});

// POST /api/owner/centers
export async function POST(req: Request) {
  try {
    const session = await requireOwner(req);

    // Subscription check (ADMIN bypasses)
    if (session.role !== "ADMIN") {
      const check = await checkCanAddCenter(session.sub);
      if (!check.allowed) {
        const msg =
          check.reason === "NO_SUBSCRIPTION"
            ? "Subscription required to add a PC center"
            : `Center limit reached (${check.sub!.maxCenters} on ${check.sub!.plan} plan)`;
        return NextResponse.json(
          { error: msg, code: check.reason, redirectTo: "/owner/subscription" },
          { status: 403 }
        );
      }
    }

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const d = parsed.data;

    // Validate floors/seat-types against plan limits at creation time
    if (session.role !== "ADMIN") {
      const sub = await getActiveSubscription(session.sub);
      if (sub) {
        const plan = PLANS[sub.plan];
        if (d.floors.length > plan.maxFloors) {
          return NextResponse.json(
            { error: `${sub.plan} plan allows ${plan.maxFloors} floor(s). Upgrade for more.`, code: "FLOOR_LIMIT", redirectTo: "/owner/subscription" },
            { status: 403 }
          );
        }
        if (d.seatTypes.length > plan.maxSeatTypes) {
          return NextResponse.json(
            { error: `${sub.plan} plan allows ${plan.maxSeatTypes} seat type(s). Upgrade for more.`, code: "SEAT_TYPE_LIMIT", redirectTo: "/owner/subscription" },
            { status: 403 }
          );
        }
      }
    }

    const center = await prisma.pCCenter.create({
      data: {
        name: d.name,
        address: d.address,
        district: d.district,
        description: d.description,
        images: d.images,
        ownerId: session.sub,
        floors: { create: d.floors },
        seatTypes: { create: d.seatTypes.map((t) => ({ ...t, images: t.images })) },
        cancelPolicy: d.cancelPolicy ? { create: d.cancelPolicy } : undefined,
      },
      include: { floors: true, seatTypes: true, cancelPolicy: true },
    });

    return NextResponse.json({ center }, { status: 201 });
  } catch (e) {
    return authErrorResponse(e);
  }
}

// GET /api/owner/centers — list centers the owner manages
export async function GET(req: Request) {
  try {
    const session = await requireOwner(req);
    const centers = await prisma.pCCenter.findMany({
      where: session.role === "ADMIN" ? {} : { ownerId: session.sub },
      include: {
        _count: { select: { seats: true, bookings: true, reviews: true } },
        cancelPolicy: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ centers });
  } catch (e) {
    return authErrorResponse(e);
  }
}
