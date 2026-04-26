# Backend Session and CSRF Strategy

Issues: `#126`, `#247`  
Scope: cookie-backed browser sessions and CSRF for state-changing API routes.

## Goals

- Consistent session model for browser clients (opaque server-side session id).
- CSRF protection on browser-originated mutations when a session cookie is present.
- Non-browser clients: `Authorization: Bearer <token>` skips CSRF (no cookie session assumption).

## Implemented behavior (current codebase)

### Cookies

| Name | Attributes | Purpose |
|------|------------|---------|
| `cl_session` | `HttpOnly`, `SameSite=Lax`, `Secure` in production, `Path=/`, 7-day `Max-Age` | Opaque session id; server maps id → CSRF synchronizer token (and optional wallet metadata). |

Session store is **in-memory** (`src/lib/backend/session.ts`) — replace with Redis/DB for production and horizontal scale.

### CSRF (synchronizer + origin)

- Server stores a random CSRF token per session.
- Browser sends **`X-CSRF-Token`** (header name lowercased as `x-csrf-token` over HTTP) on `POST`, `PUT`, `PATCH`, `DELETE` when **`cl_session` is present**.
- **`Origin`** must equal the request URL origin, or **`Referer`** must match that origin (prefix or exact). Otherwise **`403`** with `error.code: CSRF_INVALID`.
- If **no** `cl_session` cookie is sent, mutations behave as before (CSRF not required) so legacy clients keep working until they opt into sessions.

Implementation: `assertMutationCsrf` in [`src/lib/backend/csrf.ts`](../src/lib/backend/csrf.ts).

### Bearer bypass

Requests with `Authorization: Bearer <non-empty>` **skip** CSRF enforcement (intended for API clients not using cookie sessions).

### Endpoints

| Route | Session issuance | CSRF enforced on mutations |
|-------|-------------------|---------------------------|
| `POST /api/auth` | Sets `cl_session`, returns `csrfToken` in JSON | N/A (creates session) |
| `POST /api/auth/verify` | Sets `cl_session` after wallet verify, returns `csrfToken` | N/A |
| `GET /api/auth/csrf` | Requires `cl_session`; returns current `csrfToken` | N/A |
| `POST /api/commitments` | — | Yes, when cookie present |
| `POST /api/commitments/[id]/settle` | — | Yes |
| `POST /api/commitments/[id]/early-exit` | — | Yes |
| `POST /api/attestations` | — | Yes |
| `POST /api/marketplace/listings` | — | Yes |
| `DELETE /api/marketplace/listings/[id]` | — | Yes |

### Error shape (403 CSRF)

JSON body matches [`fail`](../src/lib/backend/apiResponse.ts): `success: false`, `error.code` **`CSRF_INVALID`**, human-readable `error.message`.

### CORS and credentials

- Do **not** use `Access-Control-Allow-Origin: *` together with `Access-Control-Allow-Credentials: true`.
- This repo does not add wildcard CORS for credentialed cross-origin access; keep any future CORS allowlist explicit.

## Original design options (reference)

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
- Current implementation uses **opaque id + server map** (step toward Option B).

### Option C: Stateless signatures only (wallet/message signing)

- No persistent session cookie or JWT refresh model.
- Each sensitive request includes a wallet signature + nonce/timestamp.
- `/api/auth/verify` still performs wallet verification; session cookie is issued **after** verification for subsequent browser mutations.

## Client usage (SPA)

1. Call `POST /api/auth` or `POST /api/auth/verify` with `credentials: 'include'`.
2. Read `csrfToken` from the JSON body (or call `GET /api/auth/csrf` with the session cookie).
3. On each mutating request, send:
   - `credentials: 'include'`
   - Header `X-CSRF-Token: <csrfToken>`
   - Same-origin `Origin` (default for `fetch` from the app).

## Test coverage (CSRF modules)

Run:

```bash
npm run test:coverage:csrf
```

This enforces **≥95%** statements/lines/functions and **≥90%** branches on `csrf.ts`, `session.ts`, and `sessionCookies.ts` only.
