import { NextResponse, type NextRequest } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";
import {
  AUTH_LIMIT,
  API_LIMIT,
  applyRateHeaders,
  getClientKey,
  rateLimit,
  rateLimitResponse,
} from "./lib/rate-limit";
import { isClerkPublicConfigured } from "./lib/clerk-config";

const CSRF_COOKIE = "reihen_csrf";
const CSRF_HEADER = "x-csrf-token";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const CSRF_EXEMPT = [
  "/api/qpay/callback",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/refresh",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/chat",
];

async function appMiddleware(req: NextRequest) {
  const { pathname, hostname } = req.nextUrl;
  const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0";

  // HTTPS redirect in production
  if (
    process.env.NODE_ENV === "production" &&
    req.headers.get("x-forwarded-proto") === "http" &&
    !isLocalHost
  ) {
    const url = req.nextUrl.clone();
    url.protocol = "https";
    return NextResponse.redirect(url, 301);
  }

  // CSRF check
  if (
    pathname.startsWith("/api") &&
    MUTATION_METHODS.has(req.method) &&
    !CSRF_EXEMPT.some((p) => pathname.startsWith(p))
  ) {
    const cookieToken = req.cookies.get(CSRF_COOKIE)?.value;
    const headerToken = req.headers.get(CSRF_HEADER);
    if (cookieToken && cookieToken !== headerToken) {
      return NextResponse.json({ error: "CSRF token mismatch" }, { status: 403 });
    }
  }

  const isDev = process.env.NODE_ENV !== "production";
  if (isDev || isLocalHost) return NextResponse.next();

  // Redis-backed rate limiting (cross-instance, accurate per-IP)
  if (pathname.startsWith("/api/auth")) {
    const r = await rateLimit(getClientKey(req, "auth"), AUTH_LIMIT.max, AUTH_LIMIT.windowMs);
    if (!r.ok) return rateLimitResponse(r);
    return applyRateHeaders(NextResponse.next(), r);
  }

  if (pathname.startsWith("/api")) {
    const r = await rateLimit(getClientKey(req, "api"), API_LIMIT.max, API_LIMIT.windowMs);
    if (!r.ok) return rateLimitResponse(r);
    return applyRateHeaders(NextResponse.next(), r);
  }

  return NextResponse.next();
}

export default isClerkPublicConfigured()
  ? clerkMiddleware((_auth, req) => appMiddleware(req))
  : appMiddleware;

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
    "/api/:path*",
  ],
};
