# PR Documentation: Backend CSRF Coverage

## Summary

This PR strengthens the backend CSRF test suite for browser-session mutation endpoints.
It adds focused coverage around the double-submit cookie flow implemented in `src/lib/backend/csrf.ts`, with emphasis on token freshness, session binding, rotation, and origin validation.

## What changed

- Expanded `src/lib/backend/csrf.test.ts` to cover:
  - fresh CSRF token verification for the same browser session
  - rejection of empty or missing CSRF headers
  - rejection when the header token belongs to a different session
  - token rotation behavior where the old token is rejected and the new token is accepted
  - same-origin enforcement for `assertSameOriginForCookieSession`
- Verified the behavior with:
  - `./node_modules/.bin/vitest run src/lib/backend/csrf.test.ts`

## Why this matters

- Protects cookie-authenticated write routes from forged cross-site requests.
- Ensures stale or tampered CSRF tokens cannot be replayed with a valid session cookie.
- Confirms the helper continues to reject mismatched, empty, and cross-session token values.
- Makes the intended security behavior explicit and regression-resistant.

## Testing

1. Run the focused CSRF unit tests:
   - `./node_modules/.bin/vitest run src/lib/backend/csrf.test.ts`
2. Confirm the result:
   - `17 tests passed`
3. Optionally run the wider suite for regression coverage:
   - `pnpm test`

## Notes

- No production behavior was changed; this PR is test coverage focused.
- The existing CSRF helper already enforces same-origin checks and avoids enforcement for bearer-token API clients.
- These additions make the security contract easier to audit and maintain over time.
