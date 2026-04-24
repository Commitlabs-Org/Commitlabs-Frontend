import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, OPTIONS, POST } from '@/app/api/commitments/route'
import { checkRateLimit } from '@/lib/backend/rateLimit'
import {
  createCommitmentOnChain,
  getUserCommitmentsFromChain,
} from '@/lib/backend/services/contracts'
import { createMockRequest, parseResponse } from './helpers'

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn(async () => true),
}))

vi.mock('@/lib/backend/services/contracts', () => ({
  getUserCommitmentsFromChain: vi.fn(async () => []),
  createCommitmentOnChain: vi.fn(),
}))

const FIRST_PARTY_ORIGIN = 'https://app.commitlabs.test'

const mockCommitments = [
  {
    id: 'commitment_1',
    ownerAddress: 'GOWNER123',
    asset: 'USDC',
    amount: '1000',
    status: 'ACTIVE',
    complianceScore: 92,
    currentValue: '1025',
    feeEarned: '25',
    violationCount: 0,
    createdAt: '2026-04-20T10:00:00.000Z',
    expiresAt: '2026-05-20T10:00:00.000Z',
  },
  {
    id: 'commitment_2',
    ownerAddress: 'GOWNER123',
    asset: 'XLM',
    amount: '500',
    status: 'SETTLED',
    complianceScore: 100,
    currentValue: '540',
    feeEarned: '40',
    violationCount: 0,
    createdAt: '2026-04-10T10:00:00.000Z',
    expiresAt: '2026-05-10T10:00:00.000Z',
  },
] as const

beforeEach(() => {
  vi.clearAllMocks()
  process.env.COMMITLABS_FIRST_PARTY_ORIGINS = FIRST_PARTY_ORIGIN
  vi.mocked(checkRateLimit).mockResolvedValue(true)
  vi.mocked(getUserCommitmentsFromChain).mockResolvedValue([...mockCommitments])
})

describe('GET /api/commitments', () => {
  it('should return paginated commitments for a valid owner', async () => {
    const request = createMockRequest(
      'http://localhost:3000/api/commitments?ownerAddress=GOWNER123&page=1&pageSize=1',
      {
        headers: {
          Origin: FIRST_PARTY_ORIGIN,
        },
      }
    )

    const response = await GET(request)
    const result = await parseResponse(response)

    expect(result.status).toBe(200)
    expect(result.data.success).toBe(true)
    expect(result.data.data.items).toHaveLength(1)
    expect(result.data.data.items[0]).toMatchObject({
      commitmentId: 'commitment_1',
      ownerAddress: 'GOWNER123',
      asset: 'USDC',
      amount: '1000',
      status: 'ACTIVE',
    })
    expect(result.data.data.page).toBe(1)
    expect(result.data.data.pageSize).toBe(1)
    expect(result.data.data.total).toBe(2)
    expect(checkRateLimit).toHaveBeenCalledWith('anonymous', 'api/commitments')
    expect(getUserCommitmentsFromChain).toHaveBeenCalledWith('GOWNER123')
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      FIRST_PARTY_ORIGIN
    )
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true')
  })

  it('should return 400 when ownerAddress is missing', async () => {
    const request = createMockRequest('http://localhost:3000/api/commitments')

    const response = await GET(request)
    const result = await parseResponse(response)

    expect(result.status).toBe(400)
    expect(result.data.success).toBe(false)
    expect(result.data.error.code).toBe('BAD_REQUEST')
    expect(result.data.error.message).toBe('Missing ownerAddress')
  })

  it('should return 400 when pagination params are invalid', async () => {
    const request = createMockRequest(
      'http://localhost:3000/api/commitments?ownerAddress=GOWNER123&page=0&pageSize=101'
    )

    const response = await GET(request)
    const result = await parseResponse(response)

    expect(result.status).toBe(400)
    expect(result.data.error.code).toBe('BAD_REQUEST')
    expect(result.data.error.message).toBe('Invalid pagination params')
  })

  it('should return 429 when rate limiting denies the request', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(false)

    const request = createMockRequest(
      'http://localhost:3000/api/commitments?ownerAddress=GOWNER123'
    )

    const response = await GET(request)
    const result = await parseResponse(response)

    expect(result.status).toBe(429)
    expect(result.data.success).toBe(false)
    expect(result.data.error.code).toBe('TOO_MANY_REQUESTS')
  })

  it('should reject disallowed browser origins', async () => {
    const request = createMockRequest(
      'http://localhost:3000/api/commitments?ownerAddress=GOWNER123',
      {
        headers: {
          Origin: 'https://evil.example',
        },
      }
    )

    const response = await GET(request)
    const result = await parseResponse(response)

    expect(result.status).toBe(403)
    expect(result.data.success).toBe(false)
    expect(result.data.error.code).toBe('FORBIDDEN')
  })

  it('should answer first-party preflight requests', async () => {
    const request = new NextRequest('http://localhost:3000/api/commitments', {
      method: 'OPTIONS',
      headers: {
        Origin: FIRST_PARTY_ORIGIN,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type',
      },
    })

    const response = await OPTIONS(request)

    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      FIRST_PARTY_ORIGIN
    )
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true')
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe(
      'GET, POST, OPTIONS'
    )
    expect(response.headers.get('Access-Control-Allow-Headers')).toBe(
      'Authorization, Content-Type, X-Requested-With'
    )
  })
})

