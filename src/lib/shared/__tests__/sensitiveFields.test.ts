import { describe, it, expect } from 'vitest'
import { SENSITIVE_FIELDS } from '@/lib/shared/sensitiveFields'

describe('SENSITIVE_FIELDS — shared denylist', () => {
  it('exports a non-empty Set', () => {
    expect(SENSITIVE_FIELDS).toBeInstanceOf(Set)
    expect(SENSITIVE_FIELDS.size).toBeGreaterThan(0)
  })

  it('contains all critical security fields', () => {
    const critical = [
      'signature', 'token', 'authorization', 'password', 'secret',
      'key', 'privatekey', 'publickey', 'mnemonic', 'seed',
    ]

    for (const field of critical) {
      expect(SENSITIVE_FIELDS.has(field)).toBe(true)
    }
  })

  it('is the same reference used by redact', async () => {
    const { isSensitiveField } = await import('@/lib/backend/redact')

    expect(isSensitiveField('digest')).toBe(true)
    expect(isSensitiveField('xss')).toBe(true)
    expect(isSensitiveField('sql')).toBe(true)
  })

  it('is the same reference used by reportError', async () => {
    const { reportError, setErrorTransport } = await import('@/lib/observability/reportError')

    let capturedMessage = ''
    setErrorTransport((r) => { capturedMessage = r.message })

    reportError(
      new Error('hash=abc123 secret=xyz') as Error & { digest?: string },
      '/',
    )

    expect(capturedMessage).toContain('hash=[REDACTED]')
    expect(capturedMessage).toContain('secret=[REDACTED]')
  })
})
