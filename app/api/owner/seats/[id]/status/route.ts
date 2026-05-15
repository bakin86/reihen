import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authErrorResponse, requireStaff } from "@/lib/auth";
import { assertCenterAccess } from "@/lib/owner-guard";
import { emitSeatUpdate } from "@/lib/socket";
import { cacheDel } from "@/lib/redis";
import { seatsCacheKey } from "@/lib/cache-keys";

const schema = z.object({
  status: z.enum(["OPEN", "CLOSED", "REPAIR", "WAITING", "OCCUPIED"]),
  freeAt: z.coerce.date().nullish(),
  force: z.boolean().optional(),
});

// PATCH /api/owner/seats/:id/status
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireStaff(req);
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const seat = await prisma.seat.findUnique({
      where: { id: params.id },
      select: { id: true, centerId: true, number: true },
    });
    if (!seat) return NextResponse.json({ error: "Seat not found" }, { status: 404 });

    await assertCenterAccess(session, seat.centerId, "canSeatStatus");

    if (parsed.data.status === "OPEN" && !parsed.data.force) {
      const activeBooking = await prisma.bookingSeat.findFirst({
        where: {
          seatId: seat.id,
          booking: {
            status: "CONFIRMED",
            startTime: { lte: new Date() },
            endTime: { gt: new Date() },
          },
        },
        select: { booking: { select: { code: true } } },
      });
      if (activeBooking) {
        return NextResponse.json(
          { error: `Seat has active booking ${activeBooking.booking.code}. Cancel/no-show it first or retry with force.` },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.seat.update({
      where: { id: seat.id },
      data: {
        status: parsed.data.status,
        freeAt: parsed.data.status === "OPEN" ? null : parsed.data.freeAt ?? null,
      },
    });

    emitSeatUpdate(seat.centerId, {
      id: seat.id,
      status: updated.status,
      code: seat.number,
    });
    cacheDel(seatsCacheKey(seat.centerId)).catch(() => {});

    return NextResponse.json({ seat: updated });
  } catch (e) {
    return authErrorResponse(e);
  }
}
