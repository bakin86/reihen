import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authErrorResponse, getSession } from "@/lib/auth";

const schema = z.object({
  bookingId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

// POST /api/reviews
export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: parsed.data.bookingId },
      select: { id: true, userId: true, centerId: true, status: true, endTime: true },
    });
    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    if (booking.userId !== session.sub) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // Only allow reviews for confirmed bookings that have actually ended
    if (booking.status !== "CONFIRMED" || booking.endTime > new Date()) {
      return NextResponse.json({ error: "Can only review completed bookings" }, { status: 400 });
    }

    const exists = await prisma.review.findUnique({ where: { bookingId: booking.id } });
    if (exists) return NextResponse.json({ error: "Already reviewed" }, { status: 409 });

    const review = await prisma.review.create({
      data: {
        userId: session.sub,
        centerId: booking.centerId,
        bookingId: booking.id,
        rating: parsed.data.rating,
        comment: parsed.data.comment,
      },
    });

    // Update center average (non-blocking — don't delay response)
    void prisma.review.aggregate({
      _avg: { rating: true },
      where: { centerId: booking.centerId },
    }).then((agg) =>
      prisma.pCCenter.update({
        where: { id: booking.centerId },
        data: { rating: agg._avg.rating ?? 0 },
      })
    ).catch(() => {});

    return NextResponse.json({ review }, { status: 201 });
  } catch (e) {
    return authErrorResponse(e);
  }
}
