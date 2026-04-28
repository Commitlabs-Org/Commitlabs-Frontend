import { getKV } from "./kv";

/**
 * Rate Limiting Strategy for Commitlabs Public API Endpoints.
 *
 * Uses a fixed-window rate limiting strategy stored in KV (Redis).
 * This works across multiple serverless instances.
 */

const LIMITS: Record<string, { windowMs: number; maxRequests: number }> = {
  "api/auth/nonce": { windowMs: 60 * 1000, maxRequests: 5 },
  "api/auth/verify": { windowMs: 60 * 1000, maxRequests: 5 },
  "auth:nonce:address": { windowMs: 5 * 60 * 1000, maxRequests: 3 },
  default: { windowMs: 60 * 1000, maxRequests: 20 },
};

export async function checkRateLimit(
  key: string,
  routeId: string,
): Promise<boolean> {
  const isDev = process.env.NODE_ENV === "development";
  const kv = getKV();
  const redisKey = `ratelimit:${routeId}:${key}`;
  const config = LIMITS[routeId] || LIMITS.default;

  try {
    const count = await kv.incr(redisKey);

    if (count === 1) {
      await kv.expire(redisKey, Math.ceil(config.windowMs / 1000));
    }

    const isAllowed = count <= config.maxRequests;

    if (isDev && !isAllowed) {
      console.warn(
        `[RateLimit] Rate limit exceeded for ${routeId} (key: ${key}). Count: ${count}, Limit: ${config.maxRequests}`,
      );
    }

    return isAllowed;
  } catch (error) {
    console.error(
      `[RateLimit] Error checking rate limit for ${routeId}:`,
      error,
    );
    return true;
  }
}
