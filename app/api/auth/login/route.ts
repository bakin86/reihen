import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  authErrorResponse,
  signToken,
  createRefreshToken,
  verifyPassword,
  recordFailedLogin,
  clearFailedLogins,
  isAccountLocked,
  setAuthCookies,
  generateCsrfToken,
} from "@/lib/auth";

// Pre-computed dummy hash for constant-time comparison when user doesn't exist.
const DUMMY_HASH = "$2a$12$000000000000000000000u2GoOQGaLGOasOEE7.YiAHENOrFa.yGS";

const schema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: {
        id: true, name: true, email: true, phone: true,
        role: true, balance: true, password: true,
        isActive: true, lockedUntil: true,
      },
    });

    // Always run bcrypt regardless of user existence — prevents timing-based
    // user enumeration AND prevents distinguishing "locked" from "not found"
    // via response time.
    const passwordOk = await verifyPassword(
      parsed.data.password,
      user?.password ?? DUMMY_HASH
    );

    if (!user || !user.isActive) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    if (isAccountLocked(user)) {
      const retryAfter = Math.ceil((user.lockedUntil!.getTime() - Date.now()) / 1000);
      return NextResponse.json(
        { error: "Account temporarily locked. Try again later.", retryAfter },
        { status: 429 }
      );
    }

    if (!passwordOk) {
      await recordFailedLogin(user.id);
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    await clearFailedLogins(user.id);

    const sessionPayload = { sub: user.id, role: user.role, email: user.email };
    const [token, refreshToken] = await Promise.all([
      signToken(sessionPayload),
      createRefreshToken(user.id),
    ]);
    const csrfToken = generateCsrfToken();

    const userData = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      balance: user.balance,
    };

    const res = NextResponse.json({ token, refreshToken, csrfToken, user: userData });
    return setAuthCookies(res, token, refreshToken, csrfToken);
  } catch (e) {
    return authErrorResponse(e);
  }
}
