import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockRequest, createMockRouteContext, parseResponse } from './helpers'

vi.mock('@/lib/backend/csrf', () => ({
  assertMutationCsrf: vi.fn(),
}))

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
  getRateLimitWindowSeconds: vi.fn().mockReturnValue(60),
}))

vi.mock('@/lib/backend/services/contracts', () => ({
  getCommitmentFromChain: vi.fn().mockResolvedValue({
    status: 'CREATED',
    ownerAddress: 'GABCDEFTESTOWNERADDRESS',
  }),
  fundEscrowOnChain: vi.fn().mockResolvedValue({
    txHash: '0xtestTxHash',
    reference: 'ref-test-1',
  }),
}))

vi.mock('@/lib/backend/idempotency', () => ({
  idempotencyService: {
    getRecord: vi.fn().mockResolvedValue(null),
    start: vi.fn().mockResolvedValue(undefined),
    complete: vi.fn().mockResolvedValue(undefined),
    fail: vi.fn().mockResolvedValue(undefined),
  },
}))

import { POST } from '@/app/api/commitments/[id]/fund/route'

describe('POST /api/commitments/[id]/fund - security headers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('attaches standard security headers to the response', async () => {
    const req = createMockRequest('http://localhost:3000/api/commitments/test-id/fund', {
      method: 'POST',
      body: { callerAddress: 'GABCDEFTESTOWNERADDRESS' },
    })

    const res = await POST(req, createMockRouteContext({ id: 'test-id' }))
    const { status, headers } = await parseResponse(res)

    expect(status).toBe(200)
    expect(headers.get('Content-Security-Policy')).toBe("default-src 'self'")
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(headers.get('X-Frame-Options')).toBe('DENY')
    expect(headers.get('X-XSS-Protection')).toBe('1; mode=block')
    expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
  })

  it('still attaches security headers on an error response', async () => {
    const req = createMockRequest('http://localhost:3000/api/commitments/test-id/fund', {
      method: 'POST',
      body: { callerAddress: 'someone-else' },
    })

    const res = await POST(req, createMockRouteContext({ id: 'test-id' }))
    const { status, headers } = await parseResponse(res)

    expect(status).toBe(403)
    expect(headers.get('Content-Security-Policy')).toBe("default-src 'self'")
    expect(headers.get('X-Frame-Options')).toBe('DENY')
  })
})
