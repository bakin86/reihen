import { Redis } from "@upstash/redis";

// Upstash Redis — HTTP-based, works in Vercel serverless + Edge
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// ─── Cache helpers ────────────────────────────────────────

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    return await redis.get<T>(key);
  } catch {
    return null; // degrade gracefully if Redis is down
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number) {
  try {
    await redis.set(key, value, { ex: ttlSeconds });
  } catch {
    // non-fatal
  }
}

export async function cacheDel(...keys: string[]) {
  try {
    if (keys.length > 0) await redis.del(...keys);
  } catch {
    // non-fatal
  }
}
