import { getKV } from "./kv";

/**
 * Rate Limiting Strategy for Commitlabs Public API Endpoints.
 *
 * Uses a fixed-window rate limiting strategy stored in KV (Redis/Upstash).
 * This works across multiple serverless instances.
 *
 * Limits are configurable via environment variables:
 *   RATE_LIMIT_WRITE_MAX_REQUESTS   — max requests per window for write routes (default: 10)
 *   RATE_LIMIT_WRITE_WINDOW_SECONDS — window size in seconds for write routes (default: 60)
 *   RATE_LIMIT_DEFAULT_MAX_REQUESTS — max requests per window for all other routes (default: 20)
 *   RATE_LIMIT_DEFAULT_WINDOW_SECONDS — window size in seconds for all other routes (default: 60)
 */

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function buildLimits(): Record<string, { windowMs: number; maxRequests: number }> {
  const writeMax = envInt("RATE_LIMIT_WRITE_MAX_REQUESTS", 10);
  const writeWindowSec = envInt("RATE_LIMIT_WRITE_WINDOW_SECONDS", 60);
  const defaultMax = envInt("RATE_LIMIT_DEFAULT_MAX_REQUESTS", 20);
  const defaultWindowSec = envInt("RATE_LIMIT_DEFAULT_WINDOW_SECONDS", 60);

  return {
    "api/auth/nonce": { windowMs: 60 * 1000, maxRequests: 5 },
    "api/auth/verify": { windowMs: 60 * 1000, maxRequests: 5 },
    "auth:nonce:address": { windowMs: 5 * 60 * 1000, maxRequests: 3 },
    // Write-heavy routes — tighter limits to protect on-chain operations
    "api/commitments/create": { windowMs: writeWindowSec * 1000, maxRequests: writeMax },
    "api/commitments/settle": { windowMs: writeWindowSec * 1000, maxRequests: writeMax },
    "api/commitments/early-exit": { windowMs: writeWindowSec * 1000, maxRequests: writeMax },
    default: { windowMs: defaultWindowSec * 1000, maxRequests: defaultMax },
  };
}

/**
 * Returns the configured window duration in seconds for a given route.
 * Used to populate the Retry-After header on 429 responses.
 */
export function getRateLimitWindowSeconds(routeId: string): number {
  const limits = buildLimits();
  const config = limits[routeId] ?? limits.default;
  return Math.ceil(config.windowMs / 1000);
}

export async function checkRateLimit(
  key: string,
  routeId: string,
): Promise<boolean> {
  const isDev = process.env.NODE_ENV === "development";
  const kv = getKV();
  const redisKey = `ratelimit:${routeId}:${key}`;
  const limits = buildLimits();
  const config = limits[routeId] ?? limits.default;

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
