import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  authErrorResponse,
  hashPassword,
  signToken,
  createRefreshToken,
  setAuthCookies,
  generateCsrfToken,
} from "@/lib/auth";
import { normalizePhoneForAuth } from "@/lib/phone";

const schema = z.object({
  name: z.string().min(2).max(64),
  email: z.string().email().toLowerCase(),
  password: z.string().min(6).max(128),
  phone: z.string().transform(normalizePhoneForAuth).pipe(z.string().regex(/^\d{8,12}$/, "Invalid phone")),
  role: z.enum(["PLAYER", "OWNER"]).default("PLAYER"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { name, email, password, phone, role } = parsed.data;

    const conflict = await prisma.user.findFirst({
      where: { OR: [{ email }, { phone }] },
      select: { email: true, phone: true },
    });
    if (conflict) {
      return NextResponse.json(
        { error: conflict.email === email ? "Email already in use" : "Phone already in use" },
        { status: 409 }
      );
    }

    // Check for pending staff invite by phone
    const staffInvite = await prisma.staffInvite.findFirst({
      where: {
        phone: { in: [phone, `976${phone}`, `+976${phone}`] },
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    const finalRole = staffInvite ? "STAFF" : role;

    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        role: finalRole,
        password: await hashPassword(password),
      },
      select: { id: true, name: true, email: true, phone: true, role: true, balance: true },
    });

    // Auto-accept staff invite if present
    if (staffInvite) {
      await prisma.$transaction([
        prisma.staffInvite.update({
          where: { id: staffInvite.id },
          data: { usedAt: new Date() },
        }),
        prisma.centerStaff.create({
          data: { userId: user.id, centerId: staffInvite.centerId },
        }),
      ]);
    }

    const sessionPayload = { sub: user.id, role: user.role, email: user.email };
    const [token, refreshToken] = await Promise.all([
      signToken(sessionPayload),
      createRefreshToken(user.id),
    ]);
    const csrfToken = generateCsrfToken();

    const res = NextResponse.json({ token, refreshToken, csrfToken, user }, { status: 201 });
    return setAuthCookies(res, token, refreshToken, csrfToken);
  } catch (e) {
    return authErrorResponse(e);
  }
}
