import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/centers/:id/reviews
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const reviews = await prisma.review.findMany({
    where: { centerId: params.id },
    select: {
      id: true,
      rating: true,
      comment: true,
      ownerReply: true,
      createdAt: true,
      user: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const res = NextResponse.json({ reviews });
  res.headers.set("Cache-Control", "public, max-age=60, stale-while-revalidate=120");
  return res;
}
