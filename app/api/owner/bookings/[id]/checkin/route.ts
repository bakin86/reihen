import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authErrorResponse, requireStaff } from "@/lib/auth";
import { getBookingForStaff } from "@/lib/owner-guard";
import { emitSeatUpdate } from "@/lib/socket";
import { sendPushToUser } from "@/lib/push";
import { cacheDel } from "@/lib/redis";
import { seatsCacheKey } from "@/lib/cache-keys";

// PATCH /api/owner/bookings/:id/checkin — mark all seats as occupied
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireStaff(req);
    const booking = await getBookingForStaff(session, params.id, "canCheckin");

    if (booking.status !== "CONFIRMED") {
      return NextResponse.json(
        { error: booking.status === "PENDING" ? "Payment not yet confirmed" : `Cannot check-in ${booking.status} booking` },
        { status: 409 }
      );
    }

    const seatIds = booking.bookingSeats.map((bs) => bs.seatId);

    const updated = await prisma.$transaction(async (tx) => {
      const b = await tx.booking.update({
        where: { id: booking.id },
        data: { status: "CONFIRMED" },
      });
      await tx.seat.updateMany({
        where: { id: { in: seatIds } },
        data: { status: "OCCUPIED", freeAt: booking.endTime },
      });
      return b;
    });

    const seatNumbers = booking.bookingSeats.map((bs) => bs.seat.number).join(", ");

    for (const bs of booking.bookingSeats) {
      emitSeatUpdate(booking.centerId, {
        id: bs.seatId,
        status: "OCCUPIED",
        code: bs.seat.number,
      });
    }
    cacheDel(seatsCacheKey(booking.centerId)).catch(() => {});
    sendPushToUser(booking.userId, {
      title: "Тоглолт эхэллээ",
      body: `${booking.code} · ${seatNumbers}`,
      tag: booking.id,
    }).catch(() => {});

    return NextResponse.json({ booking: updated, checkedInAt: new Date() });
  } catch (e) {
    return authErrorResponse(e);
  }
}
