import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authErrorResponse, getSession } from "@/lib/auth";
import { cacheGet, cacheSet } from "@/lib/redis";
import type { BookingStatus } from "@prisma/client";

// GET /api/bookings/history?page=1&limit=20&status=CONFIRMED
export async function GET(req: Request) {
  try {
    const session = await getSession(req);
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 20));
    const status = searchParams.get("status") as BookingStatus | null;

    // Cache per user+page+status for 30s
    const cacheKey = `user:history:${session.sub}:${page}:${limit}:${status ?? "ALL"}`;
    const cached = await cacheGet<object>(cacheKey);
    if (cached) {
      const res = NextResponse.json(cached);
      res.headers.set("X-Cache", "HIT");
      return res;
    }

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

    const payload = {
      bookings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    await cacheSet(cacheKey, payload, 30);

    const res = NextResponse.json(payload);
    res.headers.set("Cache-Control", "private, max-age=10, stale-while-revalidate=60");
    res.headers.set("X-Cache", "MISS");
    return res;
  } catch (e) {
    return authErrorResponse(e);
  }
}
