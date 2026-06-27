# PR Documentation: Backend CSRF Coverage

## Summary

This PR extends CSRF protection unit test coverage for browser-session mutation endpoints.
It exercises the `src/lib/backend/csrf.ts` helper across valid and invalid token branches, including double-submit cookie verification and CSRF rotation behavior.

## What changed

- Extended `src/lib/backend/csrf.test.ts` with new coverage for:
  - freshly generated CSRF token verification against the same browser session
  - empty CSRF header rejection
  - token mismatch when the header token belongs to a different session
  - CSRF token rotation: old token rejected, new token accepted
  - same-origin validation for `assertSameOriginForCookieSession`
- Verified the CSRF helper behavior using `./node_modules/.bin/vitest run src/lib/backend/csrf.test.ts`

## Why this matters

- Ensures cookie-authenticated write routes are protected by the double-submit CSRF pattern.
- Prevents attackers from abusing valid session cookies with tampered or stale CSRF tokens.
- Confirms the implementation rejects invalid, empty, or mismatched header tokens.
- Validates that token rotation behavior preserves security while allowing a new token to be accepted.

## How to verify

1. Run the focused CSRF unit tests:
   - `./node_modules/.bin/vitest run src/lib/backend/csrf.test.ts`
2. Confirm all tests pass:
   - `17 tests passed`
3. Optionally run the full test suite to ensure no regressions:
   - `pnpm test`

## Notes

- No production code behavior was changed; this PR extends test coverage only.
- The CSRF helper already enforces same-origin checks and bearer-token bypass for API clients.
- The new tests make the double-submit flow explicit and cover tamper/mismatch branches.
