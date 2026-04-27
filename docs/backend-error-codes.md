# Backend Error Code Registry and Guidelines

> Last Updated: April 2026
>
> This document describes the centralized backend error code registry, error response format, and guidelines for clients and developers.

## Table of Contents

- [Overview](#overview)
- [Error Response Format](#error-response-format)
- [Error Code Registry](#error-code-registry)
  - [4xx Client Errors](#4xx-client-errors)
  - [5xx Server Errors](#5xx-server-errors)
  - [Domain-Specific Codes](#domain-specific-codes)
- [Client Handling Strategies](#client-handling-strategies)
- [Developer Guidelines](#developer-guidelines)
- [Testing Error Codes](#testing-error-codes)

## Overview

The Commitlabs backend uses a **centralized error code registry** to ensure:

✅ **Consistency** — All errors use registered codes (no ad-hoc codes)  
✅ **Documentation** — Each code is documented with meaning and client guidance  
✅ **Retrievability** — Errors include HTTP status, code, message, and optional details  
✅ **Safety** — Registry is validated in tests to prevent regressions

### Key Files

- **Source of Truth**: [`src/lib/backend/errorCodes.ts`](../src/lib/backend/errorCodes.ts)
  - `ERROR_CODE_REGISTRY` — Complete registry with all error code definitions
  - `getErrorCodeDefinition()` — Retrieve definition by code
  - `validateErrorCodeRegistry()` — Validate registry integrity
- **Error Classes**: [`src/lib/backend/errors.ts`](../src/lib/backend/errors.ts)
  - `ApiError` — Base class for all errors
  - Typed subclasses: `BadRequestError`, `UnauthorizedError`, `ForbiddenError`, etc.

## Error Response Format

All API errors follow a **standardized JSON format**:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email must be a valid email address.",
    "details": {
      "field": "email",
      "constraint": "email_format"
    }
  }
}
```

### Response Fields

| Field           | Type    | Description                                                               |
| --------------- | ------- | ------------------------------------------------------------------------- |
| `success`       | boolean | Always `false` for errors.                                                |
| `error.code`    | string  | Registered error code (from registry).                                    |
| `error.message` | string  | Human-readable error message for display.                                 |
| `error.details` | object  | Optional context-specific details (e.g., validation errors, resource ID). |

### HTTP Status Codes

All errors include an appropriate HTTP status code:

- **4xx** — Client error (request is incorrect or not authorized)
- **5xx** — Server error (server failed to process valid request)

## Error Code Registry

This is the complete registry of all error codes. Each code maps to:

- **Meaning** — What the error represents
- **Status Code** — HTTP status code
- **Client Handling** — Recommended client strategy
- **Retriable** — Whether the request can be safely retried
- **Description** — When the error is triggered

### 4xx Client Errors

#### `BAD_REQUEST` (400)

**Meaning**: The request was malformed or contains invalid syntax.

**Triggered By**:

- Malformed JSON body
- Invalid content-type header
- Missing required HTTP headers
- Protocol violations

**Client Handling**:

```javascript
// Check request headers, content-type, and method
// Do not retry — the error will persist until request is fixed
console.error("Check your request format and headers");
```

**Retriable**: ❌ No

---

#### `VALIDATION_ERROR` (400)

**Meaning**: Request body or query parameters failed validation.

**Triggered By**:

- Missing required fields
- Invalid field type (e.g., string instead of number)
- Field value out of range
- Format violations (email, date, etc.)

**Example**:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data.",
    "details": {
      "errors": [
        { "field": "commitment_amount", "message": "Must be greater than 0" },
        { "field": "end_date", "message": "Must be after start date" }
      ]
    }
  }
}
```

**Client Handling**:

```javascript
// Display validation errors in form
response.error.details.errors.forEach((err) => {
  displayFieldError(err.field, err.message);
});
```

**Retriable**: ❌ No

---

#### `UNAUTHORIZED` (401)

**Meaning**: Authentication credentials are missing, invalid, or expired.

**Triggered By**:

- Missing `Authorization` header
- Invalid JWT token (malformed, wrong signature)
- Expired token
- Revoked session

**Example**:

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required.",
    "details": { "reason": "token_expired" }
  }
}
```

**Client Handling**:

```javascript
// 1. Attempt token refresh if refresh_token is available
const newToken = await refreshAuthToken();
if (newToken) {
  // Retry request with new token
  return retryRequest();
}

// 2. If no refresh token, redirect to login
redirectToLogin();
```

**Retriable**: ✅ Yes (after token refresh)

---

#### `FORBIDDEN` (403)

**Meaning**: Authenticated but lacks permission to perform the action.

**Triggered By**:

- User lacks required role (e.g., admin-only endpoint)
- User is not the resource owner
- Required scope not granted

**Example**:

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to perform this action.",
    "details": { "required_role": "admin" }
  }
}
```

**Client Handling**:

```javascript
// Display permission denied message
toast.error("You lack permission for this action.");

// Log for audit purposes
auditLog.warn("Unauthorized access attempt", {
  action: "settle_commitment",
  user_id: getCurrentUserId(),
});

// Do not retry
```

**Retriable**: ❌ No

---

#### `NOT_FOUND` (404)

**Meaning**: The requested resource does not exist.

**Triggered By**:

- Resource ID doesn't match any record
- Soft-deleted resource
- Resource moved or removed

**Example**:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Commitment not found.",
    "details": { "commitment_id": "cm_12345" }
  }
}
```

**Client Handling**:

```javascript
// Display not found message
displayNotFoundPage();

// Offer navigation alternatives
suggestSearchOrBackButton();

// Do not retry
```

**Retriable**: ❌ No

---

#### `CONFLICT` (409)

**Meaning**: Request conflicts with the current resource state.

**Triggered By**:

- Resource already exists (duplicate)
- Commitment already settled
- Resource locked by another user
- Incompatible state transition

**Example**:

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "Commitment already settled.",
    "details": { "settled_at": "2026-04-20T10:30:00Z" }
  }
}
```

**Client Handling**:

```javascript
// 1. Display conflict message with details
showConflictDialog(response.error.details);

// 2. Fetch latest resource state
const latest = await fetchCommitment(id);

// 3. Prompt user to retry or take alternative action
promptUserToRefreshAndRetry();
```

**Retriable**: ✅ Yes (after fetching fresh state)

---

#### `UNPROCESSABLE_ENTITY` (422)

**Meaning**: Request is syntactically valid but semantically unprocessable.

**Triggered By**:

- Constraint violations (e.g., insufficient balance)
- Business rule violations (e.g., allocation exceeds limit)
- Invalid amount ranges

**Example**:

```json
{
  "success": false,
  "error": {
    "code": "UNPROCESSABLE_ENTITY",
    "message": "Allocation exceeds maximum allowed percentage.",
    "details": { "max_percentage": 100, "attempted": 150 }
  }
}
```

**Client Handling**:

```javascript
// Show detailed error explaining constraint
showConstraintError(response.error.details);

// Offer user guidance on how to fix
suggestAlternatives(response.error.details);

// Do not retry with same data
```

**Retriable**: ❌ No

---

### 5xx Server Errors

#### `INTERNAL_ERROR` (500)

**Meaning**: Unexpected server-side failure.

**Triggered By**:

- Unhandled exception
- Database error
- Logic error in request handler
- Memory exhaustion

**Example**:

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred. Please try again later.",
    "details": { "request_id": "req_abc123" }
  }
}
```

**Client Handling**:

```javascript
// Display generic message
showErrorToast("Something went wrong. Please try again.");

// Implement exponential backoff
await backoffAndRetry({
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
});

// Log request ID for support
console.error("Request ID:", response.error.details.request_id);
```

**Retriable**: ✅ Yes (with exponential backoff)

---

#### `BAD_GATEWAY` (502)

**Meaning**: Invalid response from upstream server or service.

**Triggered By**:

- Blockchain RPC error
- Database connection error
- Upstream service returns invalid response

**Client Handling**:

```javascript
// Display service unavailable message
showErrorToast("Service temporarily unavailable. Retrying...");

// Implement exponential backoff
await backoffAndRetry();
```

**Retriable**: ✅ Yes (with exponential backoff)

---

#### `SERVICE_UNAVAILABLE` (503)

**Meaning**: Service is temporarily unavailable (maintenance, overload, or degradation).

**Client Handling**:

```javascript
// Respect Retry-After header
const retryAfter = getRetryAfterHeader();
await delay(retryAfter);
return retryRequest();
```

**Retriable**: ✅ Yes (respect Retry-After header)

---

#### `GATEWAY_TIMEOUT` (504)

**Meaning**: Upstream service did not respond within the timeout window.

**Triggered By**:

- Blockchain node slow response
- External API timeout
- Long-running database query

**Client Handling**:

```javascript
// Implement exponential backoff with longer timeout
await backoffAndRetry({
  timeout: 30000, // Increase from default
  maxAttempts: 2,
});
```

**Retriable**: ✅ Yes

---

### Domain-Specific Codes

#### `BLOCKCHAIN_UNAVAILABLE` (503)

**Meaning**: Blockchain service is temporarily unavailable.

**Triggered By**:

- RPC provider unreachable
- Network connectivity issues
- Blockchain node undergoing maintenance

**Client Handling**:

```javascript
// Similar to SERVICE_UNAVAILABLE
// Retry with exponential backoff
```

**Retriable**: ✅ Yes

---

#### `BLOCKCHAIN_CALL_FAILED` (500)

**Meaning**: Blockchain operation failed (transaction reverted, execution error, etc.).

**Triggered By**:

- Smart contract revert
- Invalid transaction parameters
- Insufficient gas or balance
- Logic error in blockchain operation

**Example**:

```json
{
  "success": false,
  "error": {
    "code": "BLOCKCHAIN_CALL_FAILED",
    "message": "Transaction reverted with reason: Insufficient balance.",
    "details": {
      "reason": "Insufficient balance",
      "tx_hash": "0x..."
    }
  }
}
```

**Client Handling**:

```javascript
// Display detailed blockchain error
showBlockchainError(response.error.details);

// Usually not retriable — user must fix underlying issue
```

**Retriable**: ❌ No

---

## Client Handling Strategies

### Exponential Backoff

Implement exponential backoff for retriable 5xx errors:

```javascript
async function retryWithBackoff(fn, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts || !isRetriable(error)) {
        throw error;
      }
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      const jitter = Math.random() * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay + jitter));
    }
  }
}
```

### Error Codes by Retriability

**Retriable Errors** (4xx):

- `UNAUTHORIZED` (after token refresh)
- `CONFLICT` (after fetching fresh state)

**Retriable Errors** (5xx):

- `INTERNAL_ERROR`
- `BAD_GATEWAY`
- `SERVICE_UNAVAILABLE`
- `GATEWAY_TIMEOUT`
- `BLOCKCHAIN_UNAVAILABLE`

**Non-Retriable Errors**:

- `BAD_REQUEST`
- `VALIDATION_ERROR`
- `FORBIDDEN`
- `NOT_FOUND`
- `UNPROCESSABLE_ENTITY`
- `BLOCKCHAIN_CALL_FAILED`

## Developer Guidelines

### Using Error Classes

Always use typed error classes from `src/lib/backend/errors.ts`:

```typescript
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
} from "@/lib/backend/errors";

