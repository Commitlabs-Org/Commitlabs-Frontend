import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST } from '@/app/api/commitments/route'
import { createMockRequest, parseResponse } from './helpers'

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
    const response = await GET(request, { params: {} })
    const result = await parseResponse(response)

    expect(result.status).toBe(200)
    expect(result.data.data).toHaveProperty('items')
    expect(result.data.data).toHaveProperty('total')
    expect(Array.isArray(result.data.data.items)).toBe(true)
  })

  it('should return 400 when ownerAddress is missing', async () => {
    const request = createMockRequest('http://localhost:3000/api/commitments')
    const response = await GET(request, { params: {} })
    const result = await parseResponse(response)

    expect(result.status).toBe(400)
  })

  it('should support pagination', async () => {
    vi.mocked(getUserCommitmentsFromChain).mockResolvedValue([MOCK_COMMITMENT])

    const request = createMockRequest(
      'http://localhost:3000/api/commitments?ownerAddress=GOWNER&page=1&pageSize=5'
    )
    const response = await GET(request, { params: {} })
    const result = await parseResponse(response)

    expect(result.status).toBe(200)
    expect(result.data.data.pageSize).toBe(5)
    expect(result.data.data.page).toBe(1)
  })

  it('should return commitment objects with required fields', async () => {
    vi.mocked(getUserCommitmentsFromChain).mockResolvedValue([MOCK_COMMITMENT])

    const request = createMockRequest(
      'http://localhost:3000/api/commitments?ownerAddress=GOWNER'
    )
    const response = await GET(request, { params: {} })
    const result = await parseResponse(response)

    expect(result.data.data.items.length).toBeGreaterThan(0)
    result.data.data.items.forEach((c: any) => {
      expect(c).toHaveProperty('commitmentId')
      expect(c).toHaveProperty('asset')
      expect(c).toHaveProperty('amount')
      expect(c).toHaveProperty('status')
    })
  })
})

describe('POST /api/commitments', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should create a new commitment with valid data', async () => {
    vi.mocked(createCommitmentOnChain).mockResolvedValue({
      commitmentId: 'commit_new',
      commitment: MOCK_COMMITMENT,
      txHash: 'txhash123',
    })

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

    const response = await POST(request, { params: {} })
    const result = await parseResponse(response)

    expect(result.status).toBe(201)
    expect(result.data.data).toHaveProperty('commitmentId')
  })

  it('should return 400 if ownerAddress is missing', async () => {
    const request = createMockRequest('http://localhost:3000/api/commitments', {
      method: 'POST',
      body: { asset: 'USDC', amount: '1000', durationDays: 30, maxLossBps: 500 },
    })

    const response = await POST(request, { params: {} })
    const result = await parseResponse(response)

    expect(result.status).toBe(400)
  })

  it('should return 400 if asset is missing', async () => {
    const request = createMockRequest('http://localhost:3000/api/commitments', {
      method: 'POST',
      body: { ownerAddress: 'GOWNER', amount: '1000', durationDays: 30, maxLossBps: 500 },
    })

    const response = await POST(request, { params: {} })
    const result = await parseResponse(response)

    expect(result.status).toBe(400)
  })

  it('should return 400 if amount is invalid', async () => {
    const request = createMockRequest('http://localhost:3000/api/commitments', {
      method: 'POST',
      body: { ownerAddress: 'GOWNER', asset: 'USDC', amount: 'bad', durationDays: 30, maxLossBps: 500 },
    })

    const response = await POST(request, { params: {} })
    const result = await parseResponse(response)

    expect(result.status).toBe(400)
  })

  it('should generate a unique commitmentId for each call', async () => {
    vi.mocked(createCommitmentOnChain)
      .mockResolvedValueOnce({ commitmentId: 'commit_1', commitment: MOCK_COMMITMENT })
      .mockResolvedValueOnce({ commitmentId: 'commit_2', commitment: MOCK_COMMITMENT })

    const body = { ownerAddress: 'GOWNER', asset: 'USDC', amount: '1000', durationDays: 30, maxLossBps: 500 }

    const r1 = await POST(createMockRequest('http://localhost:3000/api/commitments', { method: 'POST', body }), { params: {} })
    const r2 = await POST(createMockRequest('http://localhost:3000/api/commitments', { method: 'POST', body }), { params: {} })

    const d1 = await parseResponse(r1)
    const d2 = await parseResponse(r2)

    expect(d1.data.data.commitmentId).not.toBe(d2.data.data.commitmentId)
  })
})
