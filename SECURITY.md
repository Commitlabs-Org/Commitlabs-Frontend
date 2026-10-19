# Security Policy

## Supported Versions

We are committed to resolving security vulnerabilities quickly and carefully. Currently, the following versions of CommitLabs are actively supported with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

_Older versions may not receive security updates. Please ensure you are running the latest version._

## HTTP Security Headers

CommitLabs signs financial transactions in the browser, so the front-end is hardened with strict HTTP security headers. Two layers apply to every page:

### Static headers (`next.config.js`)

| Header | Value | Why |
| ------ | ----- | --- |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Prevents protocol downgrade. **Preload note:** the `preload` token is included deliberately; if maintainers want to opt out, remove the token *and* [remove the domain from the preload list](https://hstspreload.org/#removal) — removals take months, so enabling preload is an explicit, sticky decision. |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=()` | The app never needs these sensors/devices; a compromised page element must not be able to reach a camera or a hardware wallet over USB. |
| `Cross-Origin-Opener-Policy` | `same-origin` | Isolates the browsing context from cross-origin popups/redirects. |
| `X-Frame-Options` | `DENY` | Clickjacking protection for the signing flow (changed from `SAMEORIGIN`; nothing needs to frame the app). |
| `X-Content-Type-Options` | `nosniff` | Unchanged. |
| `Referrer-Policy` | `origin-when-cross-origin` | Unchanged. |

### Per-request Content-Security-Policy (`src/middleware.ts`)

A nonce-based CSP is generated per request by `buildCsp()` (`src/lib/security/csp.ts`, a pure function covered by unit tests):

- `script-src 'self' 'nonce-…' 'strict-dynamic'` — only nonce'd, first-party scripts run. `'unsafe-eval'` is added **only in development** for the Next.js dev tooling and must never appear in production builds.
- `connect-src 'self' <Horizon origin> <Soroban RPC origin>` — exactly the origins derived from `NEXT_PUBLIC_HORIZON_URL` and `NEXT_PUBLIC_SOROBAN_RPC_URL` (path stripped, port kept). Invalid configured origins are omitted rather than replaced (fail closed). Changing either env var changes this directive.
- `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, `object-src 'none'`, `upgrade-insecure-requests` (production only).
- `style-src 'self' 'unsafe-inline'` — Next.js injects `<style>` elements at runtime (hydration/styled-jsx styles), so `'unsafe-inline'` for styles is the documented, accepted exception; scripts do not get it.
- The nonce is produced with `crypto.getRandomValues`, base64-encoded, and unique per request. It is sent to the browser on the response CSP header and passed back into rendering via the `x-nonce` request header, which `src/app/layout.tsx` reads to stamp the nonce onto `<html>` and its scripts. Reading that header opts all routes into dynamic (on-demand) rendering — a required trade-off: with static prerendering the per-request nonce could not be embedded in the HTML and the browser would block the app's scripts under `strict-dynamic`.

**Freighter compatibility:** the Freighter wallet injects its provider via the browser extension. Extension content is not subject to the page's CSP, and the app talks to it through `@stellar/freighter-api` (first-party bundle + window events), so wallet connect and signing are unaffected.

**Out of scope (by design):** Subresource Integrity, a CSP reporting backend (`report-uri`/`report-to` are omitted until a receiver exists), and CDN/host-level (e.g. Vercel) configuration.

## Reporting a Vulnerability

We take the security of CommitLabs very seriously. If you discover a security vulnerability, please do **not** open a public issue.

Instead, please report it privately to our security team through GitHub Security Advisories:
[Report a vulnerability](https://github.com/Commitlabs-Org/Commitlabs-Frontend/security/advisories/new)

When reporting a vulnerability, please include:

- A detailed description of the vulnerability and its potential impact.
- Step-by-step instructions or a proof-of-concept to reproduce the issue.
- Any suggested mitigations or fixes, if you have them.

### What to Expect

- We will acknowledge receipt of your vulnerability report within 48 hours.
- We will provide a status update as we investigate and work on a fix.
- We will notify you when the vulnerability is patched and a release is available.
- We kindly ask that you keep the vulnerability confidential until we have published a fix.

Thank you for helping keep the CommitLabs community safe!
