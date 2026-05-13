import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authErrorResponse, requireOwner } from "@/lib/auth";

const schema = z.object({ ownerReply: z.string().min(1).max(500) });

// PATCH /api/owner/reviews/:id/reply
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireOwner(req);
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

    const review = await prisma.review.findUnique({
      where: { id: params.id },
      include: { center: { select: { ownerId: true } } },
    });
    if (!review) return NextResponse.json({ error: "Review not found" }, { status: 404 });
    if (session.role !== "ADMIN" && review.center.ownerId !== session.sub) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updated = await prisma.review.update({
      where: { id: params.id },
      data: { ownerReply: parsed.data.ownerReply },
    });
    return NextResponse.json({ review: updated });
  } catch (e) {
    return authErrorResponse(e);
  }
}
