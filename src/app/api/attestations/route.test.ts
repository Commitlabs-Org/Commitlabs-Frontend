
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from './route';
import { NextRequest } from 'next/server';
import * as contracts from '@/lib/backend/services/contracts';
import * as mockDb from '@/lib/backend/mockDb';
import * as rateLimit from '@/lib/backend/rateLimit';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/backend/services/contracts', () => ({
  getCommitmentFromChain: vi.fn(),
  recordAttestationOnChain: vi.fn(),
}));

vi.mock('@/lib/backend/mockDb', () => ({
  getMockData: vi.fn(),
}));

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn(),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: unknown, method = 'POST'): NextRequest {
  return new NextRequest('http://localhost:3000/api/attestations', {
    method,
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeGetRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/attestations', {
    method: 'GET',
  });
}

const MOCK_ATTESTATION_RESULT = {
  attestationId: 'ATT-001',
  commitmentId: 'CMT-ABC123',
  complianceScore: 85,
  violation: false,
  feeEarned: '0',
  recordedAt: '2026-01-11T12:00:00Z',
  txHash: '0xdeadbeef',
};

const MOCK_DB_ATTESTATIONS = [
  {
    id: 'ATTR-001',
    commitmentId: 'CMT-ABC123',
    provider: 'Provider A',
    status: 'Valid',
    timestamp: '2026-01-11T12:00:00Z',
  },
];

// ─── GET /api/attestations ────────────────────────────────────────────────────

describe('GET /api/attestations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rateLimit.checkRateLimit).mockResolvedValue(true);
    vi.mocked(mockDb.getMockData).mockResolvedValue({
      commitments: [],
      attestations: MOCK_DB_ATTESTATIONS,
      listings: [],
    });
  });

  it('returns 200 with attestations from mockDb', async () => {
    const req = makeGetRequest();
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.attestations).toEqual(MOCK_DB_ATTESTATIONS);
  });

  it('returns empty array when mockDb has no attestations', async () => {
    vi.mocked(mockDb.getMockData).mockResolvedValue({
      commitments: [],
      attestations: [],
      listings: [],
    });

    const req = makeGetRequest();
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.attestations).toEqual([]);
  });

  it('returns 429 when rate limit is exceeded', async () => {
    vi.mocked(rateLimit.checkRateLimit).mockResolvedValue(false);

    const req = makeGetRequest();
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('TOO_MANY_REQUESTS');
  });
});

// ─── POST /api/attestations — happy paths ─────────────────────────────────────

