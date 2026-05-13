import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, authErrorResponse } from "@/lib/auth";

// POST /api/favorites/[centerId] — add center to favorites
export async function POST(req: Request, { params }: { params: { centerId: string } }) {
  try {
    const session = await getSession(req);

    const center = await prisma.pCCenter.findUnique({ where: { id: params.centerId } });
    if (!center) {
      return NextResponse.json({ error: "Center not found" }, { status: 404 });
    }

    await prisma.favoriteCenter.upsert({
      where: { userId_centerId: { userId: session.sub, centerId: params.centerId } },
      create: { userId: session.sub, centerId: params.centerId },
      update: {},
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return authErrorResponse(e);
  }
}

// DELETE /api/favorites/[centerId] — remove center from favorites
export async function DELETE(req: Request, { params }: { params: { centerId: string } }) {
  try {
    const session = await getSession(req);

    await prisma.favoriteCenter.deleteMany({
      where: { userId: session.sub, centerId: params.centerId },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return authErrorResponse(e);
  }
}