describe('POST /api/commitments', () => {
  it('should create a commitment with a valid request body', async () => {
    vi.mocked(createCommitmentOnChain).mockResolvedValue({
      commitmentId: 'commitment_3',
      commitment: {
        id: 'commitment_3',
        ownerAddress: 'GOWNER123',
        asset: 'USDC',
        amount: '2500',
        status: 'ACTIVE',
        complianceScore: 0,
        currentValue: '2500',
        feeEarned: '0',
        violationCount: 0,
      },
      txHash: 'tx_123',
    })

    const body = {
      ownerAddress: 'GOWNER123',
      asset: 'USDC',
      amount: '2500',
      durationDays: 30,
      maxLossBps: 500,
      metadata: { label: 'Growth plan' },
    }

    const request = createMockRequest('http://localhost:3000/api/commitments', {
      method: 'POST',
      body,
      headers: {
        Origin: FIRST_PARTY_ORIGIN,
      },
    })

    const response = await POST(request)
    const result = await parseResponse(response)

    expect(result.status).toBe(201)
    expect(result.data.success).toBe(true)
    expect(result.data.data).toMatchObject({
      commitmentId: 'commitment_3',
      txHash: 'tx_123',
    })
    expect(createCommitmentOnChain).toHaveBeenCalledWith(body)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      FIRST_PARTY_ORIGIN
    )
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true')
  })

  it('should return 400 when ownerAddress is invalid', async () => {
    const request = createMockRequest('http://localhost:3000/api/commitments', {
      method: 'POST',
      body: {
        asset: 'USDC',
        amount: '1000',
        durationDays: 30,
        maxLossBps: 500,
      },
    })

    const response = await POST(request)
    const result = await parseResponse(response)

    expect(result.status).toBe(400)
    expect(result.data.success).toBe(false)
    expect(result.data.error.code).toBe('BAD_REQUEST')
    expect(result.data.error.message).toBe('Invalid ownerAddress')
  })

  it('should return 400 when amount is invalid', async () => {
    const request = createMockRequest('http://localhost:3000/api/commitments', {
      method: 'POST',
      body: {
        ownerAddress: 'GOWNER123',
        asset: 'USDC',
        amount: 'not-a-number',
        durationDays: 30,
        maxLossBps: 500,
      },
    })

    const response = await POST(request)
    const result = await parseResponse(response)

    expect(result.status).toBe(400)
    expect(result.data.error.code).toBe('BAD_REQUEST')
    expect(result.data.error.message).toBe('Invalid amount')
  })

  it('should return 400 when asset is invalid', async () => {
    const request = createMockRequest('http://localhost:3000/api/commitments', {
      method: 'POST',
      body: {
        ownerAddress: 'GOWNER123',
        amount: '1000',
        durationDays: 30,
        maxLossBps: 500,
      },
    })

    const response = await POST(request)
    const result = await parseResponse(response)

    expect(result.status).toBe(400)
    expect(result.data.error.code).toBe('BAD_REQUEST')
    expect(result.data.error.message).toBe('Invalid asset')
  })

  it('should return 400 when durationDays is invalid', async () => {
    const request = createMockRequest('http://localhost:3000/api/commitments', {
      method: 'POST',
      body: {
        ownerAddress: 'GOWNER123',
        asset: 'USDC',
        amount: '1000',
        durationDays: 0,
        maxLossBps: 500,
      },
    })

    const response = await POST(request)
    const result = await parseResponse(response)

    expect(result.status).toBe(400)
    expect(result.data.error.code).toBe('BAD_REQUEST')
    expect(result.data.error.message).toBe('Invalid durationDays')
  })

  it('should return 400 when maxLossBps is invalid', async () => {
    const request = createMockRequest('http://localhost:3000/api/commitments', {
      method: 'POST',
      body: {
        ownerAddress: 'GOWNER123',
        asset: 'USDC',
        amount: '1000',
        durationDays: 30,
        maxLossBps: -1,
      },
    })

    const response = await POST(request)
    const result = await parseResponse(response)

    expect(result.status).toBe(400)
    expect(result.data.error.code).toBe('BAD_REQUEST')
    expect(result.data.error.message).toBe('Invalid maxLossBps')
  })

  it('should return 429 when creation is rate limited', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(false)

    const request = createMockRequest('http://localhost:3000/api/commitments', {
      method: 'POST',
      body: {
        ownerAddress: 'GOWNER123',
        asset: 'USDC',
        amount: '1000',
        durationDays: 30,
        maxLossBps: 500,
      },
    })

    const response = await POST(request)
    const result = await parseResponse(response)

    expect(result.status).toBe(429)
    expect(result.data.error.code).toBe('TOO_MANY_REQUESTS')
    expect(createCommitmentOnChain).not.toHaveBeenCalled()
  })
})
