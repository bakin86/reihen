import { NextResponse, type NextRequest } from "next/server";
import {
  AUTH_LIMIT,
  API_LIMIT,
  applyRateHeaders,
  getClientKey,
  rateLimit,
  rateLimitResponse,
} from "./lib/rate-limit";

const CSRF_COOKIE = "reihen_csrf";
const CSRF_HEADER = "x-csrf-token";

// Mutation methods that require CSRF validation when using cookie auth
const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Endpoints exempt from CSRF (callbacks from external services, auth endpoints that set cookies)
const CSRF_EXEMPT = [
  "/api/qpay/callback",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/refresh",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/chat",
];

export function middleware(req: NextRequest) {
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

  // CSRF check for cookie-authenticated mutations
  if (
    pathname.startsWith("/api") &&
    MUTATION_METHODS.has(req.method) &&
    !CSRF_EXEMPT.some((p) => pathname.startsWith(p))
  ) {
    const cookieToken = req.cookies.get(CSRF_COOKIE)?.value;
    const headerToken = req.headers.get(CSRF_HEADER);
    // Only enforce CSRF when cookie auth is being used (cookie exists)
    // Bearer-only requests (mobile/API) skip CSRF since they can't be CSRF'd
    if (cookieToken && cookieToken !== headerToken) {
      return NextResponse.json({ error: "CSRF token mismatch" }, { status: 403 });
    }
  }

  // Skip rate limiting in development — all requests share one IP ("unknown")
  // which causes false 429s during rapid dev/hot-reload cycles
  const isDev = process.env.NODE_ENV !== "production";

  if (pathname.startsWith("/api/auth") && !isDev && !isLocalHost) {
    const r = rateLimit(getClientKey(req, "auth"), AUTH_LIMIT.max, AUTH_LIMIT.windowMs);
    if (!r.ok) return rateLimitResponse(r);
    const res = NextResponse.next();
    return applyRateHeaders(res, r);
  }

  if (pathname.startsWith("/api") && !isDev && !isLocalHost) {
    const r = rateLimit(getClientKey(req, "api"), API_LIMIT.max, API_LIMIT.windowMs);
    if (!r.ok) return rateLimitResponse(r);
    const res = NextResponse.next();
    return applyRateHeaders(res, r);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
