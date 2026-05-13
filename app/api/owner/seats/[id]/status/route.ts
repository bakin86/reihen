import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authErrorResponse, requireStaff } from "@/lib/auth";
import { assertCenterAccess } from "@/lib/owner-guard";
import { emitSeatUpdate } from "@/lib/socket";

const schema = z.object({
  status: z.enum(["OPEN", "CLOSED", "REPAIR", "WAITING", "OCCUPIED"]),
  freeAt: z.coerce.date().nullish(),
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

    return NextResponse.json({ seat: updated });
  } catch (e) {
    return authErrorResponse(e);
  }
}