// ✅ Good: Throw typed error with context
throw new ValidationError("Email must be unique.", {
  field: "email",
  value: userEmail,
});

throw new NotFoundError("Commitment", { commitmentId });

throw new ConflictError("Commitment already settled.", {
  settled_at: new Date().toISOString(),
});

// ❌ Bad: Ad-hoc error codes or messages
throw new Error("Something is wrong"); // No error code!
```

### Enforcing Registry Usage

All error codes **must** be registered in `ERROR_CODE_REGISTRY`. The registry is validated in tests:

```typescript
// In test suite
import { validateErrorCodeRegistry } from "@/lib/backend/errorCodes";

describe("Error Code Registry", () => {
  it("should contain no duplicates", () => {
    const validation = validateErrorCodeRegistry();
    expect(validation.valid).toBe(true);
    expect(validation.duplicates).toHaveLength(0);
    expect(validation.errors).toHaveLength(0);
  });
});
```

### Adding New Error Codes

To add a new error code:

1. **Add to registry** in `src/lib/backend/errorCodes.ts`:

   ```typescript
   export const ERROR_CODE_REGISTRY: Record<string, ErrorCodeDefinition> = {
     // ... existing codes
     MY_NEW_ERROR: {
       code: "MY_NEW_ERROR",
       statusCode: 400,
       meaning: "Clear description...",
       clientHandling: "How clients should handle this...",
       retriable: false,
       description: "When this error is triggered...",
     },
   };
   ```

2. **Create typed error class** if needed in `src/lib/backend/errors.ts`:

   ```typescript
   export class MyNewError extends ApiError {
     constructor(message = "Default message.", details?: unknown) {
       super(message, "MY_NEW_ERROR", 400, details);
       this.name = "MyNewError";
     }
   }
   ```

3. **Update documentation** in this file with explanation and examples.

4. **Add tests** to ensure the code is registered and validated.

## Testing Error Codes

### Unit Test: Validate Registry

```typescript
// tests/lib/backend/errorCodes.test.ts
import {
  ERROR_CODE_REGISTRY,
  validateErrorCodeRegistry,
  getErrorCodesByStatus,
} from "@/lib/backend/errorCodes";

