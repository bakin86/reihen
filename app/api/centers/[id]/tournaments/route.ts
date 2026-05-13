import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/centers/[id]/tournaments — public list of upcoming/live tournaments
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const tournaments = await prisma.tournament.findMany({
    where: {
      centerId: params.id,
      status: { in: ["UPCOMING", "REGISTRATION_CLOSED", "LIVE"] },
    },
    include: { _count: { select: { teams: true } } },
    orderBy: { startTime: "asc" },
  });

  return NextResponse.json({ tournaments });
}
