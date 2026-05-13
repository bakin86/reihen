import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authErrorResponse, requireOwner } from "@/lib/auth";

// DELETE /api/owner/staff/:id — remove staff from center
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireOwner(req);

    if (params.id.startsWith("unassigned-")) {
      const userId = params.id.replace("unassigned-", "");
      const target = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, staffCenters: { select: { id: true } } },
      });
      if (!target || target.role !== "STAFF" || target.staffCenters.length > 0) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      await prisma.user.delete({ where: { id: userId } });
      return NextResponse.json({ deleted: true });
    }

    const staffRecord = await prisma.centerStaff.findUnique({
      where: { id: params.id },
      include: { center: { select: { ownerId: true } } },
    });

    if (!staffRecord) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (staffRecord.center.ownerId !== session.sub && session.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.centerStaff.delete({ where: { id: params.id } });

    // If user has no other staff assignments, demote back to PLAYER
    const remaining = await prisma.centerStaff.count({
      where: { userId: staffRecord.userId },
    });
    if (remaining === 0) {
      const user = await prisma.user.findUnique({
        where: { id: staffRecord.userId },
        select: { role: true },
      });
      if (user?.role === "STAFF") {
        await prisma.user.update({
          where: { id: staffRecord.userId },
          data: { role: "PLAYER" },
        });
      }
    }

    return NextResponse.json({ deleted: true });
  } catch (e) {
    return authErrorResponse(e);
  }
}

// PATCH /api/owner/staff/:id — update staff permissions
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireOwner(req);
    const body = await req.json();

    const staffRecord = await prisma.centerStaff.findUnique({
      where: { id: params.id },
      include: { center: { select: { ownerId: true } } },
    });

    if (!staffRecord) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (staffRecord.center.ownerId !== session.sub && session.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updated = await prisma.centerStaff.update({
      where: { id: params.id },
      data: {
        canCheckin: body.canCheckin ?? staffRecord.canCheckin,
        canSeatStatus: body.canSeatStatus ?? staffRecord.canSeatStatus,
        canViewBookings: body.canViewBookings ?? staffRecord.canViewBookings,
      },
    });

    return NextResponse.json({ staff: updated });
  } catch (e) {
    return authErrorResponse(e);
  }
}
