import { getKV } from './kv';

/**
 * Rate Limiting Strategy for Commitlabs Public API Endpoints.
 * 
 * Uses a fixed-window rate limiting strategy stored in KV (Redis).
 * This works across multiple serverless instances.
 */

// Configuration for different route types
const LIMITS: Record<string, { windowMs: number; maxRequests: number }> = {
    'api/auth/nonce': { windowMs: 60 * 1000, maxRequests: 5 }, // 5 requests per minute per IP
    'api/auth/verify': { windowMs: 60 * 1000, maxRequests: 5 }, // 5 requests per minute per IP
    'auth:nonce:address': { windowMs: 5 * 60 * 1000, maxRequests: 3 }, // 3 nonces per 5 minutes per address
    'default': { windowMs: 60 * 1000, maxRequests: 20 },
};

/**
 * Checks if a request should be rate limited.
 * 
 * @param key - A unique identifier for the requester (e.g., IP address, address).
 * @param routeId - Identifier for the specific route or resource being accessed.
 * @returns Promise<boolean> - Returns true if the request is allowed, false if rate limited.
 */
export async function checkRateLimit(key: string, routeId: string): Promise<boolean> {
    const isDev = process.env.NODE_ENV === 'development';
    const kv = getKV();

    // Use a composite key for the rate limit
    const redisKey = `ratelimit:${routeId}:${key}`;
    const config = LIMITS[routeId] || LIMITS['default'];
    
    try {
        const count = await kv.incr(redisKey);
        
        if (count === 1) {
            // First request in the window, set expiration
            await kv.expire(redisKey, Math.ceil(config.windowMs / 1000));
        }

        const isAllowed = count <= config.maxRequests;

        if (isDev && !isAllowed) {
            console.warn(`[RateLimit] Rate limit exceeded for ${routeId} (key: ${key}). Count: ${count}, Limit: ${config.maxRequests}`);
        }

        return isAllowed;
    } catch (error) {
        console.error(`[RateLimit] Error checking rate limit for ${routeId}:`, error);
        // Fail open in case of KV issues to avoid blocking users, but log the error
        return true;
    }
}
