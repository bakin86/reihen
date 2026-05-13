import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authErrorResponse, requireOwner } from "@/lib/auth";
import { assertCenterOwner } from "@/lib/owner-guard";

const schema = z.object({
  centerId: z.string().min(1),
  cancelMinutes: z.number().int().min(0).max(1440).optional(),
  noShowMinutes: z.number().int().min(0).max(1440).optional(),
  maxSeatsPerBooking: z.number().int().min(1).max(50).optional(),
  refundPolicy: z.enum(["FULL", "PARTIAL", "NONE"]).optional(),
});

// PATCH /api/owner/policy — upsert cancel policy for a center
export async function PATCH(req: Request) {
  try {
    const session = await requireOwner(req);
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
    }
    const { centerId, ...rest } = parsed.data;
    await assertCenterOwner(session, centerId);

    const policy = await prisma.cancelPolicy.upsert({
      where: { centerId },
      create: {
        centerId,
        cancelMinutes: rest.cancelMinutes ?? 30,
        noShowMinutes: rest.noShowMinutes ?? 60,
        maxSeatsPerBooking: rest.maxSeatsPerBooking ?? 10,
        refundPolicy: rest.refundPolicy ?? "FULL",
      },
      update: rest,
    });

    return NextResponse.json({ policy });
  } catch (e) {
    return authErrorResponse(e);
  }
}
