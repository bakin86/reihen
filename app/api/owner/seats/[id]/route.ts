import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authErrorResponse, requireOwner } from "@/lib/auth";
import { assertCenterOwner } from "@/lib/owner-guard";

const updateSchema = z.object({
  number: z.string().min(1).optional(),
  floorId: z.string().min(1).optional(),
  typeId: z.string().min(1).optional(),
  posX: z.number().int().min(0).nullable().optional(),
  posY: z.number().int().min(0).nullable().optional(),
});

// PATCH /api/owner/seats/:id — edit seat number/floor/type
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireOwner(req);
    const seat = await prisma.seat.findUnique({ where: { id: params.id }, select: { centerId: true } });
    if (!seat) return NextResponse.json({ error: "Seat not found" }, { status: 404 });
    await assertCenterOwner(session, seat.centerId);

    const parsed = updateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

    const updated = await prisma.seat.update({
      where: { id: params.id },
      data: parsed.data,
      include: {
        floor: { select: { id: true, floorNumber: true, name: true } },
        type: { select: { id: true, name: true, pricePerHour: true } },
      },
    });
    return NextResponse.json({ seat: updated });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "Seat number already exists in this center" }, { status: 409 });
    }
    return authErrorResponse(e);
  }
}

// DELETE /api/owner/seats/:id — remove seat
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireOwner(req);
    const seat = await prisma.seat.findUnique({ where: { id: params.id }, select: { centerId: true } });
    if (!seat) return NextResponse.json({ error: "Seat not found" }, { status: 404 });
    await assertCenterOwner(session, seat.centerId);

    const activeBookings = await prisma.bookingSeat.count({
      where: {
        seatId: params.id,
        booking: { status: { in: ["PENDING", "CONFIRMED"] } },
      },
    });
    if (activeBookings > 0) {
      return NextResponse.json({ error: `Cannot delete — ${activeBookings} active bookings` }, { status: 409 });
    }

    await prisma.seat.delete({ where: { id: params.id } });
    return NextResponse.json({ deleted: true });
  } catch (e) {
    return authErrorResponse(e);
  }
}