describe('POST /api/attestations — happy paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rateLimit.checkRateLimit).mockResolvedValue(true);
    vi.mocked(contracts.getCommitmentFromChain).mockResolvedValue({
      id: 'CMT-ABC123',
      ownerAddress: 'GABC',
      asset: 'XLM',
      amount: '50000',
      status: 'ACTIVE',
      complianceScore: 95,
      currentValue: '52000',
      feeEarned: '0',
      violationCount: 0,
    });
    vi.mocked(contracts.recordAttestationOnChain).mockResolvedValue(MOCK_ATTESTATION_RESULT);
  });

  it('records a health_check attestation and returns 201', async () => {
    const req = makeRequest({
      commitmentId: 'CMT-ABC123',
      attestationType: 'health_check',
      data: { complianceScore: 85, violation: false },
      verifiedBy: 'GVERIFIER',
    });

    const res = await POST(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.attestation.attestationId).toBe('ATT-001');
    expect(body.data.txReference).toBe('0xdeadbeef');

    expect(contracts.recordAttestationOnChain).toHaveBeenCalledWith(
      expect.objectContaining({
        commitmentId: 'CMT-ABC123',
        attestorAddress: 'GVERIFIER',
        complianceScore: 85,
        violation: false,
      })
    );
  });

  it('records a violation attestation — sets violation=true regardless of data', async () => {
    const req = makeRequest({
      commitmentId: 'CMT-ABC123',
      attestationType: 'violation',
      data: { complianceScore: 40 },
      verifiedBy: 'GVERIFIER',
    });

    const res = await POST(req, { params: {} });
    expect(res.status).toBe(201);

    expect(contracts.recordAttestationOnChain).toHaveBeenCalledWith(
      expect.objectContaining({ violation: true, complianceScore: 40 })
    );
  });

  it('records a violation attestation — defaults complianceScore to 0 when missing', async () => {
    const req = makeRequest({
      commitmentId: 'CMT-ABC123',
      attestationType: 'violation',
      data: {},
      verifiedBy: 'GVERIFIER',
    });

    const res = await POST(req, { params: {} });
    expect(res.status).toBe(201);

    expect(contracts.recordAttestationOnChain).toHaveBeenCalledWith(
      expect.objectContaining({ violation: true, complianceScore: 0 })
    );
  });

  it('records a fee_generation attestation using feeEarned field', async () => {
    const req = makeRequest({
      commitmentId: 'CMT-ABC123',
      attestationType: 'fee_generation',
      data: { feeEarned: '250.50', complianceScore: 90 },
      verifiedBy: 'GVERIFIER',
    });

    const res = await POST(req, { params: {} });
    expect(res.status).toBe(201);

    expect(contracts.recordAttestationOnChain).toHaveBeenCalledWith(
      expect.objectContaining({ feeEarned: '250.50', complianceScore: 90 })
    );
  });

  it('records a fee_generation attestation using amount as fallback for feeEarned', async () => {
    const req = makeRequest({
      commitmentId: 'CMT-ABC123',
      attestationType: 'fee_generation',
      data: { amount: 100 },
      verifiedBy: 'GVERIFIER',
    });

    const res = await POST(req, { params: {} });
    expect(res.status).toBe(201);

    expect(contracts.recordAttestationOnChain).toHaveBeenCalledWith(
      expect.objectContaining({ feeEarned: '100' })
    );
  });

  it('records a fee_generation attestation with numeric feeEarned converted to string', async () => {
    const req = makeRequest({
      commitmentId: 'CMT-ABC123',
      attestationType: 'fee_generation',
      data: { feeEarned: 500 },
      verifiedBy: 'GVERIFIER',
    });

    const res = await POST(req, { params: {} });
    expect(res.status).toBe(201);

    expect(contracts.recordAttestationOnChain).toHaveBeenCalledWith(
      expect.objectContaining({ feeEarned: '500' })
    );
  });

  it('records a drawdown attestation with optional feeEarned', async () => {
    const req = makeRequest({
      commitmentId: 'CMT-ABC123',
      attestationType: 'drawdown',
      data: { complianceScore: 70, violation: true, feeEarned: '10' },
      verifiedBy: 'GVERIFIER',
    });

    const res = await POST(req, { params: {} });
    expect(res.status).toBe(201);

    expect(contracts.recordAttestationOnChain).toHaveBeenCalledWith(
      expect.objectContaining({
        complianceScore: 70,
        violation: true,
        feeEarned: '10',
      })
    );
  });

  it('records a drawdown attestation without feeEarned', async () => {
    const req = makeRequest({
      commitmentId: 'CMT-ABC123',
      attestationType: 'drawdown',
      data: { complianceScore: 60 },
      verifiedBy: 'GVERIFIER',
    });

    const res = await POST(req, { params: {} });
    expect(res.status).toBe(201);

    expect(contracts.recordAttestationOnChain).toHaveBeenCalledWith(
      expect.objectContaining({ feeEarned: undefined })
    );
  });

  it('returns null txReference when txHash is absent', async () => {
    vi.mocked(contracts.recordAttestationOnChain).mockResolvedValue({
      ...MOCK_ATTESTATION_RESULT,
      txHash: undefined,
    });

    const req = makeRequest({
      commitmentId: 'CMT-ABC123',
      attestationType: 'health_check',
      data: { complianceScore: 50 },
      verifiedBy: 'GVERIFIER',
    });

    const res = await POST(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.txReference).toBeNull();
  });
});

// ─── POST /api/attestations — validation errors ───────────────────────────────

