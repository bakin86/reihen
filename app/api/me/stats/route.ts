import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, authErrorResponse } from "@/lib/auth";
import { cacheGet, cacheSet } from "@/lib/redis";

// GET /api/me/stats — aggregated user stats
export async function GET(req: Request) {
  try {
    const session = await getSession(req);

    // Serve from cache if fresh (60s per user)
    const cacheKey = `user:stats:${session.sub}`;
    const cached = await cacheGet<object>(cacheKey);
    if (cached) {
      const res = NextResponse.json(cached);
      res.headers.set("X-Cache", "HIT");
      return res;
    }

    const [user, bookingAgg, topCenters, monthlyRaw, favoritesCount] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.sub },
        select: { totalPlayHours: true, noShowCount: true, balance: true },
      }),

      // Total spent + booking count
      prisma.booking.aggregate({
        where: { userId: session.sub, status: { in: ["CONFIRMED", "NOSHOW"] } },
        _sum: { totalPrice: true },
        _count: true,
      }),

      // Top 3 centers by total hours
      prisma.booking.groupBy({
        by: ["centerId"],
        where: { userId: session.sub, status: { in: ["CONFIRMED", "NOSHOW"] } },
        _sum: { hours: true, totalPrice: true },
        _count: true,
        orderBy: { _sum: { hours: "desc" } },
        take: 3,
      }),

      // Monthly spending for last 6 months
      prisma.$queryRaw<{ month: string; total: number }[]>`
        SELECT to_char("startTime", 'YYYY-MM') AS month, COALESCE(SUM("totalPrice"), 0)::int AS total
        FROM "Booking"
        WHERE "userId" = ${session.sub}
          AND "status" IN ('CONFIRMED', 'NOSHOW')
          AND "startTime" >= (date_trunc('month', now()) - interval '5 months')
        GROUP BY to_char("startTime", 'YYYY-MM')
        ORDER BY month ASC
      `,

      prisma.favoriteCenter.count({ where: { userId: session.sub } }),
    ]);

    // Resolve center names for top centers
    const centerIds = topCenters.map((tc) => tc.centerId);
    const centers = await prisma.pCCenter.findMany({
      where: { id: { in: centerIds } },
      select: { id: true, name: true, images: true },
    });
    const centerMap = new Map(centers.map((c) => [c.id, c]));

    const topCentersWithNames = topCenters.map((tc) => ({
      centerId: tc.centerId,
      name: centerMap.get(tc.centerId)?.name ?? "Unknown",
      image: (centerMap.get(tc.centerId)?.images as string[])?.[0] ?? null,
      hours: tc._sum.hours ?? 0,
      spent: tc._sum.totalPrice ?? 0,
      visits: tc._count,
    }));

    // Build 6-month array (fill missing months with 0)
    const months: { month: string; total: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const found = monthlyRaw.find((m) => m.month === key);
      months.push({ month: key, total: Number(found?.total ?? 0) });
    }

    const payload = {
      totalHours: user?.totalPlayHours ?? 0,
      totalSpent: bookingAgg._sum.totalPrice ?? 0,
      bookingCount: bookingAgg._count,
      noShowCount: user?.noShowCount ?? 0,
      balance: user?.balance ?? 0,
      favoritesCount,
      topCenters: topCentersWithNames,
      monthlySpending: months,
    };

    await cacheSet(cacheKey, payload, 60);

    const res = NextResponse.json(payload);
    res.headers.set("X-Cache", "MISS");
    return res;
  } catch (e) {
    return authErrorResponse(e);
  }
}
