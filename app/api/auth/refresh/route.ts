import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  signToken,
  createRefreshToken,
  verifyRefreshToken,
  setAuthCookies,
  generateCsrfToken,
  REFRESH_COOKIE,
} from "@/lib/auth";

// POST /api/auth/refresh — rotate refresh token, issue new access token
export async function POST(req: NextRequest) {
  try {
    // Try httpOnly cookie first, then body fallback (mobile/API clients)
    const body = await req.json().catch(() => null);
    const refreshToken =
      req.cookies.get(REFRESH_COOKIE)?.value ??
      body?.refreshToken;
    if (!refreshToken || typeof refreshToken !== "string") {
      return NextResponse.json({ error: "Missing refresh token" }, { status: 400 });
    }

    // Verify + delete the used token (single-use rotation)
    const { userId } = await verifyRefreshToken(refreshToken);

    // Fetch current user state (role may have changed)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, phone: true, role: true, balance: true, isActive: true },
    });
    if (!user || !user.isActive) {
      return NextResponse.json({ error: "User not found or inactive" }, { status: 401 });
    }

    const sessionPayload = { sub: user.id, role: user.role, email: user.email };
    const [newToken, newRefresh] = await Promise.all([
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

    const res = NextResponse.json({
      token: newToken,
      refreshToken: newRefresh,
      csrfToken,
      user: userData,
    });
    return setAuthCookies(res, newToken, newRefresh, csrfToken);
  } catch {
    return NextResponse.json({ error: "Invalid refresh token" }, { status: 401 });
  }
}
