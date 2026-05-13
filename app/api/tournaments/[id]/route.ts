import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/tournaments/[id] — public tournament detail
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: params.id },
    include: {
      center: { select: { id: true, name: true, address: true, district: true } },
      teams: {
        select: {
          id: true,
          name: true,
          createdAt: true,
          members: {
            select: { user: { select: { id: true, name: true } } },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { teams: true } },
    },
  });

  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  }

  return NextResponse.json({ tournament });
}
