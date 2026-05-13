import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authErrorResponse, requireOwner } from "@/lib/auth";

const schema = z.object({
  action: z.enum(["restrict", "unrestrict"]),
  days: z.number().int().min(1).max(365).optional(),
  reason: z.string().trim().max(240).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireOwner(req);
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const ownedCenters = await prisma.pCCenter.findMany({
      where: session.role === "ADMIN" ? {} : { ownerId: session.sub },
      select: { id: true },
    });
    const centerIds = ownedCenters.map((c) => c.id);
    const hasCustomer = await prisma.booking.findFirst({
      where: { userId: params.id, centerId: { in: centerIds } },
      select: { id: true },
    });
    if (!hasCustomer) {
      return NextResponse.json({ error: "Customer not found for your centers" }, { status: 404 });
    }

    if (parsed.data.action === "unrestrict") {
      const user = await prisma.user.update({
        where: { id: params.id },
        data: { isRestricted: false, restrictionReason: null, restrictedUntil: null, restrictedByOwnerId: null },
        select: { id: true, name: true, isRestricted: true, restrictedUntil: true },
      });
      return NextResponse.json({ user });
    }

    const days = parsed.data.days ?? 7;
    const restrictedUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const user = await prisma.user.update({
      where: { id: params.id },
      data: {
        isRestricted: true,
        restrictionReason: parsed.data.reason || "Owner restriction",
        restrictedUntil,
        restrictedByOwnerId: session.sub,
      },
      select: { id: true, name: true, isRestricted: true, restrictionReason: true, restrictedUntil: true },
    });
    return NextResponse.json({ user });
  } catch (e) {
    return authErrorResponse(e);
  }
}
