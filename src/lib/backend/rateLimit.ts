import { getKV } from './kv';

/**
 * Rate Limiting Strategy for Commitlabs Public API Endpoints.
 *
 * Uses a fixed-window rate limiting strategy stored in KV (Redis/Upstash).
 * This works across multiple serverless instances.
 *
 * ALL per-route limits are configurable via environment variables so that
 * operators can tune them without a code redeploy (e.g. during load tests,
 * capacity planning, or incident response).  Every variable falls back to a
 * security-reviewed default when absent or set to an invalid value.
 *
 * ┌─────────────────────────────────────────────────┬─────────────────────────────────┬──────────────┬───────────────────────────────────────────────────────────────────────────────────────────┐
 * │ Environment variable                            │ Route / bucket                  │ Default      │ Security rationale                                                                        │
 * ├─────────────────────────────────────────────────┼─────────────────────────────────┼──────────────┼───────────────────────────────────────────────────────────────────────────────────────────┤
 * │ RATE_LIMIT_AUTH_NONCE_MAX_REQUESTS              │ api/auth/nonce                  │ 5 / 60 s     │ Nonce generation is a prerequisite for wallet-signature auth; low limit prevents         │
 * │ RATE_LIMIT_AUTH_NONCE_WINDOW_SECONDS            │                                 │              │ mass-nonce-farming that could be used to probe signing behaviour.                          │
 * ├─────────────────────────────────────────────────┼─────────────────────────────────┼──────────────┼───────────────────────────────────────────────────────────────────────────────────────────┤
 * │ RATE_LIMIT_AUTH_VERIFY_MAX_REQUESTS             │ api/auth/verify                 │ 5 / 60 s     │ Signature-verify is the credential-check endpoint; tight limits slow down automated        │
 * │ RATE_LIMIT_AUTH_VERIFY_WINDOW_SECONDS           │                                 │              │ credential-stuffing and brute-force signature guessing.                                    │
 * ├─────────────────────────────────────────────────┼─────────────────────────────────┼──────────────┼───────────────────────────────────────────────────────────────────────────────────────────┤
 * │ RATE_LIMIT_NONCE_ADDRESS_MAX_REQUESTS           │ auth:nonce:address              │ 3 / 300 s    │ Per-address secondary bucket applied on top of the IP bucket; prevents a single wallet   │
 * │ RATE_LIMIT_NONCE_ADDRESS_WINDOW_SECONDS         │                                 │              │ address from farming nonces even when behind a shared IP (e.g. corporate NAT).            │
 * ├─────────────────────────────────────────────────┼─────────────────────────────────┼──────────────┼───────────────────────────────────────────────────────────────────────────────────────────┤
 * │ RATE_LIMIT_WRITE_MAX_REQUESTS                   │ api/commitments/create          │ 10 / 60 s    │ On-chain write operations are irreversible and gas-intensive; the shared write bucket    │
 * │ RATE_LIMIT_WRITE_WINDOW_SECONDS                 │ api/commitments/settle          │              │ protects both the Soroban network and the operator's signing budget.                      │
 * │                                                 │ api/commitments/early-exit      │              │                                                                                           │
 * ├─────────────────────────────────────────────────┼─────────────────────────────────┼──────────────┼───────────────────────────────────────────────────────────────────────────────────────────┤
 * │ RATE_LIMIT_DEFAULT_MAX_REQUESTS                 │ all other routes (fallback)     │ 20 / 60 s    │ General read/query routes; higher ceiling than write routes because they are cheaper to  │
 * │ RATE_LIMIT_DEFAULT_WINDOW_SECONDS               │                                 │              │ serve, but still bounded to deter scraping and denial-of-service.                         │
 * └─────────────────────────────────────────────────┴─────────────────────────────────┴──────────────┴───────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Invalid values (non-numeric, zero, negative) are silently replaced with the
 * documented default so that a misconfigured deployment never accidentally
 * disables rate limiting.
 */

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function buildLimits(): Record<string, { windowMs: number; maxRequests: number }> {
  // Auth routes — low defaults to resist credential-farming and brute-force
  const authNonceMax = envInt('RATE_LIMIT_AUTH_NONCE_MAX_REQUESTS', 5);
  const authNonceWindowSec = envInt('RATE_LIMIT_AUTH_NONCE_WINDOW_SECONDS', 60);
  const authVerifyMax = envInt('RATE_LIMIT_AUTH_VERIFY_MAX_REQUESTS', 5);
  const authVerifyWindowSec = envInt('RATE_LIMIT_AUTH_VERIFY_WINDOW_SECONDS', 60);
  // Per-address nonce bucket — longer window than the IP bucket
  const nonceAddressMax = envInt('RATE_LIMIT_NONCE_ADDRESS_MAX_REQUESTS', 3);
  const nonceAddressWindowSec = envInt('RATE_LIMIT_NONCE_ADDRESS_WINDOW_SECONDS', 300);
  // Write-heavy routes — tighter limits to protect on-chain operations
  const writeMax = envInt('RATE_LIMIT_WRITE_MAX_REQUESTS', 10);
  const writeWindowSec = envInt('RATE_LIMIT_WRITE_WINDOW_SECONDS', 60);
  // Default bucket for all other routes
  const defaultMax = envInt('RATE_LIMIT_DEFAULT_MAX_REQUESTS', 20);
  const defaultWindowSec = envInt('RATE_LIMIT_DEFAULT_WINDOW_SECONDS', 60);

  return {
    'api/auth/nonce': { windowMs: authNonceWindowSec * 1000, maxRequests: authNonceMax },
    'api/auth/verify': { windowMs: authVerifyWindowSec * 1000, maxRequests: authVerifyMax },
    'auth:nonce:address': { windowMs: nonceAddressWindowSec * 1000, maxRequests: nonceAddressMax },
    // Write-heavy routes — tighter limits to protect on-chain operations
    'api/commitments/create': { windowMs: writeWindowSec * 1000, maxRequests: writeMax },
    'api/commitments/settle': { windowMs: writeWindowSec * 1000, maxRequests: writeMax },
    'api/commitments/early-exit': { windowMs: writeWindowSec * 1000, maxRequests: writeMax },
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

export async function checkRateLimit(key: string, routeId: string): Promise<boolean> {
  const isDev = process.env.NODE_ENV === 'development';
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
    console.error(`[RateLimit] Error checking rate limit for ${routeId}:`, error);
    return true;
  }
}
