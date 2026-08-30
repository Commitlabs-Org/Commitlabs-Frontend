import { createHash } from 'crypto';
import { performance } from 'perf_hooks';
import { TooManyRequestsError } from '@/lib/backend/errors';
import { checkRateLimit, getRateLimitWindowSeconds } from '@/lib/backend/rateLimit';

/**
 * Market rate-limit enforcement with operational visibility and bounded retry values.
 *
 * Invariants:
 * - `ip` and `action` must be non-empty strings and within explicit length bounds.
 * - Retry-after is sanitized to a positive integer within [1, 3600] seconds, preventing client
 *   confusion and unbounded wait times.
 * - Rate-limit events are logged with an anonymized IP hash to aid diagnosis without leaking PII.
 * - Unexpected errors from downstream rate-limit storage are caught, logged, and re-thrown as
 *   a generic error to avoid leaking internal details.
 */
const MAX_IP_LENGTH = 64;
const MAX_ACTION_LENGTH = 128;

export async function enforceMarketplaceRateLimit(ip: string, action: string): Promise<void> {
  if (!ip || typeof ip !== 'string' || ip.length > MAX_IP_LENGTH) {
    throw new Error(`Marketplace rate-limit: ip must be a non-empty string <= ${MAX_IP_LENGTH} chars`);
  }
  if (!action || typeof action !== 'string' || action.length > MAX_ACTION_LENGTH) {
    throw new Error(`Marketplace rate-limit: action must be a non-empty string <= ${MAX_ACTION_LENGTH} chars`);
  }

  const start = performance.now();
  let allowed: boolean;
  try {
    allowed = await checkRateLimit(ip, action);
  } catch (error) {
    const durationMs = performance.now() - start;
    const ipHash = anonymizeIp(ip);
    console.error(
      JSON.stringify({
        event: 'marketplace.rate_limit_check_failed',
        action,
        ipHash,
        durationMs: Math.round(durationMs * 100) / 100,
        errorMessage: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      }),
    );
    throw new Error('Rate limit check failed. Please try again later.');
  }

  const durationMs = performance.now() - start;
  const ipHash = anonymizeIp(ip);

  if (!allowed) {
    const rawRetryAfter = getRateLimitWindowSeconds(action);
    // Bound the retry-after value to a sane range.
    const retryAfterSeconds = Math.min(Math.max(1, Math.floor(rawRetryAfter)), 3600);

    console.info(
      JSON.stringify({
        event: 'marketplace.rate_limit_exceeded',
        action,
        ipHash,
        retryAfterSeconds,
        durationMs: Math.round(durationMs * 100) / 100,
        timestamp: new Date().toISOString(),
      }),
    );

    throw new TooManyRequestsError(
      'Too many requests. Please try again later.',
      undefined,
      retryAfterSeconds,
    );
  }

  // Optional: log allowed checks at debug level. Use console.debug to avoid noise.
  console.debug(
    JSON.stringify({
      event: 'marketplace.rate_limit_allowed',
      action,
      ipHash,
      durationMs: Math.round(durationMs * 100) / 100,
      timestamp: new Date().toISOString(),
    }),
  );
}

function anonymizeIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 16);
}
