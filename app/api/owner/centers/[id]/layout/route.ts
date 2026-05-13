import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authErrorResponse, requireOwner } from "@/lib/auth";
import { assertCenterOwner } from "@/lib/owner-guard";

const layoutSchema = z.object({
  seats: z.array(
    z.object({
      id: z.string().min(1),
      posX: z.number().int().min(0),
      posY: z.number().int().min(0),
    })
  ),
  clearIds: z.array(z.string().min(1)).optional(),
});

// PATCH /api/owner/centers/:id/layout — batch update seat positions
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireOwner(req);
    await assertCenterOwner(session, params.id);

    const body = await req.json().catch(() => null);
    const parsed = layoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }

    // Verify all seats belong to this center
    const seatIds = parsed.data.seats.map((s) => s.id);
    const existing = await prisma.seat.findMany({
      where: { id: { in: seatIds }, centerId: params.id },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((s) => s.id));
    const invalid = seatIds.filter((id) => !existingIds.has(id));
    if (invalid.length > 0) {
      return NextResponse.json({ error: `Seats not found in this center: ${invalid.join(", ")}` }, { status: 400 });
    }

    // Batch update positions + clear unplaced
    const ops = parsed.data.seats.map((s) =>
      prisma.seat.update({
        where: { id: s.id },
        data: { posX: s.posX, posY: s.posY },
      })
    );
    if (parsed.data.clearIds?.length) {
      ops.push(
        ...(parsed.data.clearIds.map((id) =>
          prisma.seat.update({
            where: { id },
            data: { posX: null, posY: null },
          })
        ) as any)
      );
    }
    await prisma.$transaction(ops);

    return NextResponse.json({ updated: parsed.data.seats.length });
  } catch (e) {
    return authErrorResponse(e);
  }
}
