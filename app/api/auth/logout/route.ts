import { NextResponse } from "next/server";
import { authErrorResponse, getSession, revokeAllRefreshTokens, clearAuthCookies } from "@/lib/auth";

// POST /api/auth/logout — revoke all refresh tokens + clear cookies
export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    await revokeAllRefreshTokens(session.sub);
    const res = NextResponse.json({ ok: true });
    return clearAuthCookies(res);
  } catch (e) {
    return authErrorResponse(e);
  }
}
