import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authErrorResponse, requireStaff } from "@/lib/auth";
import { getBookingForStaff } from "@/lib/owner-guard";
import { emitSeatUpdate } from "@/lib/socket";
import { sendPushToUser } from "@/lib/push";
import { cacheDel } from "@/lib/redis";
import { seatsCacheKey } from "@/lib/cache-keys";

// PATCH /api/owner/bookings/:id/noshow — release ALL seats
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireStaff(req);
    const booking = await getBookingForStaff(session, params.id, "canCheckin");

    if (booking.status !== "CONFIRMED") {
      if (booking.status === "NOSHOW") {
        return NextResponse.json({ error: "Already marked no-show" }, { status: 409 });
      }
      if (booking.status === "CANCELLED") {
        return NextResponse.json({ error: "Booking cancelled" }, { status: 409 });
      }
      return NextResponse.json(
        { error: booking.status === "PENDING" ? "Payment not yet confirmed" : `Cannot no-show ${booking.status} booking` },
        { status: 409 }
      );
    }

    const policy = await prisma.cancelPolicy.findUnique({
      where: { centerId: booking.centerId },
      select: { noShowMinutes: true },
    });
    const noShowAfter = new Date(
      booking.startTime.getTime() + (policy?.noShowMinutes ?? 60) * 60_000
    );
    if (session.role === "STAFF" && new Date() < noShowAfter) {
      return NextResponse.json({ error: "Too early to mark no-show" }, { status: 400 });
    }

    const seatIds = booking.bookingSeats.map((bs) => bs.seatId);

    const [updated, user] = await prisma.$transaction([
      prisma.booking.update({
        where: { id: booking.id },
        data: { status: "NOSHOW" },
      }),
      prisma.user.update({
        where: { id: booking.userId },
        data: { noShowCount: { increment: 1 } },
        select: { id: true, noShowCount: true },
      }),
      prisma.seat.updateMany({
        where: { id: { in: seatIds } },
        data: { status: "OPEN", freeAt: null },
      }),
    ]);

    for (const bs of booking.bookingSeats) {
      emitSeatUpdate(booking.centerId, {
        id: bs.seatId,
        status: "OPEN",
        code: bs.seat.number,
      });
    }
    cacheDel(seatsCacheKey(booking.centerId)).catch(() => {});
    sendPushToUser(booking.userId, {
      title: "Ирэлгүй тэмдэглэгдлээ",
      body: `${booking.code} цуцлагдсан`,
      tag: booking.id,
    }).catch(() => {});

    return NextResponse.json({ booking: updated, user });
  } catch (e) {
    return authErrorResponse(e);
  }
}
