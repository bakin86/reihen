import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authErrorResponse, requireOwner } from "@/lib/auth";

// GET /api/owner/reviews?centerId=...&page=1
export async function GET(req: Request) {
  try {
    const session = await requireOwner(req);
    const { searchParams } = new URL(req.url);
    const centerIdParam = searchParams.get("centerId") ?? undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const take = 20;

    const centers = await prisma.pCCenter.findMany({
      where: session.role === "ADMIN" ? {} : { ownerId: session.sub },
      select: { id: true, name: true },
    });
    if (!centers.length) return NextResponse.json({ reviews: [], total: 0, centers: [] });

    const centerIds = centerIdParam
      ? centers.some((c) => c.id === centerIdParam) ? [centerIdParam] : []
      : centers.map((c) => c.id);

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { centerId: { in: centerIds } },
        include: {
          user: { select: { id: true, name: true, phone: true } },
          center: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * take,
        take,
      }),
      prisma.review.count({ where: { centerId: { in: centerIds } } }),
    ]);

    return NextResponse.json({ reviews, total, centers });
  } catch (e) {
    return authErrorResponse(e);
  }
}
