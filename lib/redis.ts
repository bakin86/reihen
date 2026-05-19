import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

export const isRedisConfigured = Boolean(url && token);

// Upstash Redis uses HTTP, so it works well in Vercel serverless.
export const redis = isRedisConfigured
  ? new Redis({ url: url!, token: token! })
  : null;

function toCacheValue(value: unknown) {
  if (value === undefined) return null;

  return JSON.parse(
    JSON.stringify(value, (_key, nestedValue) => {
      if (typeof nestedValue === "bigint") return Number(nestedValue);
      return nestedValue;
    }),
  );
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  try {
    return await redis.get<T>(key);
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number) {
  if (!redis) return;
  try {
    await redis.set(key, toCacheValue(value), { ex: ttlSeconds });
  } catch {
    // non-fatal
  }
}

export async function cacheDel(...keys: string[]) {
  if (!redis) return;
  try {
    if (keys.length > 0) await redis.del(...keys);
  } catch {
    // non-fatal
  }
}
