import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, authErrorResponse } from "@/lib/auth";

// GET /api/favorites — list user's favorited centers
export async function GET(req: Request) {
  try {
    const session = await getSession(req);

    const favorites = await prisma.favoriteCenter.findMany({
      where: { userId: session.sub },
      include: {
        center: {
          include: {
            seatTypes: { select: { pricePerHour: true } },
            seats: { where: { status: "OPEN" }, select: { id: true } },
            _count: { select: { seats: true, reviews: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const centers = favorites.map((f) => ({
      id: f.center.id,
      name: f.center.name,
      district: f.center.district,
      address: f.center.address,
      images: f.center.images,
      rating: f.center.rating,
      isVerified: f.center.isVerified,
      reviewCount: f.center._count.reviews,
      seatCount: f.center._count.seats,
      availableSeats: f.center.seats.length,
      minPricePerHour: f.center.seatTypes.length
        ? Math.min(...f.center.seatTypes.map((t) => t.pricePerHour))
        : null,
      favoritedAt: f.createdAt,
    }));

    return NextResponse.json({ centers });
  } catch (e) {
    return authErrorResponse(e);
  }
}
