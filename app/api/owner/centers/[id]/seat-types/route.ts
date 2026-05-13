import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authErrorResponse, requireOwner } from "@/lib/auth";
import { assertCenterOwner } from "@/lib/owner-guard";
import { checkCanAddSeatType } from "@/lib/subscription";

const createSchema = z.object({
  name: z.string().min(1).max(64),
  pricePerHour: z.number().int().min(0),
  description: z.string().max(500).optional(),
  images: z.array(z.string()).default([]),
});

// POST /api/owner/centers/:id/seat-types — add seat type
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireOwner(req);
    await assertCenterOwner(session, params.id);

    if (session.role !== "ADMIN") {
      const check = await checkCanAddSeatType(session.sub, params.id);
      if (!check.allowed) {
        const msg = check.reason === "NO_SUBSCRIPTION"
          ? "Subscription required"
          : `Seat type limit reached (${check.current}/${check.max} on ${check.sub!.plan} plan). Upgrade to add more.`;
        return NextResponse.json({ error: msg, code: check.reason, redirectTo: "/owner/subscription" }, { status: 403 });
      }
    }

    const parsed = createSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

    const seatType = await prisma.seatType.create({
      data: { centerId: params.id, ...parsed.data, images: parsed.data.images },
    });
    return NextResponse.json({ seatType }, { status: 201 });
  } catch (e) {
    return authErrorResponse(e);
  }
}

const updateSchema = z.object({
  typeId: z.string().min(1),
  name: z.string().min(1).max(64).optional(),
  pricePerHour: z.number().int().min(0).optional(),
  description: z.string().max(500).nullish(),
});

// PATCH /api/owner/centers/:id/seat-types — update seat type
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireOwner(req);
    await assertCenterOwner(session, params.id);
    const parsed = updateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

    const { typeId, ...data } = parsed.data;
    const seatType = await prisma.seatType.update({
      where: { id: typeId },
      data,
    });
    return NextResponse.json({ seatType });
  } catch (e) {
    return authErrorResponse(e);
  }
}

const deleteSchema = z.object({ typeId: z.string().min(1) });

// DELETE /api/owner/centers/:id/seat-types
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireOwner(req);
    await assertCenterOwner(session, params.id);
    const parsed = deleteSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

    const seatCount = await prisma.seat.count({ where: { typeId: parsed.data.typeId } });
    if (seatCount > 0) {
      return NextResponse.json({ error: `Cannot delete — ${seatCount} seats use this type` }, { status: 409 });
    }

    await prisma.seatType.delete({ where: { id: parsed.data.typeId } });
    return NextResponse.json({ deleted: true });
  } catch (e) {
    return authErrorResponse(e);
  }
}
