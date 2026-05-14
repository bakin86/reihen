import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, revokeAllRefreshTokens } from "@/lib/auth";
import { normalizeMNPhone } from "@/lib/sms";

const schema = z.object({
  phone: z.string().min(8).max(16),
  code: z.string().length(6),
  password: z.string().min(6).max(128),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const phone = normalizeMNPhone(parsed.data.phone);
  const user = await prisma.user.findUnique({
    where: { phone },
    select: { id: true, isActive: true },
  });

  if (!user?.isActive) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  const codeHash = createHash("sha256").update(parsed.data.code).digest("hex");

  const otp = await prisma.smsOtp.findFirst({
    where: {
      userId: user.id,
      codeHash,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!otp) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        password: await hashPassword(parsed.data.password),
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    }),
    prisma.smsOtp.update({
      where: { id: otp.id },
      data: { usedAt: new Date() },
    }),
  ]);

  await revokeAllRefreshTokens(user.id);

  return NextResponse.json({ ok: true });
}
