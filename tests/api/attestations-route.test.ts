import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '@/app/api/attestations/route';
import { MAX_PAYLOAD_BYTES, MAX_STRING_LENGTH } from '@/lib/backend/attestationSchemas';
import type { Attestation } from '@/lib/types/domain';
import { createMockRequest, parseResponse } from './helpers';
import { getMockData } from '@/lib/backend/mockDb';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { getClientIp } from '@/lib/backend/getClientIp';
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

vi.mock('@/lib/backend/getClientIp', () => ({
  getClientIp: vi.fn().mockReturnValue('203.0.113.10'),
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

// ─── Rate limiting — per-IP buckets (issue #1391) ─────────────────────────────
//
// Previously the GET and POST handlers passed the literal string "anonymous"
// as the rate-limit identifier. This collapsed every client into a single
// shared bucket: one abusive client could exhaust the quota for everyone.
// These tests verify the route now derives the key from getClientIp(req), so
// different clients get independent buckets.

describe('rate limiting — per-IP buckets (issue #1391)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkRateLimit).mockResolvedValue(true);
    vi.mocked(getMockData).mockResolvedValue({
      commitments: [],
      attestations: [],
      listings: [],
    });
    vi.mocked(getCommitmentFromChain).mockResolvedValue({
      id: 'commitment-1',
      ownerAddress: VALID_ADDRESS,
      status: 'Active',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  });


  it('GET keys the rate-limit bucket on the client IP, not a shared "anonymous" key', async () => {
    vi.mocked(getClientIp).mockReturnValue('198.51.100.10');

    const req = createMockRequest('http://localhost:3000/api/attestations');
    await GET(req, { params: {} });

    // The bucket identifier must come from the request, not the bug string.
    expect(checkRateLimit).toHaveBeenCalledWith(
      '198.51.100.10',
      'api/attestations'
    );
    expect(checkRateLimit).not.toHaveBeenCalledWith(
      'anonymous',
      expect.anything()
    );
  });

  it('POST keys the rate-limit bucket on the client IP, not a shared "anonymous" key', async () => {
    vi.mocked(getClientIp).mockReturnValue('198.51.100.20');

    const req = createMockRequest('http://localhost:3000/api/attestations', {
      method: 'POST',
      body: {
        commitmentId: 'commitment-1',
        attestationType: 'fee_generation',
        data: { feeEarned: '125', asset: 'XLM', complianceScore: 91 },
        verifiedBy: VALID_ADDRESS,
        signature: 'signed-payload',
      },
    });
    await POST(req, { params: {} });

    expect(checkRateLimit).toHaveBeenCalledWith(
      '198.51.100.20',
      'api/attestations'
    );
    expect(checkRateLimit).not.toHaveBeenCalledWith(
      'anonymous',
      expect.anything()
    );
  });

  it('GET: two requests from different IPs get independent rate-limit buckets', async () => {
    // IP-A makes 3 requests
    vi.mocked(getClientIp).mockReturnValue('198.51.100.30');
    for (let i = 0; i < 3; i++) {
      const req = createMockRequest('http://localhost:3000/api/attestations');
      await GET(req, { params: {} });
    }

    // IP-B makes 1 request — it must land in its own bucket
    vi.mocked(getClientIp).mockReturnValue('198.51.100.40');
    const reqB = createMockRequest('http://localhost:3000/api/attestations');
    await GET(reqB, { params: {} });

    const callKeys = vi
      .mocked(checkRateLimit)
      .mock.calls.map(([key]) => key);
    const ipACalls = callKeys.filter((key) => key === '198.51.100.30');
    const ipBCalls = callKeys.filter((key) => key === '198.51.100.40');

    expect(ipACalls).toHaveLength(3);
    expect(ipBCalls).toHaveLength(1);
    // No call may use the buggy shared-bucket literal "anonymous" any more.
    expect(callKeys).not.toContain('anonymous');
  });

  it('GET: when IP-A is rate-limited, IP-B still succeeds (independent buckets)', async () => {
    // Only IP-A is blocked; IP-B has its own fresh bucket.
    vi.mocked(checkRateLimit).mockImplementation(async (key) =>
      key !== '198.51.100.50'
    );
    vi.mocked(getMockData).mockResolvedValue({
      commitments: [],
      attestations: ATTESTATIONS,
      listings: [],
    });

    vi.mocked(getClientIp).mockReturnValue('198.51.100.50');
    const reqA = createMockRequest('http://localhost:3000/api/attestations');
    const resA = await GET(reqA, { params: {} });

    vi.mocked(getClientIp).mockReturnValue('198.51.100.60');
    const reqB = createMockRequest('http://localhost:3000/api/attestations');
    const resB = await GET(reqB, { params: {} });

    expect(resA.status).toBe(429);
    expect(resB.status).toBe(200);
  });

  it('POST: when IP-A is rate-limited, IP-B still gets through (independent buckets)', async () => {
    vi.mocked(checkRateLimit).mockImplementation(async (key) =>
      key !== '198.51.100.70'
    );

    vi.mocked(getClientIp).mockReturnValue('198.51.100.70');
    const blockedReq = createMockRequest(
      'http://localhost:3000/api/attestations',
      {
        method: 'POST',
        body: {
          commitmentId: 'commitment-1',
          attestationType: 'fee_generation',
          data: { feeEarned: '125', asset: 'XLM', complianceScore: 91 },
          verifiedBy: VALID_ADDRESS,
          signature: 'signed-payload',
        },
      }
    );
    const blockedRes = await POST(blockedReq, { params: {} });

    vi.mocked(getClientIp).mockReturnValue('198.51.100.80');
    const allowedReq = createMockRequest(
      'http://localhost:3000/api/attestations',
      {
        method: 'POST',
        body: {
          commitmentId: 'commitment-1',
          attestationType: 'fee_generation',
          data: { feeEarned: '125', asset: 'XLM', complianceScore: 91 },
          verifiedBy: VALID_ADDRESS,
          signature: 'signed-payload',
        },
      }
    );
    const allowedRes = await POST(allowedReq, { params: {} });

    expect(blockedRes.status).toBe(429);
    expect(allowedRes.status).toBe(201);
  });
});
