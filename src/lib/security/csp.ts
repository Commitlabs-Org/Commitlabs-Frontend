/**
 * Pure Content-Security-Policy (CSP) builder.
 *
 * Kept free of Next.js / runtime imports so it can be unit-tested and reused
 * from middleware. See SECURITY.md ("HTTP Security Headers") for the rationale
 * behind each directive.
 */

export interface CspOptions {
  /** Per-request, base64-encoded nonce for inline scripts. */
  nonce: string;
  /** Horizon endpoint (may include a path; only the origin is allowed). */
  horizonUrl: string;
  /** Soroban RPC endpoint (may include a path; only the origin is allowed). */
  rpcUrl: string;
  /** In development, `unsafe-eval` is added for the Next.js dev tooling. */
  isDev: boolean;
}

/**
 * Extract the origin (scheme + host + explicit port) from a configured URL.
 * Paths, query strings and fragments are dropped so a configured base URL like
 * `https://horizon.example.com/api` only opens `https://horizon.example.com`.
 *
 * Returns `null` for anything that is not a parseable http(s) URL — wildcard
 * (`*`), scheme-only sources, and typos all end up here and are omitted from
 * the policy rather than replaced with a permissive fallback (fail closed).
 */
export function toOriginOrNull(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (trimmed === '' || trimmed === '*' || /^[a-z][a-z0-9+.-]*:$/i.test(trimmed)) {
    return null;
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Build the CSP header value.
 *
 * - `script-src` is nonce-based with `strict-dynamic`; `unsafe-eval` appears
 *   only in development for the Next.js dev server.
 * - `connect-src` is exactly `'self'` plus the configured Horizon and Soroban
 *   RPC origins (deduplicated). Invalid origins are omitted entirely.
 * - `style-src` keeps `unsafe-inline` because Next.js injects `<style>` tags
 *   at runtime (styled-jsx / hydration styles); the app has no external CSS
 *   beyond its own bundle.
 */
export function buildCsp({ nonce, horizonUrl, rpcUrl, isDev }: CspOptions): string {
  const scriptSrc = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
  if (isDev) {
    scriptSrc.push("'unsafe-eval'");
  }

  const connectOrigins = new Set<string>();
  for (const raw of [horizonUrl, rpcUrl]) {
    const origin = toOriginOrNull(raw);
    if (origin) {
      connectOrigins.add(origin);
    }
  }
  const connectSrc = ["'self'", ...connectOrigins].join(' ');

  const directives: Record<string, string> = {
    'default-src': "'self'",
    'script-src': scriptSrc.join(' '),
    'style-src': "'self' 'unsafe-inline'",
    'img-src': "'self' data:",
    'connect-src': connectSrc,
    'font-src': "'self' data:",
    'object-src': "'none'",
    'base-uri': "'self'",
    'form-action': "'self'",
    'frame-ancestors': "'none'",
  };

  // Only upgrade on real deployments; the dev server runs over plain http://localhost.
  if (!isDev) {
    directives['upgrade-insecure-requests'] = '';
  }

  return Object.entries(directives)
    .map(([directive, value]) => (value ? `${directive} ${value}` : directive))
    .join('; ');
}
