import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authErrorResponse, requireAdmin } from "@/lib/auth";

const schema = z.object({
  role: z.enum(["PLAYER", "STAFF", "OWNER", "ADMIN"]),
});

// PATCH /api/admin/users/:id/role — promote/demote user (admin only)
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin(req);
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const updated = await prisma.user.update({
      where: { id: params.id },
      data: { role: parsed.data.role },
      select: { id: true, name: true, email: true, role: true },
    });

    return NextResponse.json({ user: updated });
  } catch (e) {
    return authErrorResponse(e);
  }
}
