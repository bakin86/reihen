import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authErrorResponse, getSession } from "@/lib/auth";
import type { BookingStatus } from "@prisma/client";

// GET /api/bookings/history?page=1&limit=20&status=CONFIRMED
export async function GET(req: Request) {
  try {
    const session = await getSession(req);
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 20));
    const status = searchParams.get("status") as BookingStatus | null;

    const where: any = { userId: session.sub };
    if (status && ["PENDING", "CONFIRMED", "CANCELLED", "NOSHOW"].includes(status)) {
      where.status = status;
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          bookingSeats: {
            include: { seat: { select: { number: true, id: true } } },
          },
          center: { select: { id: true, name: true, address: true, images: true } },
          review: { select: { id: true, rating: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.booking.count({ where }),
    ]);

    const res = NextResponse.json({
      bookings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
    res.headers.set("Cache-Control", "private, max-age=10, stale-while-revalidate=60");
    return res;
  } catch (e) {
    return authErrorResponse(e);
  }
}
