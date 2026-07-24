# Client Error Monitoring Seam

CommitLabs reports client-side errors through a small, **pluggable seam** rather
than a hard dependency on any vendor. By default it emits to the console; an
operator wires a real sink (Sentry, Datadog, a backend ingest endpoint, …) once,
at startup, without changing any component code.

Implementation: [`src/lib/observability/reportError.ts`](../../src/lib/observability/reportError.ts)
(unit tests in [`src/lib/observability/__tests__/reportError.test.ts`](../../src/lib/observability/__tests__/reportError.test.ts)).

## What gets reported

Errors are turned into a redaction-safe, serialisable record:

```ts
interface ClientErrorRecord {
  message: string            // redacted (see Redaction below)
  digest: string | undefined // Next.js error digest, when present
  route: string              // pathname where the error occurred
  timestamp: string          // ISO-8601 UTC
  stack?: string             // present only when NODE_ENV !== 'production'
}
```

## Call sites

Both client error surfaces already forward into the seam:

| Source | What it catches | Route passed |
| ------ | --------------- | ------------ |
| [`src/app/error.tsx`](../../src/app/error.tsx) | Errors from the App Router route segment (the Next.js `error.tsx` boundary) | `window.location.pathname` |
| [`src/components/ErrorBoundary.tsx`](../../src/components/ErrorBoundary.tsx) | Render/lifecycle errors in any subtree wrapped by `ErrorBoundary` / `withErrorBoundary` | `window.location.pathname` (or `''` if unavailable) |

Application code should not call `reportError` ad hoc; let these boundaries do
it. Wrap risky subtrees in `ErrorBoundary` instead of adding bespoke try/catch
reporting.

## The adapter contract

A monitoring adapter is just a transport function:

```ts
type ErrorTransport = (record: ClientErrorRecord) => void
```

Register it **once**, before the app renders, with `setErrorTransport`. An
adapter must:

- be **synchronous and non-throwing** — never let reporting break the app; wrap
  any network/SDK call in your own try/catch and swallow failures;
- treat `ClientErrorRecord` as already-redacted and **not** re-derive sensitive
  data from it;
- be cheap — it runs on the error path, which may already be degraded.

### Default behaviour (no adapter)

If `setErrorTransport` is never called, the default transport logs the record via
`console.error('[reportError]', record)`. There is no network traffic and no
PII egress by default — reporting is opt-in.

### Example: wiring an adapter

```ts
// e.g. in a top-level client provider, run once on mount
import { setErrorTransport } from '@/lib/observability/reportError'

setErrorTransport((record) => {
  try {
    // Sentry.captureMessage(record.message, { extra: record })
    // or: navigator.sendBeacon('/api/client-errors', JSON.stringify(record))
  } catch {
    // never rethrow from the transport
  }
})
```

## Redaction

`reportError` redacts the error `message` before building the record: substrings
of the form `key=value` / `key: value` whose key is in the sensitive set
(`token`, `authorization`, `password`, `secret`, `key`, `privatekey`,
`publickey`, `mnemonic`, `seed`, `auth`, `bearer`, `apikey`, `api_key`,
`session`, `cookie`, `csrf`, `signature`, `nonce`) are replaced with
`key=[REDACTED]`.

Stack traces are included only outside production. This matches the backend
logging posture documented in
[`LOGGING_SCHEMA.md`](LOGGING_SCHEMA.md); as there, redaction is **key-based**,
so avoid putting raw secrets into error messages.

## Testing

- The seam itself: `reportError.test.ts` covers the record shape, redaction, the
  production stack-omission, and that a registered transport receives the record
  (and the default is safe when none is set).
- The boundary wiring: `ErrorBoundary.test.tsx` asserts a thrown child error is
  forwarded to a registered transport, and that nothing is reported on the happy
  path.
