import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authErrorResponse, requireOwner } from "@/lib/auth";

// GET /api/owner/dashboard?centerId=...
export async function GET(req: Request) {
  try {
    const session = await requireOwner(req);
    const { searchParams } = new URL(req.url);
    const centerIdParam = searchParams.get("centerId") ?? undefined;

    const centers = await prisma.pCCenter.findMany({
      where: session.role === "ADMIN" ? {} : { ownerId: session.sub },
      select: { id: true, name: true },
    });
    if (centers.length === 0) {
      return NextResponse.json({ error: "No centers found" }, { status: 404 });
    }
    const centerIds = centerIdParam ? [centerIdParam] : centers.map((c) => c.id);
    if (centerIdParam && !centers.some((c) => c.id === centerIdParam)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Today boundaries in Ulaanbaatar TZ via current process TZ
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 3_600_000);

    const [income, bookingCount, openSeats, totalSeats, hourlyRaw, recent, riskRaw] = await Promise.all([
      prisma.booking.aggregate({
        _sum: { totalPrice: true },
        where: {
          centerId: { in: centerIds },
          paymentStatus: "PAID",
          createdAt: { gte: start, lt: end },
        },
      }),
      prisma.booking.count({
        where: { centerId: { in: centerIds }, createdAt: { gte: start, lt: end } },
      }),
      prisma.seat.count({ where: { centerId: { in: centerIds }, status: "OPEN" } }),
      prisma.seat.count({ where: { centerId: { in: centerIds } } }),
      // Peak hours: group by hour using raw SQL for efficiency
      prisma.$queryRaw<{ h: number; cnt: bigint; inc: bigint }[]>(
        Prisma.sql`
          SELECT HOUR(startTime) as h, COUNT(*) as cnt, COALESCE(SUM(totalPrice),0) as inc
          FROM Booking
          WHERE centerId IN (${Prisma.join(centerIds)})
            AND startTime >= ${fourteenDaysAgo}
            AND status IN ('CONFIRMED','PENDING')
          GROUP BY HOUR(startTime)
        `
      ),
      prisma.booking.findMany({
        where: { centerId: { in: centerIds } },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          bookingSeats: {
            select: { seatId: true, seat: { select: { number: true, status: true } } },
          },
          user: { select: { id: true, name: true, phone: true, noShowCount: true, isRestricted: true, restrictionReason: true, restrictedUntil: true } },
        },
      }),
      prisma.booking.groupBy({
        by: ["userId"],
        where: { centerId: { in: centerIds } },
        _count: { _all: true },
        orderBy: { _count: { userId: "desc" } },
        take: 12,
      }),
    ]);

    const peakHours = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0, income: 0 }));
    for (const row of hourlyRaw) {
      const h = Number(row.h);
      if (h >= 0 && h < 24) {
        peakHours[h].count = Number(row.cnt);
        peakHours[h].income = Number(row.inc);
      }
    }

    const riskUsers = await prisma.user.findMany({
      where: { id: { in: riskRaw.map((r) => r.userId) } },
      select: {
        id: true,
        name: true,
        phone: true,
        noShowCount: true,
        isRestricted: true,
        restrictionReason: true,
        restrictedUntil: true,
      },
    });
    const bookingCountByUser = new Map(riskRaw.map((r) => [r.userId, r._count._all]));
    const riskCustomers = riskUsers
      .map((u) => ({
        ...u,
        bookingCount: bookingCountByUser.get(u.id) ?? 0,
        riskScore: u.noShowCount * 3 + (u.isRestricted ? 5 : 0) + Math.min(bookingCountByUser.get(u.id) ?? 0, 5),
      }))
      .filter((u) => u.noShowCount > 0 || u.isRestricted || u.bookingCount >= 2)
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 8);

    return NextResponse.json({
      centerIds,
      today: {
        income: income._sum.totalPrice ?? 0,
        bookingCount,
        openSeats,
        totalSeats,
        occupancy: totalSeats === 0 ? 0 : 1 - openSeats / totalSeats,
      },
      peakHours,
      recentBookings: recent,
      riskCustomers,
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}
