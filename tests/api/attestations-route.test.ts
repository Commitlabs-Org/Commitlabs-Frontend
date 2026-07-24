import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '@/app/api/attestations/route';
import { MAX_PAYLOAD_BYTES, MAX_STRING_LENGTH } from '@/lib/backend/attestationSchemas';
import type { Attestation } from '@/lib/types/domain';
import { createMockRequest, parseResponse } from './helpers';
import { getMockData } from '@/lib/backend/mockDb';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import {
  getCommitmentFromChain,
  recordAttestationOnChain,
} from '@/lib/backend/services/contracts';

vi.mock('@/lib/backend/mockDb', () => ({
  getMockData: vi.fn(),
}));

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn(),
}));

vi.mock('@/lib/backend/services/contracts', () => ({
  getCommitmentFromChain: vi.fn(),
  recordAttestationOnChain: vi.fn(),
}));

const VALID_ADDRESS = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

const ATTESTATIONS: Attestation[] = [
  {
    id: 'att-1',
    commitmentId: 'commitment-1',
    observedAt: '2026-04-20T10:00:00Z',
    details: { reason: 'first' },
  },
  {
    id: 'att-2',
    commitmentId: 'commitment-1',
    observedAt: '2026-04-21T10:00:00Z',
    details: { reason: 'second' },
  },
  {
    id: 'att-3',
    commitmentId: 'commitment-2',
    observedAt: '2026-04-22T10:00:00Z',
    details: { reason: 'third' },
  },
];

describe('GET /api/attestations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkRateLimit).mockResolvedValue(true);
    vi.mocked(getMockData).mockResolvedValue({
      commitments: [],
      attestations: ATTESTATIONS,
      listings: [],
    });
  });

  it('filters by commitmentId and returns pagination meta', async () => {
    const req = createMockRequest(
      'http://localhost:3000/api/attestations?commitmentId=commitment-1&page=2&pageSize=1'
    );

    const response = await GET(req, { params: {} });
    const { status, data } = await parseResponse(response);

    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.attestations).toHaveLength(1);
    expect(data.data.attestations[0].id).toBe('att-2');
    expect(data.data.total).toBe(2);
    expect(data.meta).toMatchObject({
      page: 2,
      pageSize: 1,
      total: 2,
      totalPages: 2,
      hasNextPage: false,
      hasPrevPage: true,
    });
  });

  it('returns an empty list with pagination metadata when nothing matches', async () => {
    const req = createMockRequest(
      'http://localhost:3000/api/attestations?commitmentId=missing&page=1&pageSize=10'
    );

    const response = await GET(req, { params: {} });
    const { status, data } = await parseResponse(response);

    expect(status).toBe(200);
    expect(data.data.attestations).toEqual([]);
    expect(data.data.total).toBe(0);
    expect(data.meta).toMatchObject({
      page: 1,
      pageSize: 10,
      total: 0,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    });
  });

  it('returns 400 for invalid pagination params', async () => {
    const req = createMockRequest(
      'http://localhost:3000/api/attestations?page=0&pageSize=101'
    );

    const response = await GET(req, { params: {} });
    const { status, data } = await parseResponse(response);

    expect(status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/attestations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkRateLimit).mockResolvedValue(true);
    vi.mocked(getCommitmentFromChain).mockResolvedValue({
      id: 'commitment-1',
      ownerAddress: VALID_ADDRESS,
      status: 'Active',
    } as any);
    vi.mocked(recordAttestationOnChain).mockResolvedValue({
      attestationId: 'chain-att-1',
      commitmentId: 'commitment-1',
      complianceScore: 91,
      violation: false,
      feeEarned: '125',
      recordedAt: '2026-04-25T12:00:00Z',
      contractVersion: '1.0.0',
      txHash: 'tx-123',
    } as any);
  });

  it('accepts a valid attestation payload for its schema', async () => {
    const req = createMockRequest('http://localhost:3000/api/attestations', {
      method: 'POST',
      body: {
        commitmentId: 'commitment-1',
        attestationType: 'fee_generation',
        data: {
          feeEarned: '125',
          asset: 'XLM',
          complianceScore: 91,
        },
        verifiedBy: VALID_ADDRESS,
        signature: 'signed-payload',
      },
    });

    const response = await POST(req, { params: {} });
    const { status, data } = await parseResponse(response);

    expect(status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.attestation).toMatchObject({
      attestationId: 'chain-att-1',
      commitmentId: 'commitment-1',
      complianceScore: 91,
      violation: false,
      feeEarned: '125',
    });
    expect(data.data.txReference).toBe('tx-123');
    expect(recordAttestationOnChain).toHaveBeenCalledWith(
      expect.objectContaining({
        commitmentId: 'commitment-1',
        attestorAddress: VALID_ADDRESS,
        complianceScore: 91,
        violation: false,
        feeEarned: '125',
        details: expect.objectContaining({
          type: 'fee_generation',
          asset: 'XLM',
          complianceScore: 91,
        }),
      })
    );
  });

  it('rejects an unknown attestation type', async () => {
    const req = createMockRequest('http://localhost:3000/api/attestations', {
      method: 'POST',
      body: {
        commitmentId: 'commitment-1',
        attestationType: 'unknown_type',
        data: { reason: 'bad' },
        verifiedBy: VALID_ADDRESS,
        signature: 'signed-payload',
      },
    });

    const response = await POST(req, { params: {} });
    const { status, data } = await parseResponse(response);

    expect(status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
    expect(recordAttestationOnChain).not.toHaveBeenCalled();
  });

  it('rejects schema-violating extra keys', async () => {
    const req = createMockRequest('http://localhost:3000/api/attestations', {
      method: 'POST',
      body: {
        commitmentId: 'commitment-1',
        attestationType: 'health_check',
        data: {
          complianceScore: 80,
          extraKey: 'not-allowed',
        },
        verifiedBy: VALID_ADDRESS,
        signature: 'signed-payload',
      },
    });

    const response = await POST(req, { params: {} });
    const { status, data } = await parseResponse(response);

    expect(status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
    expect(recordAttestationOnChain).not.toHaveBeenCalled();
  });

  it('rejects schema-violating oversized fields', async () => {
    const req = createMockRequest('http://localhost:3000/api/attestations', {
      method: 'POST',
      body: {
        commitmentId: 'commitment-1',
        attestationType: 'violation',
        data: {
          reason: 'x'.repeat(MAX_STRING_LENGTH + 1),
        },
        verifiedBy: VALID_ADDRESS,
        signature: 'signed-payload',
      },
    });

    const response = await POST(req, { params: {} });
    const { status, data } = await parseResponse(response);

    expect(status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
    expect(recordAttestationOnChain).not.toHaveBeenCalled();
  });

  it('rejects attestation data exceeding MAX_PAYLOAD_BYTES', async () => {
    const req = createMockRequest('http://localhost:3000/api/attestations', {
      method: 'POST',
      body: {
        commitmentId: 'commitment-1',
        attestationType: 'violation',
        data: {
          reason: 'x'.repeat(MAX_PAYLOAD_BYTES + 1),
        },
        verifiedBy: VALID_ADDRESS,
        signature: 'signed-payload',
      },
    });

    const response = await POST(req, { params: {} });
    const { status, data } = await parseResponse(response);

    expect(status).toBe(413);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(recordAttestationOnChain).not.toHaveBeenCalled();
  });
});
