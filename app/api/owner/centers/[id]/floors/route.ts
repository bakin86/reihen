import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authErrorResponse, requireOwner } from "@/lib/auth";
import { assertCenterOwner } from "@/lib/owner-guard";
import { checkCanAddFloor } from "@/lib/subscription";

const createSchema = z.object({
  floorNumber: z.number().int().min(1),
  name: z.string().min(1).max(64),
});

// POST /api/owner/centers/:id/floors — add floor
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireOwner(req);
    await assertCenterOwner(session, params.id);

    if (session.role !== "ADMIN") {
      const check = await checkCanAddFloor(session.sub, params.id);
      if (!check.allowed) {
        const msg = check.reason === "NO_SUBSCRIPTION"
          ? "Subscription required"
          : `Floor limit reached (${check.current}/${check.max} on ${check.sub!.plan} plan). Upgrade to add more.`;
        return NextResponse.json({ error: msg, code: check.reason, redirectTo: "/owner/subscription" }, { status: 403 });
      }
    }

    const parsed = createSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

    const floor = await prisma.floor.create({
      data: { centerId: params.id, ...parsed.data },
    });
    return NextResponse.json({ floor }, { status: 201 });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "Floor number already exists" }, { status: 409 });
    }
    return authErrorResponse(e);
  }
}

const updateSchema = z.object({
  floorId: z.string().min(1),
  name: z.string().min(1).max(64).optional(),
});

// PATCH /api/owner/centers/:id/floors — update floor name
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireOwner(req);
    await assertCenterOwner(session, params.id);
    const parsed = updateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

    const floor = await prisma.floor.update({
      where: { id: parsed.data.floorId },
      data: { name: parsed.data.name },
    });
    return NextResponse.json({ floor });
  } catch (e) {
    return authErrorResponse(e);
  }
}

const deleteSchema = z.object({ floorId: z.string().min(1) });

// DELETE /api/owner/centers/:id/floors
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireOwner(req);
    await assertCenterOwner(session, params.id);
    const parsed = deleteSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

    const seatCount = await prisma.seat.count({ where: { floorId: parsed.data.floorId } });
    if (seatCount > 0) {
      return NextResponse.json({ error: `Cannot delete — ${seatCount} seats on this floor` }, { status: 409 });
    }

    await prisma.floor.delete({ where: { id: parsed.data.floorId } });
    return NextResponse.json({ deleted: true });
  } catch (e) {
    return authErrorResponse(e);
  }
}
