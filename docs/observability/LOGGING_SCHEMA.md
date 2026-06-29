# Backend Structured Logging Schema

The API layer emits **structured JSON logs** — one JSON object per line — so that
logs can be parsed, queried, and forwarded to an analytics/observability backend
without regex scraping. This document is the contract for that JSON shape.

It describes what is implemented today in
[`src/lib/backend/logger.ts`](../../src/lib/backend/logger.ts) and
[`src/lib/backend/redact.ts`](../../src/lib/backend/redact.ts); keep this doc and
that code in sync.

> The current `emit`/`console` sink is a placeholder. In production the same JSON
> records are intended to be forwarded to an external service (Datadog, Segment,
> Mixpanel, etc.). Because consumers depend on the field names below, treat them
> as a stable contract: add fields rather than rename or repurpose existing ones.

## Record types

There are two record shapes. Both are single-line JSON written via `console.*`.

### 1. Operational log entry

Emitted by `logInfo` / `logWarn` / `logError` / `logDebug` (and the
`logger.{info,warn,error,debug}` convenience wrappers).

| Field | Type | Required | Notes |
| ----- | ---- | :------: | ----- |
| `level` | `"info" \| "warn" \| "error" \| "debug"` | yes | See [Levels](#levels). |
| `message` | `string` | yes | Human-readable summary. API-handler logs are prefixed, e.g. `"[API] Unhandled exception"`. |
| `timestamp` | `string` | yes | ISO‑8601 UTC (`new Date().toISOString()`). |
| `requestId` | `string` | no | Correlation id; see [Request correlation](#request-correlation). Omitted when no request/id is supplied. |
| `context` | `object` | no | Arbitrary structured key/values. Passed through [redaction](#redaction). |
| `error` | `object` | no | Present on error logs: `{ name, message, stack? }`. Passed through redaction. |

**Example**

```json
{"level":"error","message":"[API] Unhandled exception","timestamp":"2026-06-28T20:00:00.000Z","requestId":"7b1c…","context":{"route":"/api/commitments","method":"POST"},"error":{"name":"TypeError","message":"cannot read properties of undefined","stack":"TypeError: …"}}
```

### 2. Analytics event

Emitted by the domain-event helpers (`logCommitmentCreated`,
`logCommitmentSettled`, `logEarlyExit`, `logAttestation`, `logListingCancelled`,
`logListingCancellationFailed`, `logDisputeOpened`, `logDisputeResolved`) via the
internal `emit()`.

| Field | Type | Required | Notes |
| ----- | ---- | :------: | ----- |
| `event` | `string` | yes | Event name, e.g. `"CommitmentCreated"`, `"AttestationReceived"`. |
| `timestamp` | `string` | yes | ISO‑8601 UTC. |
| `requestId` | `string` | no | Correlation id when available. |
| `context` | `object` | no | Structured context; redacted. |
| `payload` | `object` | no | Event-specific data; redacted. |
| `error` | `object` | no | `{ name, message, stack? }`; redacted. |

**Example**

```json
{"event":"CommitmentCreated","timestamp":"2026-06-28T20:00:00.000Z","payload":{"commitmentId":"00124","strategy":"Balanced"}}
```

### Defined event names

| Event | Helper |
| ----- | ------ |
| `CommitmentCreated` | `logCommitmentCreated` |
| `CommitmentSettled` | `logCommitmentSettled` |
| `CommitmentEarlyExit` | `logEarlyExit` |
| `AttestationReceived` | `logAttestation` |
| `ListingCancelled` | `logListingCancelled` |
| `ListingCancellationFailed` | `logListingCancellationFailed` |
| `DisputeOpened` | `logDisputeOpened` |
| `DisputeResolved` | `logDisputeResolved` |

## Levels

| Level | Sink | When |
| ----- | ---- | ---- |
| `debug` | `console.debug` | **Development only** — suppressed unless `NODE_ENV === "development"`. |
| `info` | `console.log` | Normal lifecycle events. |
| `warn` | `console.warn` | Handled/recoverable problems (e.g. `withApiHandler` "[API] Handled error"). |
| `error` | `console.error` | Unhandled exceptions and failures; carries the `error` object. |

## Request correlation

Every API response is tagged so a client report can be tied back to server logs:

- `getRequestId(req)` returns the incoming `x-request-id` header if present;
  otherwise it generates a UUID (`crypto.randomUUID()`) and caches it per request
  in a `WeakMap`, so repeated calls within one request share one id.
- `withApiHandler` sets both `x-correlation-id` and `x-request-id` response
  headers to the request's correlation id.
- The same id is written to the `requestId` field of log entries, so response
  headers and logs join on one value.

## Redaction

Before serialization, `context`, `payload`, and `error` are passed through
`redact()` ([`redact.ts`](../../src/lib/backend/redact.ts)), which recursively
replaces values whose **key** matches a denylist with `"[REDACTED]"`. Matching is
case-insensitive by default; arrays and nested objects are walked; `Date` objects
are preserved.

Default denylisted keys:

`signature`, `token`, `nonce`, `authorization`, `password`, `secret`, `key`,
`privatekey`, `publickey`, `mnemonic`, `seed`, `hash`, `digest`, `auth`,
`bearer`, `apikey`, `api_key`, `session`, `cookie`, `csrf`, `xss`, `sql`.

> Redaction is **key-based**, not value-based: a sensitive value placed under a
> non-denylisted key (or interpolated into a free-text `message`) is **not**
> redacted. Put sensitive data in `context`/`payload` under a denylisted key, and
> never inline secrets into `message`.

## Guidance for contributors

- Log through the helpers in `logger.ts` — do not hand-roll `console.log` in API
  routes, so every record stays on-schema and redacted.
- Always thread the request (or its id) into `logInfo/logWarn/logError` so
  `requestId` is populated.
- Put machine-readable detail in `context`/`payload`, keep `message`/`event`
  short and stable.
- When adding a new analytics event, add a row to
  [Defined event names](#defined-event-names) in this doc.
