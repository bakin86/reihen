import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authErrorResponse, getSession } from "@/lib/auth";
import { normalizePhoneForAuth } from "@/lib/phone";

// POST /api/auth/staff-invite — accept a staff invite by token
export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    const invite = await prisma.staffInvite.findUnique({ where: { token } });

    if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
      return NextResponse.json({ error: "Invalid or expired invite" }, { status: 400 });
    }

    // Verify phone matches
    const user = await prisma.user.findUnique({
      where: { id: session.sub },
      select: { phone: true, role: true },
    });
    if (!user || normalizePhoneForAuth(user.phone) !== normalizePhoneForAuth(invite.phone)) {
      return NextResponse.json({ error: "Phone number does not match invite" }, { status: 403 });
    }

    // Accept invite
    await prisma.$transaction(async (tx) => {
      await tx.staffInvite.update({
        where: { id: invite.id },
        data: { usedAt: new Date() },
      });
      await tx.centerStaff.create({
        data: {
          userId: session.sub,
          centerId: invite.centerId,
        },
      });
      if (user.role === "PLAYER") {
        await tx.user.update({
          where: { id: session.sub },
          data: { role: "STAFF" },
        });
      }
    });

    return NextResponse.json({ accepted: true, centerId: invite.centerId });
  } catch (e) {
    return authErrorResponse(e);
  }
}
