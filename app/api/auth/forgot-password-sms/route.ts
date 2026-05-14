import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateOTP, sendOTP, normalizeMNPhone } from "@/lib/sms";

const schema = z.object({
  phone: z.string().min(8).max(16),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    // Always return ok to avoid phone enumeration
    return NextResponse.json({ ok: true });
  }

  const phone = normalizeMNPhone(parsed.data.phone);
  const user = await prisma.user.findUnique({
    where: { phone },
    select: { id: true, isActive: true },
  });

  if (user?.isActive) {
    // Invalidate previous OTPs for this user
    await prisma.smsOtp.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const code = generateOTP(6);
    const codeHash = createHash("sha256").update(code).digest("hex");

    await prisma.smsOtp.create({
      data: {
        userId: user.id,
        codeHash,
        expiresAt: new Date(Date.now() + 10 * 60_000), // 10 min
      },
    });

    await sendOTP(phone, code).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
