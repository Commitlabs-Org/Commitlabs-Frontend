import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST } from '@/app/api/commitments/route'
import { createMockRequest, createMockRouteContext, parseResponse } from './helpers'

vi.mock('@/lib/backend/rateLimit', () => {
  return {
    checkRateLimit: vi.fn(async () => true),
  }
})

vi.mock('@/lib/backend/services/contracts', () => {
  let commitmentCounter = 0
  return {
    getUserCommitmentsFromChain: vi.fn(async () => {
      return [
        {
          id: 1,
          ownerAddress: 'GOWNER',
          asset: 'XLM',
          amount: '100',
          status: 'active',
          complianceScore: 100,
          currentValue: '100',
          feeEarned: '0',
          violationCount: 0,
          createdAt: '2024-01-01T00:00:00.000Z',
          expiresAt: '2024-01-02T00:00:00.000Z',
        },
      ]
    }),
    createCommitmentOnChain: vi.fn(async () => {
      commitmentCounter += 1
      return {
        commitmentId: String(commitmentCounter),
        ownerAddress: 'GOWNER',
        asset: 'XLM',
        amount: '100',
        status: 'pending',
        createdAt: '2024-01-01T00:00:00.000Z',
      }
    }),
  }
})

vi.mock('@/lib/backend/services/contracts', () => ({
  getUserCommitmentsFromChain: vi.fn(),
  createCommitmentOnChain: vi.fn(),
}))

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
}))

import { getUserCommitmentsFromChain, createCommitmentOnChain } from '@/lib/backend/services/contracts'

const MOCK_COMMITMENT = {
  id: 'commit_1',
  ownerAddress: 'GOWNER',
  asset: 'USDC',
  amount: '1000',
  status: 'ACTIVE' as const,
  complianceScore: 95,
  currentValue: '1050',
  feeEarned: '10',
  violationCount: 0,
  createdAt: '2026-01-01T00:00:00Z',
  expiresAt: '2027-01-01T00:00:00Z',
}

describe('GET /api/commitments', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should return a list of commitments', async () => {
    vi.mocked(getUserCommitmentsFromChain).mockResolvedValue([MOCK_COMMITMENT])

    const request = createMockRequest(
      'http://localhost:3000/api/commitments?ownerAddress=GOWNER'
    )
    const response = await GET(request, createMockRouteContext())
    const result = await parseResponse(response)

    expect(result.status).toBe(200)
    expect(result.data).toHaveProperty('success', true)
    expect(result.data).toHaveProperty('data')
    expect(result.data.data).toHaveProperty('items')
    expect(result.data.data).toHaveProperty('page')
    expect(result.data.data).toHaveProperty('pageSize')
    expect(result.data.data).toHaveProperty('total')
    expect(Array.isArray(result.data.data.items)).toBe(true)
  })

  it('should return commitments filtered by status', async () => {
    const request = createMockRequest(
      'http://localhost:3000/api/commitments?ownerAddress=GOWNER&status=active'
    )
    const response = await GET(request, createMockRouteContext())
    const result = await parseResponse(response)

    expect(result.status).toBe(200)
    expect(result.data.data.items).toBeInstanceOf(Array)
    result.data.data.items.forEach((commitment: any) => {
      expect(commitment.status).toBe('active')
    })
  })

  it('should support pagination', async () => {
    vi.mocked(getUserCommitmentsFromChain).mockResolvedValue([MOCK_COMMITMENT])

    const request = createMockRequest(
      'http://localhost:3000/api/commitments?ownerAddress=GOWNER&page=1&pageSize=5'
    )
    const response = await GET(request, createMockRouteContext())
    const result = await parseResponse(response)

    expect(result.status).toBe(200)
    expect(result.data.data.page).toBe(1)
    expect(result.data.data.pageSize).toBe(5)
    expect(result.data.data.items.length).toBeLessThanOrEqual(5)
  })

  it('should return commitment objects with required fields', async () => {
    vi.mocked(getUserCommitmentsFromChain).mockResolvedValue([MOCK_COMMITMENT])

    const request = createMockRequest(
      'http://localhost:3000/api/commitments?ownerAddress=GOWNER'
    )
    const response = await GET(request, createMockRouteContext())
    const result = await parseResponse(response)

    expect(result.data.data.items.length).toBeGreaterThan(0)

    result.data.data.items.forEach((commitment: any) => {
      expect(commitment).toHaveProperty('commitmentId')
      expect(commitment).toHaveProperty('ownerAddress')
      expect(commitment).toHaveProperty('asset')
      expect(commitment).toHaveProperty('amount')
      expect(commitment).toHaveProperty('status')
      expect(commitment).toHaveProperty('createdAt')
    })
  })

  it('should include x-request-id response header (generated)', async () => {
    const request = createMockRequest('http://localhost:3000/api/commitments?ownerAddress=GOWNER')
    const response = await GET(request, createMockRouteContext())
    const result = await parseResponse(response)

    const requestId = result.headers.get('x-request-id')
    expect(typeof requestId).toBe('string')
    expect(requestId?.length).toBeGreaterThan(0)
  })

  it('should preserve x-request-id when provided by client', async () => {
    const incomingRequestId = 'test-request-id-abc'
    const request = createMockRequest('http://localhost:3000/api/commitments?ownerAddress=GOWNER', {
      headers: {
        'x-request-id': incomingRequestId,
      },
    })
    const response = await GET(request, createMockRouteContext())
    const result = await parseResponse(response)

    expect(result.headers.get('x-request-id')).toBe(incomingRequestId)
  })
})

