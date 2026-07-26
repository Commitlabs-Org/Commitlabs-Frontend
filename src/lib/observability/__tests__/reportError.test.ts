import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  reportError,
  setErrorTransport,
  type ClientErrorRecord,
} from '../reportError'

// ─── helpers ────────────────────────────────────────────────────────────────

function makeError(message: string, digest?: string): Error & { digest?: string } {
  const e = new Error(message)
  if (digest !== undefined) (e as Error & { digest?: string }).digest = digest
  return e as Error & { digest?: string }
}

// ─── transport capture ───────────────────────────────────────────────────────

describe('reportError — transport', () => {
  let captured: ClientErrorRecord[] = []

  beforeEach(() => {
    captured = []
    setErrorTransport((r) => captured.push(r))
  })

  afterEach(() => {
    // restore default (console) transport
    setErrorTransport((r) => console.error('[reportError]', r))
  })

  it('calls the registered transport once per invocation', () => {
    reportError(makeError('boom'), '/dashboard')
    expect(captured).toHaveLength(1)
  })

  it('record contains the expected fields', () => {
    reportError(makeError('oops', 'abc123'), '/home')
    const r = captured[0]
    expect(r.message).toBe('oops')
    expect(r.digest).toBe('abc123')
    expect(r.route).toBe('/home')
    expect(r.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('digest is undefined when not set on the error', () => {
    reportError(makeError('plain error'), '/page')
    expect(captured[0].digest).toBeUndefined()
  })

  it('timestamp is a valid ISO string close to now', () => {
    const before = Date.now()
    reportError(makeError('ts check'), '/ts')
    const after = Date.now()
    const ts = new Date(captured[0].timestamp).getTime()
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after)
  })

  it('falls back to "Unknown error" when message is empty', () => {
    const e = makeError('')
    reportError(e, '/')
    expect(captured[0].message).toBe('Unknown error')
  })

  it('setErrorTransport replaces the previous transport', () => {
    const first: ClientErrorRecord[] = []
    const second: ClientErrorRecord[] = []
    setErrorTransport((r) => first.push(r))
    setErrorTransport((r) => second.push(r))
    reportError(makeError('x'), '/')
    expect(first).toHaveLength(0)
    expect(second).toHaveLength(1)
  })
})

// ─── redaction ───────────────────────────────────────────────────────────────

describe('reportError — message redaction', () => {
  let captured: ClientErrorRecord[] = []

  beforeEach(() => {
    captured = []
    setErrorTransport((r) => captured.push(r))
  })

  afterEach(() => {
    setErrorTransport((r) => console.error('[reportError]', r))
  })

  const SENSITIVE_PAIRS: [string, string][] = [
    ['token=abc123', 'token=[REDACTED]'],
    ['authorization=Bearer xyz', 'authorization=[REDACTED]'],
    ['password: hunter2', 'password=[REDACTED]'],
    ['secret=mysecret', 'secret=[REDACTED]'],
    ['nonce=0xdeadbeef', 'nonce=[REDACTED]'],
    ['signature=0xabc', 'signature=[REDACTED]'],
    ['apikey=key123', 'apikey=[REDACTED]'],
    ['session=sess_abc', 'session=[REDACTED]'],
    ['cookie=cval', 'cookie=[REDACTED]'],
    ['csrf=tok', 'csrf=[REDACTED]'],
  ]

  it.each(SENSITIVE_PAIRS)(
    'redacts "%s" in message',
    (input, expected) => {
      reportError(makeError(input), '/')
      expect(captured[0].message).toContain(expected)
    },
  )

  it('leaves non-sensitive fields untouched', () => {
    reportError(makeError('route=/api/health status=200'), '/')
    expect(captured[0].message).toBe('route=/api/health status=200')
  })

  it('is case-insensitive for key matching', () => {
    reportError(makeError('TOKEN=abc'), '/')
    expect(captured[0].message).toContain('[REDACTED]')
    expect(captured[0].message).not.toContain('abc')
  })

  it('does not redact values in the route field', () => {
    reportError(makeError('ok'), '/api?token=should-stay')
    // route is passed through verbatim — only message is redacted
    expect(captured[0].route).toBe('/api?token=should-stay')
  })
})

// ─── stack trace behaviour ───────────────────────────────────────────────────

describe('reportError — stack trace', () => {
  let captured: ClientErrorRecord[] = []

  beforeEach(() => {
    captured = []
    setErrorTransport((r) => captured.push(r))
  })

  afterEach(() => {
    setErrorTransport((r) => console.error('[reportError]', r))
  })

  it('omits stack in production', () => {
    const original = process.env.NODE_ENV
    // @ts-expect-error override read-only for test
    process.env.NODE_ENV = 'production'
    reportError(makeError('prod error'), '/')
    expect(captured[0].stack).toBeUndefined()
    // @ts-expect-error restore
    process.env.NODE_ENV = original
  })

  it('includes stack outside production when present', () => {
    // NODE_ENV is 'test' in vitest — not 'production'
    const e = makeError('dev error')
    reportError(e, '/')
    if (e.stack) {
      expect(captured[0].stack).toBeTruthy()
    }
  })
})
