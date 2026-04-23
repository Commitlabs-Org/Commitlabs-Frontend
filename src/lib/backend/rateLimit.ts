/**
 * Rate Limiting Strategy for Commitlabs Public API Endpoints.
 *
 * Current Implementation:
 * - Developmental Light Stub: Always allows requests in development mode.
 * - Key-based structure: Ready to be wired into a real backend.
 *
 * Production Recommendation:
 * For production, we should use a distributed rate limiter that works with Next.js edge/serverless functions.
 * Recommended options:
 * 1. Upstash Redis with `@upstash/ratelimit`: Easiest to set up for Next.js, works at the edge.
 * 2. Vercel KV: Similar to Upstash, integrated into Vercel platform.
 * 3. Custom Redis instance: Good for higher volume or existing infrastructure.
 */

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

/**
 * Checks if a request should be rate limited.
 *
 * @param key - A unique identifier for the requester (e.g., IP address, user ID, API key).
 * @param routeId - Identifier for the specific route or resource being accessed.
 * @returns Promise<RateLimitResult> - { allowed: true } if request is allowed,
 *          { allowed: false, retryAfterSeconds: 60 } if rate limited.
 */
export async function checkRateLimit(
  key: string,
  routeId: string
): Promise<RateLimitResult> {
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    console.log(`[RateLimit] Dev mode: Skipping check for key: ${key}, route: ${routeId}`);
    return { allowed: true };
  }

  // TODO: Implement production rate limiting logic here.
  // 1. Initialize connection to Redis/Upstash/KV.
  // 2. Define limits per routeId (e.g., 5 requests per minute for auth).
  // 3. Increment counter and check against window.
  // 4. Return { allowed: false, retryAfterSeconds } when limit exceeded.

  console.warn(`[RateLimit] Production TODO: Rate limiting not yet implemented for ${routeId}. Defaulting to allow.`);
  return { allowed: true };
}
