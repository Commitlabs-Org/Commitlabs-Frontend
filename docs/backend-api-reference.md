# Backend API Reference

This document describes the HTTP API surface exposed by the frontend backend
(`src/app/api`).  The routes are intentionally thin stubs in the current code
base; they exist primarily for analytics hooks and development/testing.

Each entry includes the HTTP method, path, expected request body (if any), and
an example response.  All endpoints return JSON.

## CORS Summary

- Public browser routes return wildcard CORS without credentials.
- First-party browser routes echo only trusted Commitlabs origins and may allow
  credentials.
- Implemented routes answer `OPTIONS` preflight requests automatically.

See [docs/backend-cors-policy.md](./backend-cors-policy.md) for the full
origin configuration and route classification.

---

## Standard Response Conventions

All endpoints follow these conventions.

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "meta": { ... }       // optional pagination / additional metadata
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "TOO_MANY_REQUESTS",
    "message": "Too many requests. Please try again later.",
    "retryAfterSeconds": 60  // present on 429 and 503 only
  }
}
```

### Rate Limited Responses (429 / 503)

When a request is rate-limited, the response includes the `Retry-After` HTTP header:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 60
```

| Status | `retryAfterSeconds` default | Meaning |
|--------|---------------------------|---------|
| 429 | 60 s | Client exceeded rate limit |
| 503 | 30 s | Service temporarily unavailable |

Clients should wait the indicated seconds before retrying. See [error-handling.md](./error-handling.md) for the full client retry strategy (exponential backoff + jitter).

---

## `POST /api/marketplace/listings/[id]/purchase`

Purchases a marketplace listing. Requires an active session cookie. Runs
preflight eligibility checks, triggers on-chain ownership transfer, and records
the event in the audit log.

- **Authentication**: session cookie (`requireAuth`)
- **Path parameter**: `id` — the marketplace listing ID
- **Request body**: none
- **Response**:
  - `200 OK`: Purchase completed.
  - `401 Unauthorized`: Missing or invalid session.
  - `404 Not Found`: Listing does not exist.
  - `409 Conflict`: Preflight failed (e.g. listing inactive, buyer is seller).
  - `502 Bad Gateway`: On-chain transfer failed.

### Example

```bash
curl -X POST http://localhost:3000/api/marketplace/listings/listing_1/purchase \
     -H 'Cookie: session=<token>'
```

```json
{
  "success": true,
  "data": {
    "listingId": "listing_1",
    "commitmentId": "cm_abc",
    "buyerAddress": "GBUYER...",
    "price": "52000",
    "currencyAsset": "USDC",
    "txHash": null,
    "reference": "TODO_CHAIN_CALL_TRANSFER_OWNERSHIP"
  }
}
```

---

## `POST /api/commitments`

Creates a new commitment on the Stellar network.

- **Headers**:
    - `Idempotency-Key`: (Optional) A unique string to identify the request and prevent duplicate processing. Recommended for safe retries.
- **Request body**:
    - `ownerAddress`: (string, required) The Stellar address of the owner.
    - `asset`: (string, required) The asset code.
    - `amount`: (string, required) The amount to commit.
    - `durationDays`: (number, required) The duration of the commitment in days.
    - `maxLossBps`: (number, required) Maximum loss in basis points.
    - `metadata`: (object, optional) Additional metadata.
- **Response**:
    - `201 Created`: The commitment was successfully created.
    - `409 Conflict`: A request with the same `Idempotency-Key` is already in progress.
    - `429 Too Many Requests`: Rate limit exceeded.

### Example

```bash
curl -X POST http://localhost:3000/api/commitments \
     -H 'Content-Type: application/json' \
     -d '{"asset":"XLM","amount":100}'
```

```json
{
  "message": "Commitments creation endpoint stub - rate limiting applied",
  "ip": "::1"
}
```

---

## `POST /api/commitments/[id]/settle`

Marks the commitment identified by `id` as settled.  Currently a stub that emits `CommitmentSettled` events.

- **Path parameter**: `id` (string)
- **Headers**:
    - `Idempotency-Key`: (Optional) A unique string to identify the request and prevent duplicate processing. Replayed requests within the 24-hour replay window return the original prior result.
- **Request body**: optional JSON payload with additional details.
- **Response**: stub confirmation message.

### Example

```bash
curl -X POST http://localhost:3000/api/commitments/abc123/settle \
     -H 'Content-Type: application/json' \
     -d '{"finalValue":105}'
```

