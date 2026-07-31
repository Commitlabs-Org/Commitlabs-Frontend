/**
 * Single source-of-truth for the canonical CommitLabs site URL.
 *
 * The site URL is used in SEO-adjacent places (sitemap, robots, the root
 * layout's OpenGraph + Schema.org JSON-LD metadata). Previously these
 * declared the hardcoded literal `https://commitlabs.com` in at least
 * half a dozen files, making it painful to swap the production domain
 * or point at a staging/preview URL.
 *
 * Resolution order (first non-empty wins):
 *   1. NEXT_PUBLIC_SITE_URL (browser-safe — inlined into the client bundle)
 *   2. SITE_URL             (server-only fallback)
 *   3. 'https://commitlabs.com' (production default)
 *
 * Trailing slashes are trimmed so `${SITE_URL}/foo` always renders as
 * `https://commitlabs.com/foo` rather than `https://commitlabs.com//foo`.
 *
 * NOTE: This constant is evaluated once at module load. To swap URLs at
 * runtime, set the relevant env var before the module is required.
 */

const FALLBACK_SITE_URL = 'https://commitlabs.com';

function resolveRawSiteUrl(): string {
  const candidates = [process.env.NEXT_PUBLIC_SITE_URL, process.env.SITE_URL, FALLBACK_SITE_URL];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return FALLBACK_SITE_URL;
}

/**
 * Canonical site URL with no trailing slash. Read this constant from
 * sitemap.ts, robots.ts, layout.tsx, and any other SEO/canonical surface.
 */
export const SITE_URL = resolveRawSiteUrl().replace(/\/+$/, '');
