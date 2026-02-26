# Standard JSON Response & Error Format

**Reference:** [#105 - Standard JSON Response & Error Format](https://github.com/Commitlabs-Org/Commitlabs-Frontend/issues/105)

All API routes in this project return a consistent JSON envelope so that the frontend and any consumers can handle responses uniformly.

---

## Success shape

```json
{
  "ok": true,
  "data": { ... },
  "meta": { "total": 42, "page": 1 }
}
```

| Field  | Type                      | Always present | Description                              |
|--------|---------------------------|----------------|------------------------------------------|
| `ok`   | `true`                    | ✅              | Discriminant — always `true` on success  |
| `data` | `T`                       | ✅              | The response payload                     |
| `meta` | `Record<string, unknown>` | ❌              | Optional pagination / extra context      |

---

## Error shape

```json
{
  "ok": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Commitment not found.",
    "details": { ... }
  }
}
```

| Field           | Type      | Always present | Description                                      |
|-----------------|-----------|----------------|--------------------------------------------------|
| `ok`            | `false`   | ✅              | Discriminant — always `false` on error           |
| `error.code`    | `string`  | ✅              | Short machine-readable code (see table below)    |
| `error.message` | `string`  | ✅              | Human-readable message safe for UI display       |
| `error.details` | `unknown` | ❌              | Extra context (never expose sensitive data here) |

---

## Error codes

| Code                   | HTTP status | Error class           |
|------------------------|-------------|-----------------------|
| `BAD_REQUEST`          | 400         | `BadRequestError`     |
| `VALIDATION_ERROR`     | 400         | `ValidationError`     |
| `UNAUTHORIZED`         | 401         | `UnauthorizedError`   |
| `FORBIDDEN`            | 403         | `ForbiddenError`      |
| `NOT_FOUND`            | 404         | `NotFoundError`       |
| `CONFLICT`             | 409         | `ConflictError`       |
| `TOO_MANY_REQUESTS`    | 429         | `TooManyRequestsError`|
| `INTERNAL_ERROR`       | 500         | `InternalError`       |

---

## How to use

### Returning a success response

```ts
import { ok } from '@/lib/backend/apiResponse';

// Simple success
return ok({ status: 'healthy' });
// → { ok: true, data: { status: 'healthy' } }

// With meta (e.g. pagination)
return ok(items, { total: 100, page: 2, pageSize: 20 });
// → { ok: true, data: [...], meta: { total: 100, page: 2, pageSize: 20 } }
```

### Returning an error response

```ts
import { fail } from '@/lib/backend/apiResponse';

return fail('NOT_FOUND', 'Commitment not found.', undefined, 404);
// → { ok: false, error: { code: 'NOT_FOUND', message: 'Commitment not found.' } }
```

### Using typed error classes (recommended)

Throw a typed error inside any route wrapped with `withApiHandler` — it will be caught and converted into the correct error response automatically.

```ts
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok } from '@/lib/backend/apiResponse';
import { NotFoundError, ValidationError } from '@/lib/backend/errors';

export const GET = withApiHandler(async (req) => {
    const commitment = await findCommitment(id);
    if (!commitment) {
        throw new NotFoundError('Commitment');
        // → 404: { ok: false, error: { code: 'NOT_FOUND', message: 'Commitment not found.' } }
    }
    return ok(commitment);
});
```

Available error classes (all from `@/lib/backend/errors`):

| Class                 | Default status |
|-----------------------|----------------|
| `BadRequestError`     | 400            |
| `ValidationError`     | 400            |
| `UnauthorizedError`   | 401            |
| `ForbiddenError`      | 403            |
| `NotFoundError`       | 404            |
| `ConflictError`       | 409            |
| `TooManyRequestsError`| 429            |
| `InternalError`       | 500            |

### Full route example (health check)

```ts
// src/app/api/health/route.ts
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok } from '@/lib/backend/apiResponse';

export const GET = withApiHandler(async () => {
    return ok({ status: 'healthy' });
    // GET /api/health → 200 { ok: true, data: { status: 'healthy' } }
});
```

---

## Files

| File | Purpose |
|------|---------|
| `src/lib/backend/apiResponse.ts` | `ok()` and `fail()` response helpers |
| `src/lib/backend/errors.ts`      | Typed error classes with HTTP status codes |
| `src/lib/backend/withApiHandler.ts` | HOF that catches `ApiError` and calls `fail()` |
| `docs/api-response-format.md`    | This document |

---

*Created as part of issue #105. Update this document when new error codes are introduced.*
