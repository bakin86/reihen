import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, authErrorResponse } from "@/lib/auth";

/**
 * POST /api/admin/unlock
 * Body: { email: string }
 * Clears failedLoginAttempts and lockedUntil for the given account.
 * Admin-only.
 */
export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (session.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "email required" }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { email: email.toLowerCase() },
      data: { failedLoginAttempts: 0, lockedUntil: null },
      select: { id: true, email: true, name: true },
    });

    return NextResponse.json({ ok: true, user });
  } catch (e) {
    return authErrorResponse(e);
  }
}
