import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authErrorResponse, requireOwner } from "@/lib/auth";
import { assertCenterOwner } from "@/lib/owner-guard";

const imageSchema = z.union([
  z.string(),
  z.object({
    url: z.string(),
    tag: z.string().optional(),
    caption: z.string().optional(),
  }),
]);

const schema = z.object({
  name: z.string().min(2).max(128).optional(),
  address: z.string().min(2).max(255).optional(),
  district: z.string().min(1).max(64).optional(),
  description: z.string().max(2000).nullish(),
  images: z.array(imageSchema).optional(),
  lat: z.number().min(-90).max(90).nullish(),
  lng: z.number().min(-180).max(180).nullish(),
});

// PATCH /api/owner/centers/:id — update center info
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireOwner(req);
    await assertCenterOwner(session, params.id);

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
    }

    const center = await prisma.pCCenter.update({
      where: { id: params.id },
      data: parsed.data,
    });
    return NextResponse.json({ center });
  } catch (e) {
    return authErrorResponse(e);
  }
}

// GET /api/owner/centers/:id — full center detail for owner
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireOwner(req);
    await assertCenterOwner(session, params.id);

    const center = await prisma.pCCenter.findUnique({
      where: { id: params.id },
      include: {
        floors: { orderBy: { floorNumber: "asc" } },
        seatTypes: { orderBy: { name: "asc" } },
        seats: {
          include: {
            floor: { select: { id: true, floorNumber: true, name: true } },
            type: { select: { id: true, name: true, pricePerHour: true } },
          },
          orderBy: { number: "asc" },
        },
        cancelPolicy: true,
        _count: { select: { bookings: true, reviews: true } },
      },
    });
    if (!center) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ center });
  } catch (e) {
    return authErrorResponse(e);
  }
}