describe('POST /api/commitments', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should create a new commitment with valid data', async () => {
    const commitmentData = {
      ownerAddress: 'GOWNER',
      asset: 'XLM',
      amount: '100',
      durationDays: 1,
      maxLossBps: 0,
    }

    const request = createMockRequest('http://localhost:3000/api/commitments', {
      method: 'POST',
      body: {
        ownerAddress: 'GOWNER',
        asset: 'USDC',
        amount: '1000',
        durationDays: 30,
        maxLossBps: 500,
      },
    })

    const response = await POST(request, createMockRouteContext())
    const result = await parseResponse(response)

    expect(result.status).toBe(201)
    expect(result.data).toHaveProperty('success', true)
    expect(result.data.data).toHaveProperty('commitmentId')
  })

  it('should return 400 if ownerAddress is missing', async () => {
    const request = createMockRequest('http://localhost:3000/api/commitments', {
      method: 'POST',
      body: { asset: 'USDC', amount: '1000', durationDays: 30, maxLossBps: 500 },
    })

    const response = await POST(request, createMockRouteContext())
    const result = await parseResponse(response)

    expect(result.status).toBe(400)
  })

  it('should return 400 if asset is missing', async () => {
    const request = createMockRequest('http://localhost:3000/api/commitments', {
      method: 'POST',
      body: { ownerAddress: 'GOWNER', amount: '1000', durationDays: 30, maxLossBps: 500 },
    })

    const response = await POST(request, createMockRouteContext())
    const result = await parseResponse(response)

    expect(result.status).toBe(400)
  })

  it('should return 400 if amount is invalid', async () => {
    const request = createMockRequest('http://localhost:3000/api/commitments', {
      method: 'POST',
      body: { ownerAddress: 'GOWNER', asset: 'USDC', amount: 'bad', durationDays: 30, maxLossBps: 500 },
    })

    const response = await POST(request, createMockRouteContext())
    const result = await parseResponse(response)

    expect(result.status).toBe(400)
  })

  it('should generate a unique ID for each commitment', async () => {
    const commitmentData = {
      ownerAddress: 'GOWNER',
      asset: 'XLM',
      amount: '100',
      durationDays: 1,
      maxLossBps: 0,
    }

    const request1 = createMockRequest(
      'http://localhost:3000/api/commitments',
      {
        method: 'POST',
        body: commitmentData,
      }
    )

    const body = { ownerAddress: 'GOWNER', asset: 'USDC', amount: '1000', durationDays: 30, maxLossBps: 500 }

    const response1 = await POST(request1, createMockRouteContext())
    const response2 = await POST(request2, createMockRouteContext())

    const d1 = await parseResponse(r1)
    const d2 = await parseResponse(r2)

    // IDs should be different
    expect(result1.data.data.commitmentId).not.toBe(result2.data.data.commitmentId)
  })

  it('should include x-request-id response header', async () => {
    const request = createMockRequest('http://localhost:3000/api/commitments', {
      method: 'POST',
      body: {
        ownerAddress: 'GOWNER',
        asset: 'XLM',
        amount: '100',
        durationDays: 1,
        maxLossBps: 0,
      },
    })

    const response = await POST(request, createMockRouteContext())
    expect(response.headers.get('x-request-id')).toBeTruthy()
  })
})
