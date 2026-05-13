import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authErrorResponse, getSession } from "@/lib/auth";
import { processPayment } from "@/lib/payment";
import { sendPushToUser } from "@/lib/push";
import { emitSeatUpdate } from "@/lib/socket";

const schema = z.object({
  hours: z.number().int().min(1).max(12),
  paymentMethod: z.enum(["QPAY", "BALANCE"]).optional(),
});

// PATCH /api/bookings/:id/extend — extend all seats in booking
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession(req);
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    const { hours } = parsed.data;

    const booking = await prisma.booking.findUnique({
      where: { id: params.id },
      include: {
        bookingSeats: {
          include: {
            seat: {
              include: {
                type: true,
                center: { select: { ownerId: true, name: true } },
              },
            },
          },
        },
      },
    });
    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    if (booking.userId !== session.sub && session.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (booking.status !== "CONFIRMED") {
      return NextResponse.json({ error: "Booking not extendable" }, { status: 409 });
    }

    const newEnd = new Date(booking.endTime.getTime() + hours * 3_600_000);
    const seatIds = booking.bookingSeats.map((bs) => bs.seatId);

    // Check ALL seats have the next slot available
    const conflicts = await prisma.bookingSeat.findMany({
      where: {
        seatId: { in: seatIds },
        booking: {
          id: { not: booking.id },
          status: { in: ["PENDING", "CONFIRMED"] },
          startTime: { lt: newEnd },
          endTime: { gt: booking.endTime },
        },
      },
      include: { seat: { select: { number: true } } },
    });

    if (conflicts.length > 0) {
      const conflictSeats = conflicts.map((c) => c.seat.number).join(", ");
      return NextResponse.json(
        { error: `Next slot already booked for seats: ${conflictSeats}`, conflicts },
        { status: 409 }
      );
    }

    // Calculate additional charge per hour — apply peak rate if extension falls in peak window.
    // Extension starts at current booking.endTime.
    const additional = booking.bookingSeats.reduce((sum, bs) => {
      let seatTotal = 0;
      for (let h = 0; h < hours; h++) {
        const hour = (booking.endTime.getHours() + h) % 24;
        const isPeak = hour >= 18 && hour < 23;
        seatTotal += (isPeak && bs.seat.type.peakHourPrice) ? bs.seat.type.peakHourPrice : bs.seat.type.pricePerHour;
      }
      return sum + seatTotal;
    }, 0);
    const method = parsed.data.paymentMethod ?? booking.paymentMethod;

    const pay = await processPayment(session.sub, additional, method, booking.code);
    if (!pay.ok) return NextResponse.json({ error: "Payment failed" }, { status: 402 });

    const updated = await prisma.$transaction(async (tx) => {
      // Re-verify status inside transaction — prevents TOCTOU where booking
      // gets cancelled between our check and the actual update + payment.
      const current = await tx.booking.findUnique({
        where: { id: booking.id },
        select: { status: true },
      });
      if (!current || current.status !== "CONFIRMED") {
        throw new Error("Booking status changed — cannot extend");
      }

      const b = await tx.booking.update({
        where: { id: booking.id },
        data: {
          endTime: newEnd,
          hours: booking.hours + hours,
          totalPrice: booking.totalPrice + additional,
        },
      });
      await tx.seat.updateMany({
        where: { id: { in: seatIds } },
        data: { freeAt: newEnd },
      });
      return b;
    });

    const centerName = booking.bookingSeats[0]?.seat.center.name ?? "";
    const ownerId = booking.bookingSeats[0]?.seat.center.ownerId ?? "";

    for (const bs of booking.bookingSeats) {
      emitSeatUpdate(booking.centerId, { id: bs.seatId, status: "OCCUPIED", code: bs.seat.number });
    }
    sendPushToUser(ownerId, {
      title: "Захиалга сунгагдлаа",
      body: `${booking.code} · +${hours}ц · ${centerName}`,
      tag: booking.id,
    }).catch(() => {});

    return NextResponse.json({ booking: updated, charged: pay });
  } catch (e) {
    return authErrorResponse(e);
  }
}
