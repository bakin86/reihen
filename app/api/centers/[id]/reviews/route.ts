import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// GET /api/centers/:id/reviews
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const reviews = await prisma.review.findMany({
    where: { centerId: params.id },
    select: {
      id: true,
      rating: true,
      ownerReply: true,
      createdAt: true,
      user: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  // Check if logged-in user has an unreviewed completed booking here
  let myUnreviewedBookingId: string | null = null;
  try {
    const session = await getSession(req);
    const booking = await prisma.booking.findFirst({
      where: {
        userId: session.sub,
        centerId: params.id,
        status: "CONFIRMED",
        endTime: { lt: new Date() },
        review: null,
      },
      orderBy: { endTime: "desc" },
      select: { id: true },
    });
    myUnreviewedBookingId = booking?.id ?? null;
  } catch {
    // Not logged in — fine
  }

  return NextResponse.json({ reviews, myUnreviewedBookingId });
}
