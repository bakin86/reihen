import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cacheGet, cacheSet } from "@/lib/redis";

// GET /api/events - public event/tournament list across all centers
export async function GET() {
  const cacheKey = "events:public";
  const cached = await cacheGet<{ events: unknown[] }>(cacheKey);
  if (cached) {
    const res = NextResponse.json(cached);
    res.headers.set("Cache-Control", "public, max-age=60, stale-while-revalidate=120");
    res.headers.set("X-Cache", "HIT");
    return res;
  }

  const events = await prisma.tournament.findMany({
    where: {
      status: { in: ["UPCOMING", "REGISTRATION_CLOSED", "LIVE"] },
    },
    include: {
      center: {
        select: {
          id: true,
          name: true,
          district: true,
          address: true,
        },
      },
      _count: { select: { teams: true } },
    },
    orderBy: [{ status: "asc" }, { startTime: "asc" }],
    take: 60,
  });

  const payload = { events };
  await cacheSet(cacheKey, payload, 60);

  const res = NextResponse.json(payload);
  res.headers.set("Cache-Control", "public, max-age=60, stale-while-revalidate=120");
  res.headers.set("X-Cache", "MISS");
  return res;
}
