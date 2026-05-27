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

## `GET /api/commitments/[id]`

Returns the full details of a single commitment, including a computed fee breakdown.

- **Path parameter**: `id` (string) — the commitment identifier.
- **Response**:
  - `200 OK`: Commitment found; body contains the commitment data and `feeBreakdown`.
  - `404 Not Found`: No commitment exists for the given `id`.
  - `500 Internal Server Error`: Protocol constants could not be loaded or fee calculation failed.

### Response Shape

```typescript
{
  success: true,
  data: {
    // Core commitment fields (unchanged)
    commitmentId: string;
    owner: string;
    rules: object | null;
    amount: string;           // base-asset units, integer string
    asset: string;
    createdAt: string;        // ISO 8601
    expiresAt: string;        // ISO 8601
    currentValue: string;
    status: string;
    daysRemaining: number | null;
    drawdownPercent: number | null;
    maxLossPercent: number | null;
    tokenId: string | null;
    nftMetadataLink: string | null;

    // New field
    feeBreakdown: {
      creationFee: {
        platformFeeAmount: string;   // integer string, truncated (no decimal point)
        networkFeeAmount: string;    // exactly 7 decimal places
        totalFeeAmount: string;      // string sum of platform + network
      };
      settlementFee: {
        platformFeeAmount: string;   // same formula as creationFee
        networkFeeAmount: string;    // same formula as creationFee
        totalFeeAmount: string;
      };
      rateSnapshot: {
        platformFeePercent: number;       // number, not string
        networkBaseFeeStroops: number;    // number, not string
      };
    };
  },
  meta: {
    correlationId: string;
    timestamp: string;
  }
}
```

### `feeBreakdown` Field Details

#### `creationFee` and `settlementFee`

Both sub-objects use the same formula and will always be equal for a given commitment amount and protocol constants.

| Field | Type | Description |
|---|---|---|
| `platformFeeAmount` | `string` | Platform fee in base-asset units. Computed as `Math.trunc(amount × platformFeePercent / 100)`. Truncated to zero decimal places (floor toward zero). |
| `networkFeeAmount` | `string` | Stellar network fee in XLM. Computed as `networkBaseFeeStroops / 10,000,000`, expressed to exactly seven decimal places. |
| `totalFeeAmount` | `string` | String representation of the numeric sum of `platformFeeAmount` and `networkFeeAmount`. |

> **All monetary values are strings** (`platformFeeAmount`, `networkFeeAmount`, `totalFeeAmount`) to prevent floating-point drift.

#### `rateSnapshot`

| Field | Type | Description |
|---|---|---|
| `platformFeePercent` | `number` | The platform fee percentage used for this calculation. |
| `networkBaseFeeStroops` | `number` | The Stellar network base fee in stroops used for this calculation. |

> **`rateSnapshot` fields are numbers, not strings.**

> **Important:** `rateSnapshot` reflects the protocol constants at the time of the request, not at the time the commitment was originally created. If protocol constants change between commitment creation and a later request, `rateSnapshot` will reflect the current constants.

### Rounding Rules

- **Platform fee** (`platformFeeAmount`): Truncated to zero decimal places using integer truncation (floor toward zero). For example, `101 × 1% = 1.01` → `"1"`, not `"2"`.
- **Network fee** (`networkFeeAmount`): Expressed to exactly seven decimal places (stroop ÷ 10,000,000). For example, `100 stroops` → `"0.0000100"`.

### Example

Given a commitment with `amount = "10000"` and current protocol constants `platformFeePercent = 1`, `networkBaseFeeStroops = 100`:

```bash
curl http://localhost:3000/api/commitments/abc123
```

```json
{
  "success": true,
  "data": {
    "commitmentId": "abc123",
    "owner": "GABC...XYZ",
    "amount": "10000",
    "asset": "XLM",
    "status": "active",
    "daysRemaining": 30,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "feeBreakdown": {
      "creationFee": {
        "platformFeeAmount": "100",
        "networkFeeAmount": "0.0000100",
        "totalFeeAmount": "100.00001"
      },
      "settlementFee": {
        "platformFeeAmount": "100",
        "networkFeeAmount": "0.0000100",
        "totalFeeAmount": "100.00001"
      },
      "rateSnapshot": {
        "platformFeePercent": 1,
        "networkBaseFeeStroops": 100
      }
    }
  },
  "meta": {
    "correlationId": "req_abc123",
    "timestamp": "2026-06-01T12:00:00.000Z"
  }
}
```

**Calculation breakdown for this example:**
- Platform fee: `Math.trunc(10000 × 1 / 100)` = `Math.trunc(100)` = `"100"`
- Network fee: `(100 / 10,000,000).toFixed(7)` = `"0.0000100"`
- Total fee: `100 + 0.0000100` = `"100.00001"`

---

## `POST /api/commitments/[id]/settle`

Marks the commitment identified by `id` as settled.  Currently a stub that emits
`CommitmentSettled` events.

- **Path parameter**: `id` (string)
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

## `POST /api/commitments/[id]/early-exit`

Triggers an early exit (with penalty) for the named commitment.  Emits
`CommitmentEarlyExit` events.

- **Path parameter**: `id` (string)
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
