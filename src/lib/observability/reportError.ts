/**
 * Client-side structured error reporter.
 *
 * Produces a redaction-safe record from a caught Error and emits it through a
 * pluggable transport (console by default). Wire a custom sink via
 * `setErrorTransport` before your app mounts — no runtime dependency required.
 *
 * @see docs/error-handling.md — "Client Error Reporting"
 */

/** Sensitive field names that must never appear in a reported record. */
const SENSITIVE_FIELDS = new Set([
  'token', 'authorization', 'password', 'secret', 'key', 'privatekey',
  'publickey', 'mnemonic', 'seed', 'auth', 'bearer', 'apikey', 'api_key',
  'session', 'cookie', 'csrf', 'signature', 'nonce',
])

/** A structured, serialisable client error record. */
export interface ClientErrorRecord {
  message: string
  digest: string | undefined
  route: string
  timestamp: string
  /** Stack trace — omitted in production. */
  stack?: string
}

/** Transport function type. Receives a finalised record for delivery. */
export type ErrorTransport = (record: ClientErrorRecord) => void

let transport: ErrorTransport = (record) => {
  // eslint-disable-next-line no-console
  console.error('[reportError]', record)
}

/**
 * Override the default console transport with a custom sink (e.g. Sentry,
 * Datadog, a backend ingest endpoint).
 */
export function setErrorTransport(fn: ErrorTransport): void {
  transport = fn
}

/** Redact a message string by replacing values after sensitive key patterns. */
function redactMessage(message: string): string {
  // Replace patterns like "token=<value>" or "password: <value>"
  return message.replace(
    /\b([a-z_]+)\s*[=:]\s*\S+/gi,
    (match, key: string) =>
      SENSITIVE_FIELDS.has(key.toLowerCase()) ? `${key}=[REDACTED]` : match,
  )
}

/**
 * Build and emit a structured client error record.
 *
 * @param error  - The caught Error (from Next.js error boundary props).
 * @param route  - The pathname where the error occurred (`window.location.pathname`).
 */
export function reportError(
  error: Error & { digest?: string },
  route: string,
): void {
  const record: ClientErrorRecord = {
    message: redactMessage(error.message || 'Unknown error'),
    digest: error.digest,
    route,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV !== 'production' && error.stack
      ? { stack: error.stack }
      : {}),
  }

  transport(record)
}
