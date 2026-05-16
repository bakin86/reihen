import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authErrorResponse, getSession } from "@/lib/auth";
import { generateBookingCode } from "@/lib/booking-code";
import { processPayment, processRefund, cancelQPayInvoice } from "@/lib/payment";
import { sendPushToUser } from "@/lib/push";
import { emitBookingUpdate, emitSeatUpdate } from "@/lib/socket";
import { sendBookingConfirm } from "@/lib/sms";
import { cacheDel } from "@/lib/redis";
import { seatsCacheKey } from "@/lib/cache-keys";

const schema = z.object({
  seatIds: z.array(z.string().min(1)).min(1),
  startTime: z.coerce.date(),
  hours: z.number().int().min(1).max(24),
  paymentMethod: z.enum(["QPAY", "BALANCE"]),
});

function isSerializableConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

function seatStatusForConfirmedBooking(start: Date, end: Date, now = new Date()) {
  return start <= now && end > now ? "OCCUPIED" : "WAITING";
}

// POST /api/bookings — create booking (multi-seat)
export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { seatIds, startTime, hours, paymentMethod } = parsed.data;

    const bookingUser = await prisma.user.findUnique({
      where: { id: session.sub },
      select: { isRestricted: true, restrictionReason: true, restrictedUntil: true },
    });
    if (
      bookingUser?.isRestricted &&
      (!bookingUser.restrictedUntil || bookingUser.restrictedUntil > new Date())
    ) {
      return NextResponse.json(
        {
          error: bookingUser.restrictionReason
            ? `Booking restricted: ${bookingUser.restrictionReason}`
            : "This account is restricted from booking",
        },
        { status: 403 }
      );
    }
    if (bookingUser?.isRestricted && bookingUser.restrictedUntil && bookingUser.restrictedUntil <= new Date()) {
      await prisma.user.update({
        where: { id: session.sub },
        data: { isRestricted: false, restrictionReason: null, restrictedUntil: null, restrictedByOwnerId: null },
      });
    }

    // Deduplicate
    const uniqueSeatIds = [...new Set(seatIds)];

    // Align to hour boundaries
    const start = new Date(startTime);
    start.setMinutes(0, 0, 0);
    const end = new Date(start.getTime() + hours * 3_600_000);

    if (start < new Date(Date.now() - 60_000)) {
      return NextResponse.json({ error: "Start time is in the past" }, { status: 400 });
    }

    // Fetch all seats — must be same center
    const seats = await prisma.seat.findMany({
      where: { id: { in: uniqueSeatIds } },
      include: {
        type: true,
        center: {
          include: { cancelPolicy: true },
        },
      },
    });

    if (seats.length !== uniqueSeatIds.length) {
      return NextResponse.json({ error: "One or more seats not found" }, { status: 404 });
    }

    // All seats must be from the same center
    const centerIds = new Set(seats.map((s) => s.centerId));
    if (centerIds.size !== 1) {
      return NextResponse.json({ error: "All seats must be from the same center" }, { status: 400 });
    }

    const center = seats[0].center;

    // Check maxSeatsPerBooking from CancelPolicy
    const maxSeats = center.cancelPolicy?.maxSeatsPerBooking ?? 10;
    if (uniqueSeatIds.length > maxSeats) {
      return NextResponse.json(
        { error: `Max ${maxSeats} seats per booking (this center's policy)` },
        { status: 400 }
      );
    }

    // Check each seat is available
    for (const seat of seats) {
      if (seat.status === "CLOSED" || seat.status === "REPAIR") {
        return NextResponse.json(
          { error: `Seat ${seat.number} is ${seat.status.toLowerCase()}` },
          { status: 409 }
        );
      }
    }

    // Calculate total price: apply peak rate per individual hour, not per booking.
    // Peak window is 18:00–22:59 (hour 18..22 inclusive).
    const now = new Date();
    const basePrice = seats.reduce((sum, seat) => {
      let seatTotal = 0;
      for (let h = 0; h < hours; h++) {
        const hour = (start.getHours() + h) % 24;
        const isPeak = hour >= 18 && hour < 23;
        seatTotal += (isPeak && seat.type.peakHourPrice) ? seat.type.peakHourPrice : seat.type.pricePerHour;
      }
      return sum + seatTotal;
    }, 0);

    // QPay surcharge (default 1%) — passed to user to offset gateway fees
    const surchargePct = paymentMethod === "QPAY"
      ? Number(process.env.QPAY_SURCHARGE_PCT ?? 1) / 100
      : 0;
    const surchargeAmount = Math.round(basePrice * surchargePct);
    const totalPrice = basePrice + surchargeAmount;

    const code = await generateBookingCode();

    // Process payment
    const payment = await processPayment(session.sub, totalPrice, paymentMethod, code);
    if (!payment.ok) {
      return NextResponse.json(
        { error: payment.error ?? "Payment failed" },
        { status: 402 }
      );
    }

    const isPending = !!payment.pending;

    const undoPayment = async () => {
      if (paymentMethod === "BALANCE") {
        await processRefund(session.sub, totalPrice, "BALANCE").catch(() => {});
      } else if (payment.invoiceId) {
        await cancelQPayInvoice(payment.invoiceId).catch(() => {});
      }
    };

    // Overlap check + create inside a serializable transaction to prevent race conditions.
    // If the transaction throws, undo the payment before returning.
    let booking;
    try {
    booking = await prisma.$transaction(async (tx) => {
      // Re-check overlaps inside transaction (serializable)
      const overlaps = await tx.bookingSeat.findMany({
        where: {
          seatId: { in: uniqueSeatIds },
          booking: {
            status: { in: ["PENDING", "CONFIRMED"] },
            startTime: { lt: end },
            endTime: { gt: start },
          },
        },
        include: {
          seat: { select: { number: true } },
        },
      });

      if (overlaps.length > 0) {
        const conflictSeats = overlaps.map((o) => o.seat.number).join(", ");
        throw new Error(`OVERLAP:${conflictSeats}`);
      }

      const b = await tx.booking.create({
        data: {
          code,
          userId: session.sub,
          centerId: center.id,
          startTime: start,
          endTime: end,
          hours,
          totalPrice,
          status: isPending ? "PENDING" : "CONFIRMED",
          paymentMethod,
          paymentStatus: isPending ? "UNPAID" : "PAID",
          paymentRef: payment.reference,
          qpayInvoiceId: payment.invoiceId ?? null,
          bookingSeats: {
            create: uniqueSeatIds.map((seatId) => ({ seatId })),
          },
        },
        include: {
          bookingSeats: { include: { seat: { select: { id: true, number: true } } } },
        },
      });

      // Paid bookings must become visible immediately on every seat map.
      // Active bookings are OCCUPIED; future paid bookings are reserved as WAITING.
      if (!isPending) {
        await tx.seat.updateMany({
          where: { id: { in: uniqueSeatIds } },
          data: {
            status: seatStatusForConfirmedBooking(start, end, now),
            freeAt: end,
          },
        });
      }

      return b;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (txErr: any) {
      // Transaction failed — refund the payment that was already processed
      if (txErr?.message?.startsWith("OVERLAP:")) {
        await undoPayment();
        const conflictSeats = txErr.message.replace("OVERLAP:", "");
        return NextResponse.json(
          { error: `Seats already booked for this slot: ${conflictSeats}` },
          { status: 409 }
        );
      }
      await undoPayment();
      if (isSerializableConflict(txErr)) {
        return NextResponse.json(
          { error: "Seat was booked at the same time. Please try again." },
          { status: 409 }
        );
      }
      throw txErr;
    }

    const seatNumbers = booking.bookingSeats.map((bs) => bs.seat.number).join(", ");

    // Invalidate seat cache so next request reflects new booking
    cacheDel(seatsCacheKey(center.id)).catch(() => {});

    emitBookingUpdate(center.id, {
      id: booking.id,
      code: booking.code,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
    });

    if (!isPending) {
      const nextSeatStatus = seatStatusForConfirmedBooking(start, end, now);
      // Emit realtime updates for each seat
      for (const bs of booking.bookingSeats) {
        emitSeatUpdate(center.id, {
          id: bs.seatId,
          status: nextSeatStatus,
          code: bs.seat.number,
          freeAt: end,
        });
      }

      // Fire-and-forget: don't block response for push/SMS
      void (async () => {
        sendPushToUser(center.ownerId, {
          title: "Шинэ захиалга",
          body: `${booking.code} · ${center.name} · ${seatNumbers} (${uniqueSeatIds.length} суудал)`,
          url: `/dashboard/bookings/${booking.id}`,
          tag: booking.id,
        }).catch(() => {});

        // Notify staff at this center — batched, non-blocking
        const staffUsers = await prisma.centerStaff.findMany({
          where: { centerId: center.id, canViewBookings: true },
          select: { userId: true },
        });
        const timeStr = start.toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" });
        await Promise.allSettled(
          staffUsers.map((s) =>
            sendPushToUser(s.userId, {
              title: "Шинэ захиалга",
              body: `${booking.code} · ${seatNumbers} · ${timeStr}`,
              url: "/staff",
              tag: `staff-booking-${booking.id}`,
            })
          )
        );

        const user = await prisma.user.findUnique({ where: { id: session.sub }, select: { phone: true } });
        if (user?.phone) {
          const timeStr = start.toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" });
          sendBookingConfirm(user.phone, code, center.name, seatNumbers, timeStr).catch(() => {});
        }
      })();
    }

    return NextResponse.json({ booking, payment }, { status: 201 });
  } catch (e: any) {
    return authErrorResponse(e);
  }
}

// GET /api/bookings — current user's bookings
export async function GET(req: Request) {
  try {
    const session = await getSession(req);
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? 20)));

    const bookings = await prisma.booking.findMany({
      where: { userId: session.sub },
      include: {
        bookingSeats: {
          include: { seat: { select: { number: true, id: true } } },
        },
        center: { select: { id: true, name: true, address: true } },
      },
      orderBy: { startTime: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });
    return NextResponse.json({ bookings, page, limit });
  } catch (e) {
    return authErrorResponse(e);
  }
}
