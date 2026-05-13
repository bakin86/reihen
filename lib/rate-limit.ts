// Edge-compatible in-memory rate limiter. Per-instance — for multi-node
// deployment swap the backing store for Redis/Upstash.
import { NextResponse, type NextRequest } from "next/server";

type Bucket = { count: number; reset: number };
const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    const reset = now + windowMs;
    buckets.set(key, { count: 1, reset });
    return { ok: true, limit, remaining: limit - 1, reset };
  }
  b.count += 1;
  return {
    ok: b.count <= limit,
    limit,
    remaining: Math.max(0, limit - b.count),
    reset: b.reset,
  };
}

// Policies
export const AUTH_LIMIT = { max: 10, windowMs: 15 * 60_000 }; // 10 per 15 min
export const API_LIMIT = { max: 300, windowMs: 60_000 }; // 300 per minute

/**
 * Extract client IP for rate limiting.
 * Only trusts x-forwarded-for when TRUSTED_PROXY=true is set (behind a reverse proxy).
 * Without it, uses x-real-ip (set by most proxies) or falls back to "unknown".
 * This prevents clients from spoofing x-forwarded-for to bypass rate limits.
 */
export function getClientKey(req: Request | NextRequest, scope: string) {
  const trustProxy = process.env.TRUSTED_PROXY === "true";
  let ip: string;

  if (trustProxy) {
    // Behind a trusted reverse proxy — use the first hop in x-forwarded-for
    ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";
  } else {
    // Direct exposure — only trust x-real-ip (typically set by the server itself)
    // Ignore x-forwarded-for since clients can spoof it
    ip = req.headers.get("x-real-ip") ?? "unknown";
  }

  return `${scope}:${ip}`;
}

export function applyRateHeaders(res: NextResponse, r: RateLimitResult) {
  res.headers.set("X-RateLimit-Limit", String(r.limit));
  res.headers.set("X-RateLimit-Remaining", String(r.remaining));
  res.headers.set("X-RateLimit-Reset", String(Math.ceil(r.reset / 1000)));
  return res;
}

export function rateLimitResponse(r: RateLimitResult): NextResponse {
  const res = NextResponse.json(
    { error: "Too many requests", retryAfter: Math.ceil((r.reset - Date.now()) / 1000) },
    { status: 429 }
  );
  res.headers.set("Retry-After", String(Math.ceil((r.reset - Date.now()) / 1000)));
  return applyRateHeaders(res, r);
}

/** Throw-style helper for route handlers. */
export function enforceRateLimit(
  req: Request | NextRequest,
  scope: string,
  policy: { max: number; windowMs: number }
): RateLimitResult {
  return rateLimit(getClientKey(req, scope), policy.max, policy.windowMs);
}
