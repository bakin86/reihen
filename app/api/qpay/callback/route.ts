import { NextResponse } from "next/server";
import { isDynamicUsageError } from "next/dist/export/helpers/is-dynamic-usage-error";
import { prisma } from "@/lib/prisma";
import { checkPayment, createEbarimt, QPAY_MODE } from "@/lib/qpay";
import { emitSeatUpdate } from "@/lib/socket";
import { sendPushToUser } from "@/lib/push";
import { sendPaymentConfirm } from "@/lib/sms";

// In-memory rate limit for callback endpoint (prevent amplification attacks)
const callbackHits = new Map<string, { count: number; reset: number }>();
const CB_LIMIT = 30;        // max 30 calls per minute
const CB_WINDOW = 60_000;

function rateLimitCallback(ip: string): boolean {
  const now = Date.now();
  const b = callbackHits.get(ip);
  if (!b || b.reset < now) {
    callbackHits.set(ip, { count: 1, reset: now + CB_WINDOW });
    return true;
  }
  b.count += 1;
  return b.count <= CB_LIMIT;
}

/**
 * GET /api/qpay/callback?qpay_payment_id=xxx
 *
 * QPay calls this endpoint (GET!) after a customer pays.
 * Security: We never trust the callback alone — we always verify
 * with QPay's checkPayment() API before confirming any booking.
 * Rate-limited to prevent amplification attacks.
 */
export async function GET(req: Request) {
  try {
    // Rate limit the callback endpoint
    const ip =
      req.headers.get("x-real-ip") ??
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    if (!rateLimitCallback(ip)) {
      return new NextResponse("SUCCESS", { status: 200 }); // still return 200 to not leak info
    }

    const { searchParams } = new URL(req.url);
    const qpayPaymentId = searchParams.get("qpay_payment_id");

    // Validate payment ID format (alphanumeric + dashes only, max 64 chars)
    if (!qpayPaymentId || !/^[a-zA-Z0-9_-]{1,64}$/.test(qpayPaymentId)) {
      return new NextResponse("SUCCESS", { status: 200 });
    }

    // Find pending bookings with QPay invoices
    const pendingBookings = await prisma.booking.findMany({
      where: {
        paymentMethod: "QPAY",
        paymentStatus: "UNPAID",
        status: "PENDING",
        qpayInvoiceId: { not: null },
      },
      include: {
        bookingSeats: {
          include: { seat: { select: { id: true, number: true, centerId: true } } },
        },
        center: { select: { id: true, name: true, ownerId: true } },
        user: { select: { id: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const isMock = QPAY_MODE === "mock";

    for (const booking of pendingBookings) {
      if (!booking.qpayInvoiceId) continue;

      try {
        let paymentId: string;

        if (isMock) {
          // Mock mode: the qpay_payment_id IS the mock invoice ID — match it
          if (booking.qpayInvoiceId !== qpayPaymentId) continue;
          paymentId = `MOCK-PAY-${Date.now()}`;
        } else {
          // Real mode: verify payment status with QPay API — never trust callback alone
          const result = await checkPayment(booking.qpayInvoiceId);
          if (!result.paid || !result.paymentId) continue;
          paymentId = result.paymentId;
        }

        const seatIds = booking.bookingSeats.map((bs) => bs.seatId);

        await prisma.$transaction(async (tx) => {
          await tx.booking.update({
            where: { id: booking.id },
            data: {
              status: "CONFIRMED",
              paymentStatus: "PAID",
              qpayPaymentId: paymentId,
            },
          });

          const now = new Date();
          if (booking.startTime <= now && booking.endTime > now) {
            await tx.seat.updateMany({
              where: { id: { in: seatIds } },
              data: { status: "OCCUPIED", freeAt: booking.endTime },
            });
          }
        });

        // E-barimt (non-blocking, skip in mock)
        if (!isMock) {
          createEbarimt(paymentId).catch((e) =>
            console.error(`[qpay:callback] ebarimt failed for ${booking.code}:`, e)
          );
        }

        const seatNumbers = booking.bookingSeats.map((bs) => bs.seat.number).join(", ");

        for (const bs of booking.bookingSeats) {
          emitSeatUpdate(booking.centerId, {
            id: bs.seatId,
            status: "OCCUPIED",
            code: bs.seat.number,
          });
        }

        sendPushToUser(booking.center.ownerId, {
          title: "Төлбөр амжилттай",
          body: `${booking.code} · ${booking.center.name} · ${seatNumbers} · ${booking.totalPrice.toLocaleString()}₮`,
          url: `/dashboard/bookings/${booking.id}`,
          tag: booking.id,
        }).catch(() => {});

        if (booking.user.phone) {
          sendPaymentConfirm(booking.user.phone, booking.code, booking.totalPrice).catch(() => {});
        }

        console.log(`[qpay:callback] Confirmed booking ${booking.code} (payment=${paymentId})${isMock ? " [MOCK]" : ""}`);
        break;
      } catch (e) {
        console.error(`[qpay:callback] checkPayment failed for invoice ${booking.qpayInvoiceId}:`, e);
      }
    }

    // Also confirm any pending tournament team QPay payments
    const pendingTeams = await prisma.tournamentTeam.findMany({
      where: {
        paymentMethod: "QPAY",
        paymentStatus: "UNPAID",
        paymentRef: { not: null },
      },
      include: {
        tournament: {
          include: { center: { select: { ownerId: true, name: true } } },
        },
        captain: { select: { id: true, phone: true, name: true } },
      },
      take: 20,
    });

    for (const team of pendingTeams) {
      if (!team.paymentRef) continue;
      try {
        let paymentId: string;

        if (isMock) {
          if (team.paymentRef !== qpayPaymentId) continue;
          paymentId = `MOCK-PAY-TRN-${Date.now()}`;
        } else {
          const result = await checkPayment(team.paymentRef);
          if (!result.paid || !result.paymentId) continue;
          paymentId = result.paymentId;
        }

        await prisma.tournamentTeam.update({
          where: { id: team.id },
          data: { paymentStatus: "PAID", qpayPaymentId: paymentId },
        });

        sendPushToUser(team.tournament.center.ownerId, {
          title: "Тэмцээний бүртгэл төлөгдлөө",
          body: `${team.name} · ${team.tournament.name}`,
          tag: `trn-pay-${team.id}`,
        }).catch(() => {});

        console.log(`[qpay:callback] Confirmed tournament team ${team.name} (payment=${paymentId})${isMock ? " [MOCK]" : ""}`);
        break;
      } catch (e) {
        console.error(`[qpay:callback] tournament team check failed for ref ${team.paymentRef}:`, e);
      }
    }

    return new NextResponse("SUCCESS", { status: 200 });
  } catch (e) {
    if (isDynamicUsageError(e)) throw e;
    console.error("[qpay:callback] Unhandled error:", e);
    return new NextResponse("SUCCESS", { status: 200 });
  }
}
