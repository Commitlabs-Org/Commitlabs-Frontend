# Backend Session and CSRF Strategy

Issue: `#126`  
Scope: backend routes that mutate state (`/api/auth`, `/api/commitments`, `/api/attestations`)

## Goals

- Define a consistent authentication session model for browser and API clients.
- Prevent CSRF attacks on browser-originated state-changing requests.
- Keep this as a design and stub reference, not a full implementation.

## Session Options

### Option A: JWT access token + refresh token

- Use short-lived JWT access tokens (for authz checks) and rotate refresh tokens.
- Delivery options:
  - Access token in `Authorization: Bearer <token>` header.
  - Refresh token in `HttpOnly`, `Secure`, `SameSite=Strict` cookie.
- Pros:
  - Works for browser and non-browser API clients.
  - Stateless access-token verification at edge/services.
- Risks/Tradeoffs:
  - Revocation complexity.
  - Token rotation and storage logic required.

### Option B: Signed server cookie session

- Store an opaque signed session ID in `HttpOnly`, `Secure`, `SameSite=Strict` cookie.
- Session data lives server-side (DB/Redis).
- Pros:
  - Immediate revocation and central session control.
  - Smaller attack surface for token misuse in clients.
- Risks/Tradeoffs:
  - Stateful infrastructure dependency (session store).
  - Horizontal scaling requires shared store.

### Option C: Stateless signatures only (wallet/message signing)

- No persistent session cookie or JWT refresh model.
- Each sensitive request includes a wallet signature + nonce/timestamp.
- Pros:
  - Minimal session storage and reduced long-lived credential footprint.
  - Good fit for wallet-native authentication.
- Risks/Tradeoffs:
  - Higher per-request complexity and UX friction.
  - Strict replay protection needed (nonce tracking).

## CSRF Protection Options (Browser-Originated Requests)

### CSRF Option 1: Synchronizer token pattern

- Server issues a CSRF token bound to server-side session.
- Client sends token in custom header (`X-CSRF-Token`) for `POST/PUT/PATCH/DELETE`.
- Server validates against session value.

### CSRF Option 2: Double-submit cookie pattern

- Server sets non-HttpOnly CSRF cookie.
- Client mirrors value in request header/body field.
- Server verifies cookie value equals submitted token.

### CSRF Option 3: SameSite + origin/referer verification (defense-in-depth)

- Require `SameSite=Strict` or `Lax` for auth cookies.
- Validate `Origin` (preferred) and fallback to `Referer` on mutation routes.
- Keep this as an additional layer, not sole protection when cookies authenticate requests.

## Recommended Baseline for Commitlabs

- Session: start with Option B (signed server cookie session) for browser flows.
- CSRF: combine Option 1 (synchronizer token) + Option 3 checks.
- Non-browser/API clients: allow token-based auth path (Option A style bearer token) without cookie CSRF requirements.

## Route-Level Expectations

- `/api/auth`:
  - Create/refresh/revoke session based on chosen session strategy.
  - On successful login, issue CSRF token for browser session.
- `/api/commitments`:
  - Require authenticated session.
  - Enforce CSRF validation for browser cookie-auth requests.
- `/api/attestations`:
  - Require authenticated session.
  - Enforce CSRF validation for browser cookie-auth requests.

## Implementation TODOs

- Add reusable `validateSession(req)` helper.
- Add reusable `validateCsrf(req)` helper for mutation methods.
- Standardize error responses for `401` (unauthenticated) and `403` (csrf/origin failure).
- Add integration tests for:
  - missing/invalid CSRF token
  - cross-origin mutation attempts
  - session expiration and revocation behavior
