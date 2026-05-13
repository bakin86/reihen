import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authErrorResponse, requireOwner } from "@/lib/auth";
import { assertCenterOwner } from "@/lib/owner-guard";
import { checkCanAddSeats } from "@/lib/subscription";

const schema = z.object({
  centerId: z.string().min(1),
  floorId: z.string().min(1),
  typeId: z.string().min(1),
  count: z.number().int().min(1).max(200),
  startNumber: z.number().int().min(1).default(1),
  prefix: z.string().max(8).optional(),
});

// POST /api/owner/seats — bulk create seats
export async function POST(req: Request) {
  try {
    const session = await requireOwner(req);
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
    }
    const { centerId, floorId, typeId, count, startNumber, prefix } = parsed.data;

    await assertCenterOwner(session, centerId);

    // Subscription seat limit check (ADMIN bypasses)
    if (session.role !== "ADMIN") {
      const check = await checkCanAddSeats(session.sub);
      if (!check.allowed) {
        const msg =
          check.reason === "NO_SUBSCRIPTION"
            ? "Subscription required"
            : `Seat limit reached (${check.current}/${check.sub!.maxSeats} on ${check.sub!.plan} plan)`;
        return NextResponse.json(
          { error: msg, code: check.reason, redirectTo: "/owner/subscription" },
          { status: 403 }
        );
      }
      const remaining = check.sub!.maxSeats - check.current;
      if (count > remaining) {
        return NextResponse.json(
          { error: `Can only add ${remaining} more seats on ${check.sub!.plan} plan`, code: "SEAT_LIMIT" },
          { status: 403 }
        );
      }
    }

    const [floor, type] = await Promise.all([
      prisma.floor.findFirst({ where: { id: floorId, centerId } }),
      prisma.seatType.findFirst({ where: { id: typeId, centerId } }),
    ]);
    if (!floor) return NextResponse.json({ error: "Floor not in this center" }, { status: 400 });
    if (!type) return NextResponse.json({ error: "SeatType not in this center" }, { status: 400 });

    const numbers: string[] = Array.from({ length: count }, (_, i) =>
      `${prefix ?? ""}${startNumber + i}`
    );

    const existing = await prisma.seat.findMany({
      where: { centerId, number: { in: numbers } },
      select: { number: true },
    });
    if (existing.length) {
      return NextResponse.json(
        { error: "Seat numbers already exist", conflicts: existing.map((s) => s.number) },
        { status: 409 }
      );
    }

    const result = await prisma.seat.createMany({
      data: numbers.map((number) => ({ centerId, floorId, typeId, number })),
    });

    const seats = await prisma.seat.findMany({
      where: { centerId, number: { in: numbers } },
      orderBy: { number: "asc" },
    });

    return NextResponse.json({ created: result.count, seats }, { status: 201 });
  } catch (e) {
    return authErrorResponse(e);
  }
}
