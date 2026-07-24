# Commitment Write Routes Test Coverage

This document summarizes the test coverage for the commitment dispute, resolve, and fund API routes.

## Files under test

| Route | File |
|-------|------|
| `POST /api/commitments/[id]/dispute` | `src/app/api/commitments/[id]/dispute/route.ts` |
| `POST /api/commitments/[id]/resolve` | `src/app/api/commitments/[id]/resolve/route.ts` |
| `POST /api/commitments/[id]/fund` | `src/app/api/commitments/[id]/fund/route.ts` |

## Test files

| Route | Test file |
|-------|-----------|
| Dispute | `src/app/api/commitments/[id]/dispute/route.test.ts` |
| Resolve | `src/app/api/commitments/[id]/resolve/route.test.ts` |
| Fund | `src/app/api/commitments/[id]/fund/route.test.ts` |

## Covered behaviors

### All three routes

- **200 — success**: valid request returns the expected response envelope
- **400 — validation**:
  - Empty or whitespace-only commitment id
  - Missing request body
  - Invalid JSON in request body
  - Missing required fields
  - Invalid field values (wrong types, out of range)
- **429 — rate limited**: `checkRateLimit` returns `false`
- **405 — method not allowed**: GET, PUT, DELETE (and PATCH for fund)

### Dispute-specific (`dispute/route.test.ts`)

- **200 — success**: returns `commitmentId`, `disputeId`, `status`, `txHash`, `disputedAt`
- **400 — validation**: missing reason, empty reason, reason > 500 chars
- **404 — not found**: `openDisputeOnChain` throws `NotFoundError`
- **409 — conflict**: `openDisputeOnChain` throws `ConflictError` (already disputed, already settled)
- **Audit**: `recordAuditEvent` called with `DISPUTE_OPENED`
- **Logging**: `logDisputeOpened` called on both success and failure
- **Edge case**: `callerAddress` defaults to `''` when omitted

### Resolve-specific (`resolve/route.test.ts`)

- **200 — success**: each resolution value (`resolved_in_favor_of_owner`, `resolved_in_favor_of_counterparty`, `dismissed`)
- **200 — success with notes**: optional notes field passed through
- **400 — validation**: missing resolution, invalid resolution value, notes > 1000 chars
- **403 — forbidden**: `requireAdmin` throws `ForbiddenError` (invalid/missing admin token)
- **409 — conflict**: `resolveDisputeOnChain` throws `ConflictError`
- **Audit**: `recordAuditEvent` called with `DISPUTE_RESOLVED` and `actorAddress` set to admin address
- **Logging**: `logDisputeResolved` called on both success and failure

### Fund-specific (`fund/route.test.ts`)

- **200 — success**: returns `commitmentId`, `txHash`, `reference`, `fundedAt`
- **200 — idempotency (completed)**: returns cached response without calling chain
- **200 — idempotency (new)**: starts and completes idempotency tracking
- **400 — validation**: empty/whitespace id, invalid JSON
- **403 — forbidden**: `callerAddress` does not match commitment owner; CSRF validation failure
- **404 — not found**: commitment does not exist on chain
- **409 — conflict**: commitment status is not `CREATED`; idempotency key still processing
- **429 — rate limited**
- **204 — OPTIONS**: preflight request returns 204
- **405 — method not allowed**: GET, PUT, PATCH, DELETE
- **Idempotency**: `fail()` called when handler throws
- **Error fallback**: unexpected errors map to 500 `INTERNAL_ERROR`

## Mocking strategy

All external dependencies are mocked at the module level with `vi.mock`:

- `@/lib/backend/rateLimit` — `checkRateLimit`
- `@/lib/backend/services/contracts` — chain interaction functions
- `@/lib/backend/logger` — analytic event logging
- `@/lib/backend/auditLog` — `recordAuditEvent`
- `@/lib/backend/requireAuth` — `requireAdmin` (resolve only)
- `@/lib/backend/csrf` — `assertMutationCsrf` (fund only)
- `@/lib/backend/cors` — CORS enforcement (fund only)
- `@/lib/backend/idempotency` — `idempotencyService` (fund only)

## Response envelope assertions

Success responses are asserted to follow the `OkResponse<T>` shape:

```json
{ "success": true, "data": { ... }, "meta": { "correlationId": "...", "timestamp": "..." } }
```

Error responses are asserted to follow the `FailResponse` shape:

```json
{ "success": false, "error": { "code": "ERROR_CODE", "message": "...", "timestamp": "..." } }
```

## Running the tests

```bash
pnpm test -- --reporter=verbose src/app/api/commitments
```
