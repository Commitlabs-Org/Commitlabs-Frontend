import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/commitments/[id]/early-exit/route'
import { createMockRequest, parseResponse } from './helpers'
import * as contractsModule from '@/lib/backend/services/contracts'

const OWNER_ADDRESS = 'GABC123OWNER456789'
const OTHER_ADDRESS = 'GXYZ789OTHER123456'
const COMMITMENT_ID = 'cm_test_123'

async function createEarlyExitRequest(
  commitmentId: string,
  body: { actorAddress: string; callerAddress?: string }
) {
  return createMockRequest(
    `http://localhost:3000/api/commitments/${commitmentId}/early-exit`,
    { method: 'POST', body }
  )
}

vi.mock('@/lib/backend/services/contracts', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getCommitmentFromChain: vi.fn(),
    earlyExitCommitmentOnChain: vi.fn(),
  }
})

describe('POST /api/commitments/[id]/early-exit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 200 on successful early exit', async () => {
    const mockCommitment = {
      id: COMMITMENT_ID,
      ownerAddress: OWNER_ADDRESS,
      status: 'ACTIVE',
      amount: '100',
    }
    const mockExit = {
      exitAmount: '90',
      penaltyAmount: '10',
      finalStatus: 'EARLY_EXIT',
      txHash: 'tx123',
      reference: 'ref123',
    }

    vi.mocked(contractsModule.getCommitmentFromChain).mockResolvedValue(mockCommitment)
    vi.mocked(contractsModule.earlyExitCommitmentOnChain).mockResolvedValue(mockExit)

    const request = await createEarlyExitRequest(COMMITMENT_ID, {
      actorAddress: OWNER_ADDRESS,
    })
    const response = await POST(request, { params: { id: COMMITMENT_ID } })
    const result = await parseResponse(response)

    expect(result.status).toBe(200)
    expect(result.data.success).toBe(true)
    expect(result.data.data.commitmentId).toBe(COMMITMENT_ID)
    expect(result.data.data.exitAmount).toBe('90')
    expect(result.data.data.penaltyAmount).toBe('10')
    expect(result.data.data.finalStatus).toBe('EARLY_EXIT')
  })

  it('should return 403 if actor is not the owner', async () => {
    const mockCommitment = {
      id: COMMITMENT_ID,
      ownerAddress: OWNER_ADDRESS,
      status: 'ACTIVE',
    }

    vi.mocked(contractsModule.getCommitmentFromChain).mockResolvedValue(mockCommitment)

    const request = await createEarlyExitRequest(COMMITMENT_ID, {
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
    }

    vi.mocked(contractsModule.getCommitmentFromChain).mockResolvedValue(mockCommitment)

    const request = await createEarlyExitRequest(COMMITMENT_ID, {
      actorAddress: OWNER_ADDRESS,
    })
    const response = await POST(request, { params: { id: COMMITMENT_ID } })
    const result = await parseResponse(response)

    expect(result.status).toBe(409)
    expect(result.data.success).toBe(false)
    expect(result.data.error.code).toBe('CONFLICT')
  })

  it('should return 409 if already early exited', async () => {
    const mockCommitment = {
      id: COMMITMENT_ID,
      ownerAddress: OWNER_ADDRESS,
      status: 'EARLY_EXIT',
    }

    vi.mocked(contractsModule.getCommitmentFromChain).mockResolvedValue(mockCommitment)

    const request = await createEarlyExitRequest(COMMITMENT_ID, {
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
    }

    vi.mocked(contractsModule.getCommitmentFromChain).mockResolvedValue(mockCommitment)

    const request = await createEarlyExitRequest(COMMITMENT_ID, {
      actorAddress: OWNER_ADDRESS,
    })
    const response = await POST(request, { params: { id: COMMITMENT_ID } })
    const result = await parseResponse(response)

    expect(result.status).toBe(409)
    expect(result.data.success).toBe(false)
    expect(result.data.error.code).toBe('CONFLICT')
  })

  it('should return 400 if invalid JSON in request body', async () => {
    const request = new Request(
      `http://localhost:3000/api/commitments/${COMMITMENT_ID}/early-exit`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      }
    )
    const response = await POST(request as any, { params: { id: COMMITMENT_ID } })
    const result = await parseResponse(response)

    expect(result.status).toBe(400)
    expect(result.data.success).toBe(false)
  })

  it('should return 400 if actor address is missing', async () => {
    const request = createMockRequest(
      `http://localhost:3000/api/commitments/${COMMITMENT_ID}/early-exit`,
      { method: 'POST', body: { callerAddress: 'test' } }
    )
    const response = await POST(request, { params: { id: COMMITMENT_ID } })
    const result = await parseResponse(response)

    expect(result.status).toBe(400)
    expect(result.data.success).toBe(false)
  })
})