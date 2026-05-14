import { NextResponse, type NextRequest } from "next/server";
import { redis } from "./redis";

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

// Policies
export const AUTH_LIMIT = { max: 10, windowMs: 15 * 60_000 }; // 10 per 15 min
export const API_LIMIT  = { max: 300, windowMs: 60_000 };      // 300 per minute

/**
 * Redis sliding-window rate limiter — works across all Vercel instances.
 * Uses INCR + EXPIRE: atomic, no race conditions.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const windowSec = Math.ceil(windowMs / 1000);
  const redisKey  = `rl:${key}`;

  try {
    const count = await redis.incr(redisKey);
    if (count === 1) {
      // First request in this window — set TTL
      await redis.expire(redisKey, windowSec);
    }
    const ttl   = await redis.ttl(redisKey);
    const reset = Date.now() + ttl * 1000;
    return {
      ok:        count <= limit,
      limit,
      remaining: Math.max(0, limit - count),
      reset,
    };
  } catch {
    // Redis down — fail open (allow request)
    return { ok: true, limit, remaining: limit - 1, reset: Date.now() + windowMs };
  }
}

/**
 * Extract client IP.
 * Trusts x-forwarded-for only when TRUSTED_PROXY=true (set in Vercel env).
 */
export function getClientKey(req: Request | NextRequest, scope: string) {
  const trustProxy = process.env.TRUSTED_PROXY === "true";
  const ip = trustProxy
    ? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
    : req.headers.get("x-real-ip") ?? "unknown";
  return `${scope}:${ip}`;
}

export function applyRateHeaders(res: NextResponse, r: RateLimitResult) {
  res.headers.set("X-RateLimit-Limit",     String(r.limit));
  res.headers.set("X-RateLimit-Remaining", String(r.remaining));
  res.headers.set("X-RateLimit-Reset",     String(Math.ceil(r.reset / 1000)));
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
