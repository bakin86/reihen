import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword, revokeAllRefreshTokens } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  token: z.string().min(20),
  password: z.string().min(6).max(128),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
  const reset = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });

  if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
    return NextResponse.json({ error: "Reset link is invalid or expired" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: reset.userId },
      data: {
        password: await hashPassword(parsed.data.password),
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    }),
    prisma.passwordResetToken.update({
      where: { id: reset.id },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.updateMany({
      where: { userId: reset.userId, id: { not: reset.id }, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);
  await revokeAllRefreshTokens(reset.userId);

  return NextResponse.json({ ok: true });
}