describe('POST /api/attestations — validation errors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rateLimit.checkRateLimit).mockResolvedValue(true);
  });

  it('returns 400 when body is not a JSON object', async () => {
    const req = new NextRequest('http://localhost:3000/api/attestations', {
      method: 'POST',
      body: '"just a string"',
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when body is malformed JSON', async () => {
    const req = new NextRequest('http://localhost:3000/api/attestations', {
      method: 'POST',
      body: '{not valid json',
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when commitmentId is missing', async () => {
    const req = makeRequest({
      attestationType: 'health_check',
      data: { complianceScore: 80 },
      verifiedBy: 'GVERIFIER',
    });

    const res = await POST(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toMatch(/commitmentId/);
  });

  it('returns 400 when commitmentId is an empty string', async () => {
    const req = makeRequest({
      commitmentId: '   ',
      attestationType: 'health_check',
      data: { complianceScore: 80 },
      verifiedBy: 'GVERIFIER',
    });

    const res = await POST(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when attestationType is missing', async () => {
    const req = makeRequest({
      commitmentId: 'CMT-ABC123',
      data: { complianceScore: 80 },
      verifiedBy: 'GVERIFIER',
    });

    const res = await POST(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toMatch(/attestationType/);
  });

  it('returns 400 when attestationType is an invalid value', async () => {
    const req = makeRequest({
      commitmentId: 'CMT-ABC123',
      attestationType: 'invalid_type',
      data: { complianceScore: 80 },
      verifiedBy: 'GVERIFIER',
    });

    const res = await POST(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toMatch(/attestationType/);
    expect(body.error.details).toMatchObject({
      allowed: ['health_check', 'violation', 'fee_generation', 'drawdown'],
    });
  });

  it('returns 400 when data field is missing', async () => {
    const req = makeRequest({
      commitmentId: 'CMT-ABC123',
      attestationType: 'health_check',
      verifiedBy: 'GVERIFIER',
    });

    const res = await POST(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toMatch(/data/);
  });

  it('returns 400 when data is not an object (array)', async () => {
    const req = makeRequest({
      commitmentId: 'CMT-ABC123',
      attestationType: 'health_check',
      data: [1, 2, 3],
      verifiedBy: 'GVERIFIER',
    });

    const res = await POST(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when verifiedBy is missing', async () => {
    const req = makeRequest({
      commitmentId: 'CMT-ABC123',
      attestationType: 'health_check',
      data: { complianceScore: 80 },
    });

    const res = await POST(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toMatch(/verifiedBy/);
  });

  it('returns 400 when verifiedBy is an empty string', async () => {
    const req = makeRequest({
      commitmentId: 'CMT-ABC123',
      attestationType: 'health_check',
      data: { complianceScore: 80 },
      verifiedBy: '',
    });

    const res = await POST(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ─── POST /api/attestations — health_check score bounds ──────────────────────

describe('POST /api/attestations — health_check complianceScore bounds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rateLimit.checkRateLimit).mockResolvedValue(true);
  });

  it('returns 400 when complianceScore is missing for health_check', async () => {
    const req = makeRequest({
      commitmentId: 'CMT-ABC123',
      attestationType: 'health_check',
      data: {},
      verifiedBy: 'GVERIFIER',
    });

    const res = await POST(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.message).toMatch(/complianceScore/);
    expect(body.error.message).toMatch(/required/);
  });

  it('returns 400 when complianceScore is below 0', async () => {
    const req = makeRequest({
      commitmentId: 'CMT-ABC123',
      attestationType: 'health_check',
      data: { complianceScore: -1 },
      verifiedBy: 'GVERIFIER',
    });

    const res = await POST(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.message).toMatch(/0 and 100/);
  });

  it('returns 400 when complianceScore is above 100', async () => {
    const req = makeRequest({
      commitmentId: 'CMT-ABC123',
      attestationType: 'health_check',
      data: { complianceScore: 101 },
      verifiedBy: 'GVERIFIER',
    });

    const res = await POST(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.message).toMatch(/0 and 100/);
  });

  it('returns 400 when complianceScore is NaN', async () => {
    const req = makeRequest({
      commitmentId: 'CMT-ABC123',
      attestationType: 'health_check',
      data: { complianceScore: 'not-a-number' },
      verifiedBy: 'GVERIFIER',
    });

    const res = await POST(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.message).toMatch(/0 and 100/);
  });

  it('accepts complianceScore at boundary value 0', async () => {
    vi.mocked(contracts.getCommitmentFromChain).mockResolvedValue({
      id: 'CMT-ABC123',
      ownerAddress: 'GABC',
      asset: 'XLM',
      amount: '50000',
      status: 'ACTIVE',
      complianceScore: 0,
      currentValue: '50000',
      feeEarned: '0',
      violationCount: 0,
    });
    vi.mocked(contracts.recordAttestationOnChain).mockResolvedValue(MOCK_ATTESTATION_RESULT);

    const req = makeRequest({
      commitmentId: 'CMT-ABC123',
      attestationType: 'health_check',
      data: { complianceScore: 0 },
      verifiedBy: 'GVERIFIER',
    });

    const res = await POST(req, { params: {} });
    expect(res.status).toBe(201);
  });

  it('accepts complianceScore at boundary value 100', async () => {
    vi.mocked(contracts.getCommitmentFromChain).mockResolvedValue({
      id: 'CMT-ABC123',
      ownerAddress: 'GABC',
      asset: 'XLM',
      amount: '50000',
      status: 'ACTIVE',
      complianceScore: 100,
      currentValue: '52000',
      feeEarned: '0',
      violationCount: 0,
    });
    vi.mocked(contracts.recordAttestationOnChain).mockResolvedValue(MOCK_ATTESTATION_RESULT);

    const req = makeRequest({
      commitmentId: 'CMT-ABC123',
      attestationType: 'health_check',
      data: { complianceScore: 100 },
      verifiedBy: 'GVERIFIER',
    });

    const res = await POST(req, { params: {} });
    expect(res.status).toBe(201);
  });
});

// ─── POST /api/attestations — fee_generation requirements ────────────────────

describe('POST /api/attestations — fee_generation requirements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rateLimit.checkRateLimit).mockResolvedValue(true);
  });

  it('returns 400 when both feeEarned and amount are missing', async () => {
    const req = makeRequest({
      commitmentId: 'CMT-ABC123',
      attestationType: 'fee_generation',
      data: { complianceScore: 90 },
      verifiedBy: 'GVERIFIER',
    });

    const res = await POST(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toMatch(/feeEarned/);
    expect(body.error.message).toMatch(/amount/);
  });

  it('returns 400 when feeEarned is explicitly null', async () => {
    const req = makeRequest({
      commitmentId: 'CMT-ABC123',
      attestationType: 'fee_generation',
      data: { feeEarned: null },
      verifiedBy: 'GVERIFIER',
    });

    const res = await POST(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ─── POST /api/attestations — upstream 502 error mapping ─────────────────────

describe('POST /api/attestations — upstream 502 error mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rateLimit.checkRateLimit).mockResolvedValue(true);
  });

  it('returns 502 when getCommitmentFromChain throws a generic error', async () => {
    vi.mocked(contracts.getCommitmentFromChain).mockRejectedValue(
      new Error('RPC node unreachable')
    );

    const req = makeRequest({
      commitmentId: 'CMT-ABC123',
      attestationType: 'health_check',
      data: { complianceScore: 80 },
      verifiedBy: 'GVERIFIER',
    });

    const res = await POST(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error.code).toBe('BLOCKCHAIN_CALL_FAILED');
    expect(body.error.message).toMatch(/commitment/i);
  });

  it('returns 502 when recordAttestationOnChain throws a generic error', async () => {
    vi.mocked(contracts.getCommitmentFromChain).mockResolvedValue({
      id: 'CMT-ABC123',
      ownerAddress: 'GABC',
      asset: 'XLM',
      amount: '50000',
      status: 'ACTIVE',
      complianceScore: 95,
      currentValue: '52000',
      feeEarned: '0',
      violationCount: 0,
    });
    vi.mocked(contracts.recordAttestationOnChain).mockRejectedValue(
      new Error('Transaction simulation failed')
    );

    const req = makeRequest({
      commitmentId: 'CMT-ABC123',
      attestationType: 'health_check',
      data: { complianceScore: 80 },
      verifiedBy: 'GVERIFIER',
    });

    const res = await POST(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error.code).toBe('BLOCKCHAIN_CALL_FAILED');
    expect(body.error.message).toMatch(/record attestation/i);
  });

  it('propagates an existing BackendError from getCommitmentFromChain unchanged', async () => {
    const { BackendError } = await import('@/lib/backend/errors');
    vi.mocked(contracts.getCommitmentFromChain).mockRejectedValue(
      new BackendError({
        code: 'NOT_FOUND',
        message: 'Commitment does not exist.',
        status: 404,
      })
    );

    const req = makeRequest({
      commitmentId: 'CMT-MISSING',
      attestationType: 'health_check',
      data: { complianceScore: 80 },
      verifiedBy: 'GVERIFIER',
    });

    const res = await POST(req, { params: {} });
    const body = await res.json();

    // BackendError is re-used as-is by normalizeBackendError
    expect(res.status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('propagates an existing BackendError from recordAttestationOnChain unchanged', async () => {
    const { BackendError } = await import('@/lib/backend/errors');
    vi.mocked(contracts.getCommitmentFromChain).mockResolvedValue({
      id: 'CMT-ABC123',
      ownerAddress: 'GABC',
      asset: 'XLM',
      amount: '50000',
      status: 'ACTIVE',
      complianceScore: 95,
      currentValue: '52000',
      feeEarned: '0',
      violationCount: 0,
    });
    vi.mocked(contracts.recordAttestationOnChain).mockRejectedValue(
      new BackendError({
        code: 'BLOCKCHAIN_UNAVAILABLE',
        message: 'Soroban RPC is down.',
        status: 503,
      })
    );

    const req = makeRequest({
      commitmentId: 'CMT-ABC123',
      attestationType: 'violation',
      data: {},
      verifiedBy: 'GVERIFIER',
    });

    const res = await POST(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.error.code).toBe('BLOCKCHAIN_UNAVAILABLE');
  });

  it('returns 429 when rate limit is exceeded on POST', async () => {
    vi.mocked(rateLimit.checkRateLimit).mockResolvedValue(false);

    const req = makeRequest({
      commitmentId: 'CMT-ABC123',
      attestationType: 'health_check',
      data: { complianceScore: 80 },
      verifiedBy: 'GVERIFIER',
    });

    const res = await POST(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error.code).toBe('TOO_MANY_REQUESTS');
  });
});
