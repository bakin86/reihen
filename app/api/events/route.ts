import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/events - public event/tournament list across all centers
export async function GET() {
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

  return NextResponse.json({ events });
}