describe("ERROR_CODE_REGISTRY", () => {
  it("should contain all required error codes", () => {
    const requiredCodes = [
      "BAD_REQUEST",
      "VALIDATION_ERROR",
      "UNAUTHORIZED",
      "FORBIDDEN",
      "NOT_FOUND",
      "CONFLICT",
      "UNPROCESSABLE_ENTITY",
      "TOO_MANY_REQUESTS",
      "INTERNAL_ERROR",
      "BAD_GATEWAY",
      "SERVICE_UNAVAILABLE",
      "GATEWAY_TIMEOUT",
    ];

    requiredCodes.forEach((code) => {
      expect(ERROR_CODE_REGISTRY[code]).toBeDefined();
    });
  });

  it("should have no duplicate error codes", () => {
    const validation = validateErrorCodeRegistry();
    expect(validation.valid).toBe(true);
    expect(validation.duplicates).toHaveLength(0);
  });

  it("should have all required fields in each definition", () => {
    const validation = validateErrorCodeRegistry();
    expect(validation.errors).toHaveLength(0);
  });

  it("should group codes by status correctly", () => {
    const grouped = getErrorCodesByStatus();
    expect(grouped[400]).toBeDefined(); // Client errors
    expect(grouped[500]).toBeDefined(); // Server errors
  });

  it("should retrieve definition by code", () => {
    const { getErrorCodeDefinition } = require("@/lib/backend/errorCodes");
    const def = getErrorCodeDefinition("VALIDATION_ERROR");
    expect(def.code).toBe("VALIDATION_ERROR");
    expect(def.statusCode).toBe(400);
    expect(def.retriable).toBe(false);
  });
});
```

### Integration Test: Error Responses

```typescript
// tests/api/sample.test.ts
describe("API Error Responses", () => {
  it("should return VALIDATION_ERROR for invalid input", async () => {
    const response = await fetch("/api/commitments", {
      method: "POST",
      body: JSON.stringify({ amount: "invalid" }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error.code).toBe("VALIDATION_ERROR");
    expect(data.success).toBe(false);
  });
});
```

## References

- **Error Code Registry**: [`src/lib/backend/errorCodes.ts`](../src/lib/backend/errorCodes.ts)
- **Error Classes**: [`src/lib/backend/errors.ts`](../src/lib/backend/errors.ts)
- **API Response Format**: [`src/lib/backend/apiResponse.ts`](../src/lib/backend/apiResponse.ts)
- **Error Wrapper**: [`src/lib/backend/withApiHandler.ts`](../src/lib/backend/withApiHandler.ts)
