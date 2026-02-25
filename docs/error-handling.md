# Rate Limit (429) and Server (5xx) Error Handling
**Reference:** [#133 - Define consistent behavior for rate limit and server errors](https://github.com/Commitlabs-Org/Commitlabs-Frontend/issues/133)

This document defines how the Commitlabs-Frontend backend responds to rate limiting (429) and server-side errors (5xx), and how developers should use the error helpers and `withApiHandler` wrapper.

---

## Overview

All API routes in this project must use the `withApiHandler` wrapper from `src/utils/withApiHandler.ts`. This ensures that 429 and 5xx errors are always returned in a consistent JSON shape, with the correct HTTP status codes and headers — including `Retry-After` where appropriate.

---

## Standard Error Response Shape

Every error response follows this structure:

```json
{
  "success": false,
  "error": {
    "code": 429,
    "type": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please wait before trying again.",
    "retryAfter": 60
  }
}
```

| Field | Type | Always Present | Description |
|-------|------|----------------|-------------|
| `success` | `boolean` | ✅ | Always `false` for errors |
| `error.code` | `number` | ✅ | HTTP status code |
| `error.type` | `string` | ✅ | Machine-readable error type |
| `error.message` | `string` | ✅ | Human-readable message safe for UI display |
| `error.retryAfter` | `number` | ❌ | Seconds to wait — only on 429 and 503 |
| `error.details` | `string` | ❌ | Internal detail — development mode only, never in production |

---

## Error Types Reference

### 429 — Rate Limit Exceeded

**When to use:** The client has sent too many requests in a given time window.

```json
{
  "success": false,
  "error": {
    "code": 429,
    "type": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please wait before trying again.",
    "retryAfter": 60
  }
}
```

**HTTP Headers returned:**
```
Content-Type: application/json
Retry-After: 60
```

---

### 500 — Internal Server Error

**When to use:** An unexpected error occurred with no specific identifiable cause.

```json
{
  "success": false,
  "error": {
    "code": 500,
    "type": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred. Please try again later."
  }
}
```

---

### 502 — Bad Gateway

**When to use:** An upstream service (e.g. Soroban RPC node) returned an invalid or unreadable response.

```json
{
  "success": false,
  "error": {
    "code": 502,
    "type": "BAD_GATEWAY",
    "message": "A upstream service returned an invalid response. Please try again later."
  }
}
```

---

### 503 — Service Unavailable

**When to use:** The service is temporarily down, overloaded, or undergoing maintenance.

```json
{
  "success": false,
  "error": {
    "code": 503,
    "type": "SERVICE_UNAVAILABLE",
    "message": "The service is temporarily unavailable. Please try again later.",
    "retryAfter": 30
  }
}
```

**HTTP Headers returned:**
```
Content-Type: application/json
Retry-After: 30
```

---

### 504 — Gateway Timeout

**When to use:** An upstream service (e.g. Soroban RPC) did not respond within the expected time.

```json
{
  "success": false,
  "error": {
    "code": 504,
    "type": "GATEWAY_TIMEOUT",
    "message": "The request timed out. Please try again."
  }
}
```

---

## How to Use in API Routes

### Basic Usage

Wrap every API route handler with `withApiHandler`:

```ts
// src/app/api/commitments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/utils/withApiHandler";

export const GET = withApiHandler(async (req: NextRequest) => {
  // your normal handler logic here
  const data = await fetchCommitments();
  return NextResponse.json({ success: true, data });
});
```

---

### Triggering a 429 Response

Throw a `RateLimitError` anywhere inside your handler:

```ts
import { withApiHandler, RateLimitError } from "@/utils/withApiHandler";

export const POST = withApiHandler(async (req: NextRequest) => {
  const isRateLimited = await checkRateLimit(req);

  if (isRateLimited) {
    throw new RateLimitError(120); // retry after 2 minutes
  }

  // continue with normal logic...
});
```

---

### Triggering a 5xx Response

Throw a `ServerError` with the appropriate status code:

```ts
import { withApiHandler, ServerError } from "@/utils/withApiHandler";

export const GET = withApiHandler(async (req: NextRequest) => {
  try {
    const result = await callSorobanRpc();
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    // RPC node unreachable — respond with 502
    throw new ServerError(502, "Soroban RPC node did not respond");
  }
});
```

---

### Using Error Helpers Directly (Outside of withApiHandler)

If you need to build an error response manually without the wrapper:

```ts
import { rateLimitError, resolveServerError, getErrorHeaders } from "@/utils/errorHelpers";
import { NextResponse } from "next/server";

// Manual 429
const body = rateLimitError(60);
const headers = getErrorHeaders(body);
return NextResponse.json(body, { status: 429, headers });

// Manual 5xx
const body = resolveServerError(503);
const headers = getErrorHeaders(body);
return NextResponse.json(body, { status: 503, headers });
```

---

## Retry-After Header

The `Retry-After` HTTP header is automatically added by `withApiHandler` and `getErrorHeaders()` for:

| Status Code | Default Retry-After |
|-------------|---------------------|
| 429 | 60 seconds |
| 503 | 30 seconds |

Clients and frontend code should read this header and wait the indicated number of seconds before retrying. Do not retry immediately on 429 or 503.

---

## Production vs Development

The `details` field in the error response is **only included in development mode** (`NODE_ENV === "development"`). In production, this field is always omitted to avoid leaking internal system information to clients.

| Environment | `details` field |
|-------------|-----------------|
| `development` | ✅ Included |
| `production` | ❌ Omitted |

---

## Files

| File | Purpose |
|------|---------|
| `src/utils/errorHelpers.ts` | Error factory functions and HTTP header helpers |
| `src/utils/withApiHandler.ts` | HOF wrapper for API routes — catches and translates all errors |
| `docs/error-handling.md` | This document |

---

## Checklist for Reviewers

When reviewing any PR that adds or modifies API routes, verify:

- [ ] The route handler is wrapped with `withApiHandler`
- [ ] Rate limiting throws `RateLimitError` — not a raw `NextResponse`
- [ ] Upstream failures throw `ServerError` with the correct status code
- [ ] No raw `500` responses are returned without going through the helpers
- [ ] `details` is never hardcoded in production responses
- [ ] `Retry-After` header is present on all 429 and 503 responses

---

*This document was created as part of issue #133. Update it as new error types are introduced.*