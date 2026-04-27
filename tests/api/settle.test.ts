import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/commitments/[id]/settle/route'
import { createMockRequest, parseResponse } from './helpers'
import * as contractsModule from '@/lib/backend/services/contracts'

const OWNER_ADDRESS = 'GABC123OWNER456789'
const OTHER_ADDRESS = 'GXYZ789OTHER123456'
const COMMITMENT_ID = 'cm_test_123'
const PAST_EXPIRY = new Date(Date.now() - 1000).toISOString()
const FUTURE_EXPIRY = new Date(Date.now() + 100000).toISOString()

async function createSettleRequest(
  commitmentId: string,
  body: { actorAddress: string; callerAddress?: string }
) {
  return createMockRequest(
    `http://localhost:3000/api/commitments/${commitmentId}/settle`,
    { method: 'POST', body }
  )
}

vi.mock('@/lib/backend/services/contracts', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getCommitmentFromChain: vi.fn(),
    settleCommitmentOnChain: vi.fn(),
  }
})

describe('POST /api/commitments/[id]/settle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 200 on successful settlement', async () => {
    const mockCommitment = {
      id: COMMITMENT_ID,
      ownerAddress: OWNER_ADDRESS,
      status: 'ACTIVE',
      expiresAt: PAST_EXPIRY,
    }
    const mockSettlement = {
      settlementAmount: '100',
      finalStatus: 'SETTLED',
      txHash: 'tx123',
      reference: 'ref123',
    }

    vi.mocked(contractsModule.getCommitmentFromChain).mockResolvedValue(mockCommitment)
    vi.mocked(contractsModule.settleCommitmentOnChain).mockResolvedValue(mockSettlement)

    const request = await createSettleRequest(COMMITMENT_ID, {
      actorAddress: OWNER_ADDRESS,
    })
    const response = await POST(request, { params: { id: COMMITMENT_ID } })
    const result = await parseResponse(response)

    expect(result.status).toBe(200)
    expect(result.data.success).toBe(true)
    expect(result.data.data.commitmentId).toBe(COMMITMENT_ID)
    expect(result.data.data.settlementAmount).toBe('100')
    expect(result.data.data.finalStatus).toBe('SETTLED')
  })

  it('should return 403 if actor is not the owner', async () => {
    const mockCommitment = {
      id: COMMITMENT_ID,
      ownerAddress: OWNER_ADDRESS,
      status: 'ACTIVE',
      expiresAt: PAST_EXPIRY,
    }

    vi.mocked(contractsModule.getCommitmentFromChain).mockResolvedValue(mockCommitment)

    const request = await createSettleRequest(COMMITMENT_ID, {
      actorAddress: OTHER_ADDRESS,
    })
    const response = await POST(request, { params: { id: COMMITMENT_ID } })
    const result = await parseResponse(response)

    expect(result.status).toBe(403)
    expect(result.data.success).toBe(false)
    expect(result.data.error.code).toBe('FORBIDDEN')
  })

  it('should return 409 if already settled', async () => {
    const mockCommitment = {
      id: COMMITMENT_ID,
      ownerAddress: OWNER_ADDRESS,
      status: 'SETTLED',
      expiresAt: PAST_EXPIRY,
    }

    vi.mocked(contractsModule.getCommitmentFromChain).mockResolvedValue(mockCommitment)

    const request = await createSettleRequest(COMMITMENT_ID, {
      actorAddress: OWNER_ADDRESS,
    })
    const response = await POST(request, { params: { id: COMMITMENT_ID } })
    const result = await parseResponse(response)

    expect(result.status).toBe(409)
    expect(result.data.success).toBe(false)
    expect(result.data.error.code).toBe('CONFLICT')
  })

  it('should return 409 if violated', async () => {
    const mockCommitment = {
      id: COMMITMENT_ID,
      ownerAddress: OWNER_ADDRESS,
      status: 'VIOLATED',
      expiresAt: PAST_EXPIRY,
    }

    vi.mocked(contractsModule.getCommitmentFromChain).mockResolvedValue(mockCommitment)

    const request = await createSettleRequest(COMMITMENT_ID, {
      actorAddress: OWNER_ADDRESS,
    })
    const response = await POST(request, { params: { id: COMMITMENT_ID } })
    const result = await parseResponse(response)

    expect(result.status).toBe(409)
    expect(result.data.success).toBe(false)
    expect(result.data.error.code).toBe('CONFLICT')
  })

  it('should return 409 if early exited', async () => {
    const mockCommitment = {
      id: COMMITMENT_ID,
      ownerAddress: OWNER_ADDRESS,
      status: 'EARLY_EXIT',
      expiresAt: PAST_EXPIRY,
    }

    vi.mocked(contractsModule.getCommitmentFromChain).mockResolvedValue(mockCommitment)

    const request = await createSettleRequest(COMMITMENT_ID, {
      actorAddress: OWNER_ADDRESS,
    })
    const response = await POST(request, { params: { id: COMMITMENT_ID } })
    const result = await parseResponse(response)

    expect(result.status).toBe(409)
    expect(result.data.success).toBe(false)
    expect(result.data.error.code).toBe('CONFLICT')
  })

  it('should return 400 if commitment has not matured', async () => {
    const mockCommitment = {
      id: COMMITMENT_ID,
      ownerAddress: OWNER_ADDRESS,
      status: 'ACTIVE',
      expiresAt: FUTURE_EXPIRY,
    }

    vi.mocked(contractsModule.getCommitmentFromChain).mockResolvedValue(mockCommitment)

    const request = await createSettleRequest(COMMITMENT_ID, {
      actorAddress: OWNER_ADDRESS,
    })
    const response = await POST(request, { params: { id: COMMITMENT_ID } })
    const result = await parseResponse(response)

    expect(result.status).toBe(400)
    expect(result.data.success).toBe(false)
    expect(result.data.error.code).toBe('VALIDATION_ERROR')
  })

  it('should return 400 if actor address is missing', async () => {
    const request = createMockRequest(
      `http://localhost:3000/api/commitments/${COMMITMENT_ID}/settle`,
      { method: 'POST', body: { callerAddress: 'test' } }
    )
    const response = await POST(request, { params: { id: COMMITMENT_ID } })
    const result = await parseResponse(response)

    expect(result.status).toBe(400)
    expect(result.data.success).toBe(false)
  })
})