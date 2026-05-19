import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authErrorResponse, getSession } from "@/lib/auth";
import { processRefund, cancelQPayInvoice } from "@/lib/payment";
import { sendPushToUser } from "@/lib/push";
import { emitSeatUpdate } from "@/lib/socket";
import { sendBookingCancel } from "@/lib/sms";
import { cacheDel } from "@/lib/redis";
import { seatsCacheKey } from "@/lib/cache-keys";

const schema = z.object({
  reason: z.string().max(200).optional(),
});

// PATCH /api/bookings/:id/cancel — honors center CancelPolicy, releases ALL seats
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession(req);
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

    const booking = await prisma.booking.findUnique({
      where: { id: params.id },
      include: {
        center: { include: { cancelPolicy: true } },
        bookingSeats: {
          include: { seat: { select: { id: true, number: true } } },
        },
      },
    });
    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    if (booking.userId !== session.sub && session.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (booking.status === "CANCELLED") {
      return NextResponse.json({ error: "Already cancelled" }, { status: 409 });
    }
    if (booking.status === "NOSHOW") {
      return NextResponse.json({ error: "Already marked no-show" }, { status: 409 });
    }

    const policy = booking.center.cancelPolicy;
    const cancelMinutes = policy?.cancelMinutes ?? 30;
    const refundPolicy = policy?.refundPolicy ?? "FULL";

    const minutesUntilStart = (booking.startTime.getTime() - Date.now()) / 60_000;
    const eligibleForRefund = minutesUntilStart >= cancelMinutes;

    let refundAmount = 0;
    if (eligibleForRefund && booking.paymentStatus === "PAID") {
      if (refundPolicy === "FULL") refundAmount = booking.totalPrice;
      else if (refundPolicy === "PARTIAL") refundAmount = Math.floor(booking.totalPrice / 2);
    }

    // Cancel unpaid QPay invoice or refund paid amount
    if (booking.paymentMethod === "QPAY" && booking.paymentStatus === "UNPAID" && booking.qpayInvoiceId) {
      await cancelQPayInvoice(booking.qpayInvoiceId);
    }

    const refund =
      refundAmount > 0
        ? await processRefund(booking.userId, refundAmount, booking.paymentMethod, booking.qpayPaymentId)
        : { ok: true, reference: "no-refund", method: booking.paymentMethod, amount: 0 };

    const seatIds = booking.bookingSeats.map((bs) => bs.seatId);

    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelReason: parsed.data.reason,
        },
      });
      // Release seats that were set to WAITING or OCCUPIED by this booking.
      // This covers both future bookings (WAITING) and active sessions (OCCUPIED).
      await tx.seat.updateMany({
        where: { id: { in: seatIds }, status: { in: ["WAITING", "OCCUPIED"] } },
        data: { status: "OPEN", freeAt: null },
      });
    });

    cacheDel(seatsCacheKey(booking.centerId)).catch(() => {});
    for (const bs of booking.bookingSeats) {
      emitSeatUpdate(booking.centerId, {
        id: bs.seatId,
        status: "OPEN",
        code: bs.seat.number,
      });
    }

    sendPushToUser(booking.center.ownerId, {
      title: "Захиалга цуцлагдлаа",
      body: `${booking.code} · ${booking.bookingSeats.length} суудал · буцаалт: ${refund.amount}₮`,
      tag: booking.id,
    }).catch(() => {});

    const user = await prisma.user.findUnique({ where: { id: booking.userId }, select: { phone: true } });
    if (user?.phone) {
      sendBookingCancel(user.phone, booking.code).catch(() => {});
    }

    return NextResponse.json({
      ok: true,
      cancelled: true,
      seatsReleased: seatIds.length,
      eligibleForRefund,
      refund,
      policy: { cancelMinutes, refundPolicy, minutesUntilStart: Math.floor(minutesUntilStart) },
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}
