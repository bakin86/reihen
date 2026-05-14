import { NextResponse, type NextRequest } from "next/server";

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

// Policies
export const AUTH_LIMIT = { max: 30, windowMs: 15 * 60_000 }; // 30 per 15 min (was 10)
export const API_LIMIT  = { max: 300, windowMs: 60_000 };      // 300 per minute

/**
 * Redis sliding-window rate limiter via Upstash REST API.
 * Uses raw fetch so it works in both Edge (middleware) and Node.js runtimes.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    // No Redis configured — fail open
    return { ok: true, limit, remaining: limit - 1, reset: Date.now() + windowMs };
  }

  const windowSec = Math.ceil(windowMs / 1000);
  const redisKey  = `rl:${key}`;

  try {
    // INCR then EXPIRE in a pipeline (two commands, one round-trip)
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify([
        ["INCR", redisKey],
        ["EXPIRE", redisKey, windowSec, "NX"], // only set TTL on first request
        ["TTL", redisKey],
      ]),
    });

    if (!res.ok) throw new Error("Redis pipeline failed");
    const results = await res.json() as { result: number }[];
    const count = results[0].result;
    const ttl   = results[2].result;
    const reset = Date.now() + Math.max(ttl, 0) * 1000;

    return {
      ok:        count <= limit,
      limit,
      remaining: Math.max(0, limit - count),
      reset,
    };
  } catch {
    // Redis down — fail open
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