```json
{
  "message": "Stub settlement endpoint for commitment abc123",
  "commitmentId": "abc123"
}
```

---

## `POST /api/commitments/[id]/fund`

Funds an existing commitment that was previously created but not yet funded. The route validates ownership, enforces `CREATED` state, and submits the on-chain `fund_escrow` transaction.

- **Path parameter**: `id` (string)
- **Headers**:
    - `Idempotency-Key`: (Optional) A unique string to identify the request and prevent duplicate processing. Replayed requests within the 24-hour replay window return the original prior result.
- **Request body**:
    - `callerAddress` (string, optional) — Stellar address of the funding wallet. If omitted, the commitment owner is used.
- **Response**: confirmation of the funded commitment with `txHash` and `reference`.

### Example

```bash
curl -X POST http://localhost:3000/api/commitments/abc123/fund \
     -H 'Content-Type: application/json' \
     -d '{"callerAddress":"GOWNER..."}'
```

```json
{
  "success": true,
  "data": {
    "commitmentId": "abc123",
    "txHash": "tx-abc123",
    "reference": "funded",
    "fundedAt": "2026-05-27T00:00:00.000Z"
  }
}
```

---

## `POST /api/commitments/[id]/early-exit`

Triggers an early exit (with penalty) for the named commitment.  Emits `CommitmentEarlyExit` events.

- **Path parameter**: `id` (string)
- **Headers**:
    - `Idempotency-Key`: (Optional) A unique string to identify the request and prevent duplicate processing. Replayed requests within the 24-hour replay window return the original prior result.
- **Request body**: optional JSON with penalty or reason.
- **Response**: stub message.

### Example

```bash
curl -X POST http://localhost:3000/api/commitments/abc123/early-exit \
     -H 'Content-Type: application/json' \
     -d '{"reason":"user-request"}'
```

```json
{
  "message": "Stub early-exit endpoint for commitment abc123",
  "commitmentId": "abc123"
}
```

---

## `GET /api/attestations/recent`

Returns the most recent attestations sorted by `observedAt` descending, with
page-based pagination metadata.

- **Query parameters**:
    - `page`: (integer, optional) Page number (1-based). Must be ≥ 1. Defaults to 1.
    - `pageSize`: (integer, optional) Items per page. Must be 1–100. Defaults to 10.
    - `ownerAddress`: (string, optional) Filter by commitment owner address. Requires a valid `Authorization: Bearer <token>` header.
- **Response**: `200 OK` with attestation list and pagination meta.
- **Error codes**:
    - `400 VALIDATION_ERROR` — `page` or `pageSize` out of range, or `ownerAddress` is blank.
    - `401 UNAUTHORIZED` — `ownerAddress` provided without a valid Bearer token.
    - `429 TOO_MANY_REQUESTS` — Rate limit exceeded.

### Example

```bash
curl 'http://localhost:3000/api/attestations/recent?page=1&pageSize=2'
```

```json
{
  "success": true,
  "data": {
    "attestations": [
      { "id": "ATT-005", "commitmentId": "CMT-005", "observedAt": "2026-04-24T10:00:00Z" },
      { "id": "ATT-004", "commitmentId": "CMT-004", "observedAt": "2026-04-23T10:00:00Z" }
    ],
    "total": 5
  },
  "meta": {
    "page": 1,
    "pageSize": 2,
    "total": 5,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

Filtered by owner (requires authentication):

```bash
curl 'http://localhost:3000/api/attestations/recent?ownerAddress=GAAA...WHF' \
     -H 'Authorization: Bearer <token>'
```

---

## `POST /api/attestations`

Records an attestation event.  Stub implementation logs
`AttestationReceived`.

- **Request body**: JSON describing the attestation (e.g. signature,
commitmentId).
- **Response**: stub message with requester IP.

### Example

```bash
curl -X POST http://localhost:3000/api/attestations \
     -H 'Content-Type: application/json' \
     -d '{"commitmentId":"abc123","status":"valid"}'
