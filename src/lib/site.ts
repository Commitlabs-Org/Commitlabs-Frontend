/**
 * Single source of truth for the public site URL.
 *
 * Resolves a canonical origin from environment variables (in priority order):
 *   1. NEXT_PUBLIC_SITE_URL  – public-safe, inlined at build time
 *   2. SITE_URL              – server-only
 *   3. APP_URL               – server-only
 *   4. NEXT_PUBLIC_APP_URL   – public-safe, inlined at build time
 *   5. VERCEL_PROJECT_PRODUCTION_URL – added by Vercel for the production deployment
 *   6. VERCEL_URL            – added by Vercel for the current deployment
 *
 * If none of the above is set, the production fallback `https://commitlabs.com`
 * is returned. This keeps sitemap.ts, robots.ts, layout.tsx, and metadata
 * references to the canonical site in lockstep.
 *
 * Note: this is server-side only. The App Router runs layout.tsx / sitemap.ts /
 * robots.ts on the server, so `process.env` is always available here.
 */

const SITE_URL_FALLBACK = 'https://commitlabs.com';

const SITE_URL_ENV_KEYS = [
  'NEXT_PUBLIC_SITE_URL',
  'SITE_URL',
  'APP_URL',
  'NEXT_PUBLIC_APP_URL',
  'VERCEL_PROJECT_PRODUCTION_URL',
  'VERCEL_URL',
] as const;

function normalizeSiteUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('SITE_URL must not be empty');
  }

  const withProtocol =
    trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? trimmed
      : `https://${trimmed}`;

  // `URL` throws on invalid inputs; the caller decides whether to skip or fail.
  return new URL(withProtocol).origin;
}

/**
 * Resolves the site origin from the provided env-like object.
 *
 * - Returns the first non-empty env value, normalized to an origin
 *   (scheme + host + port, no trailing slash).
 * - Falls back to `SITE_URL_FALLBACK` when nothing is configured or every
 *   configured value is invalid.
 */
export function resolveSiteUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  for (const key of SITE_URL_ENV_KEYS) {
    const value = env[key];
    if (!value || !value.trim()) continue;

    try {
      return normalizeSiteUrl(value);
    } catch {
      // Invalid value — try the next key, then fall back below.
    }
  }
  return SITE_URL_FALLBACK;
}

let cachedSiteUrl: string | null = null;

/**
 * Returns the resolved site origin, memoized after the first call.
 * Tests can reset the cache with `__resetSiteUrlForTests()`.
 */
export function getSiteUrl(): string {
  if (cachedSiteUrl !== null) return cachedSiteUrl;
  cachedSiteUrl = resolveSiteUrl();
  return cachedSiteUrl;
}

/** Clears the module-level site URL cache. For tests only. */
export function __resetSiteUrlForTests(): void {
  cachedSiteUrl = null;
}