```

```json
{
  "message": "Attestations recording endpoint stub - rate limiting applied",
  "ip": "::1"
}
```

---

## `GET /api/notifications`

Returns the authenticated owner's derived notification feed. Notifications are
derived on-read from the owner's commitments and attestations (expiry warnings,
violations, attestation health checks); they are not persisted.

The feed is filtered by the owner's **notification delivery preferences**. Each
notification has a `type` (`expiry`, `violation`, `health_check`), and only
types the owner has opted into are returned. Preferences are read from stored
user preferences (the `notificationCategories` field) and updated via the
`PUT /api/user/preferences` endpoint.

- **Query parameters**:
    - `ownerAddress`: (string, required) The Stellar address whose feed to return.
    - `page`: (number, optional, default `1`) 1-indexed page number. Must be `>= 1`.
    - `pageSize`: (number, optional, default `10`) Items per page. Must be `1`–`100`.
- **Preference filtering**:
    - Notification categories the owner has set to `false` in
      `notificationCategories` are excluded from the feed.
    - When no preferences are stored, or a category key is absent, the category
      is **delivered by default** (safe opt-in). An owner only stops receiving a
      category by explicitly opting out.
    - Filtering is applied **before pagination**, so `total` reflects the count
      of notifications the owner can actually see — not the raw derived count.
- **Response**:
    - `200 OK`: Paginated, preference-filtered feed.
    - `400 Bad Request`: `ownerAddress` is missing, or pagination params are out of range.
    - `429 Too Many Requests`: Rate limit exceeded.

### Example

```bash
curl 'http://localhost:3000/api/notifications?ownerAddress=0x123&page=1&pageSize=10'
```

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        "ownerAddress": "0x123",
        "title": "Commitment Nearing Expiry",
        "message": "Your commitment CMT-1 for XLM expires in 5 days.",
        "severity": "warning",
        "type": "expiry",
        "read": false,
        "createdAt": "2026-02-25T00:00:00.000Z",
        "relatedCommitmentId": "CMT-1"
      }
    ],
    "page": 1,
    "pageSize": 10,
    "total": 1
  }
}
```

---

## `GET /api/protocol/constants`

Returns the public protocol constants used by UX copy and calculations, including fee parameters, penalty tiers, and commitment limits. This endpoint is public and includes caching headers.

### Example

```bash
curl http://localhost:3000/api/protocol/constants
```

```json
{
  "success": true,
  "data": {
    "protocolVersion": "v1",
    "network": "Test SDF Network ; September 2015",
    "fees": {
      "networkBaseFeeStroops": 100,
      "platformFeePercent": 0
    },
    "penalties": [...],
    "commitmentLimits": { ... },
    "cachedAt": "2026-02-25T00:00:00.000Z"
  }
}
```

---

## `GET /api/commitments/[id]/events`

Server-Sent Events (SSE) stream that pushes real-time commitment status updates and transitions (Active, Settled, Early Exit, Violated).

- **Path parameter**: `id` (string)
- **Headers**:
    - `Accept`: `text/event-stream` (required)
- **Security**: Requires an authenticated session via browser cookies.
- **Protocol Details**:
    - **Snapshot**: The server emits a `snapshot` event immediately upon connection carrying the current status.
    - **Transitions**: The server emits a `status_change` event only when a status transition is detected on-chain.
    - **Heartbeat**: The server enqueues a comment heartbeat (`: keepalive`) every 20 seconds to prevent intermediates (proxies, load balancers) from dropping the idle connection.

### Example Event Output

```text
event: snapshot
data: {"commitmentId":"abc123","status":"Active","timestamp":"2026-05-27T01:30:00.000Z"}

: keepalive

event: status_change
data: {"commitmentId":"abc123","status":"Settled","timestamp":"2026-05-27T01:30:15.000Z"}
```

### Client Reconnection & Backoff Guidelines

- **Automatic Reconnection**: Standard browser `EventSource` handles connection drops and reconnection attempts automatically.
- **Exponential Backoff**: For non-browser clients or custom connection wrappers, implement exponential backoff on reconnection failures:
  1. Start with an initial delay of `1 second`.
  2. Double the delay on each consecutive failure (`2s`, `4s`, `8s`, `16s`).
  3. Cap the maximum delay at `30 seconds` to protect server resources.
- **Graceful Fallback**: When SSE is unsupported or fails repeatedly, clients should fall back to polling the lightweight `/api/commitments/[id]/status` route at a standard, low-frequency interval (e.g., every 10–30 seconds).

---

## `GET /api/metrics`

Simple health/metrics endpoint used by monitoring tools.

- **Response**: JSON object containing uptime, mock request/error counts, and
current timestamp.

### Example

```bash
curl http://localhost:3000/api/metrics
```

```json
{
  "status": "up",
  "uptime": 123.456,
  "mock_requests_total": 789,
  "mock_errors_total": 2,
  "timestamp": "2026-02-25T00:00:00.000Z"
}
```

---

> 🔧 _This reference will grow as the backend implements real business logic._

```
