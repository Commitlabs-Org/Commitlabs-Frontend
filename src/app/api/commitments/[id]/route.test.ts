import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { NextRequest } from 'next/server';
import * as contracts from '@/lib/backend/services/contracts';
import { BackendError } from '@/lib/backend/errors';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/backend/services/contracts', () => ({
  getCommitmentFromChain: vi.fn(),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(commitmentId: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/commitments/${commitmentId}`, {
    method: 'GET',
  });
}

const MOCK_COMMITMENT: contracts.ChainCommitment = {
  id: 'CMT-001',
  ownerAddress: 'GABC123',
  asset: 'XLM',
  amount: '50000',
  status: 'ACTIVE',
  complianceScore: 95,
  currentValue: '52000',
  feeEarned: '100',
  violationCount: 0,
  createdAt: '2026-01-10T00:00:00Z',
  expiresAt: '2026-03-11T00:00:00Z',
};

// ─── GET /api/commitments/[id] — happy path ──────────────────────────────────

describe('GET /api/commitments/[id] — happy path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(contracts.getCommitmentFromChain).mockResolvedValue(MOCK_COMMITMENT);
  });

  it('returns 200 with commitment data from chain', async () => {
    const req = makeRequest('CMT-001');
    const res = await GET(req, { params: { id: 'CMT-001' } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.commitmentId).toBe('CMT-001');
    expect(body.data.owner).toBe('GABC123');
    expect(body.data.asset).toBe('XLM');
    expect(body.data.amount).toBe('50000');
    expect(body.data.currentValue).toBe('52000');
    expect(body.data.status).toBe('ACTIVE');
    expect(body.data.complianceScore).toBe(95);
    expect(body.data.feeEarned).toBe('100');
    expect(body.data.violationCount).toBe(0);
  });

  it('includes createdAt and expiresAt when present', async () => {
    const req = makeRequest('CMT-001');
    const res = await GET(req, { params: { id: 'CMT-001' } });
    const body = await res.json();

    expect(body.data.createdAt).toBe('2026-01-10T00:00:00Z');
    expect(body.data.expiresAt).toBe('2026-03-11T00:00:00Z');
  });

  it('computes daysRemaining correctly', async () => {
    // Mock Date.now() to a fixed time
    const now = new Date('2026-01-25T00:00:00Z').getTime();
    vi.spyOn(Date, 'now').mockReturnValue(now);

    const req = makeRequest('CMT-001');
    const res = await GET(req, { params: { id: 'CMT-001' } });
    const body = await res.json();

    // From 2026-01-25 to 2026-03-11 is 45 days
    expect(body.data.daysRemaining).toBe(45);

    vi.restoreAllMocks();
  });

  it('returns daysRemaining=0 when commitment has expired', async () => {
    const now = new Date('2026-03-12T00:00:00Z').getTime();
    vi.spyOn(Date, 'now').mockReturnValue(now);

    const req = makeRequest('CMT-001');
    const res = await GET(req, { params: { id: 'CMT-001' } });
    const body = await res.json();

    expect(body.data.daysRemaining).toBe(0);

    vi.restoreAllMocks();
  });

  it('returns daysRemaining=null when expiresAt is missing', async () => {
    vi.mocked(contracts.getCommitmentFromChain).mockResolvedValue({
      ...MOCK_COMMITMENT,
      expiresAt: undefined,
    });

    const req = makeRequest('CMT-001');
    const res = await GET(req, { params: { id: 'CMT-001' } });
    const body = await res.json();

    expect(body.data.daysRemaining).toBeNull();
  });

  it('returns daysRemaining=null when expiresAt is invalid', async () => {
    vi.mocked(contracts.getCommitmentFromChain).mockResolvedValue({
      ...MOCK_COMMITMENT,
      expiresAt: 'invalid-date',
    });

    const req = makeRequest('CMT-001');
    const res = await GET(req, { params: { id: 'CMT-001' } });
    const body = await res.json();

    expect(body.data.daysRemaining).toBeNull();
  });

  it('returns createdAt=null when missing from chain', async () => {
    vi.mocked(contracts.getCommitmentFromChain).mockResolvedValue({
      ...MOCK_COMMITMENT,
      createdAt: undefined,
    });

    const req = makeRequest('CMT-001');
    const res = await GET(req, { params: { id: 'CMT-001' } });
    const body = await res.json();

    expect(body.data.createdAt).toBeNull();
  });

  it('returns expiresAt=null when missing from chain', async () => {
    vi.mocked(contracts.getCommitmentFromChain).mockResolvedValue({
      ...MOCK_COMMITMENT,
      expiresAt: undefined,
    });

    const req = makeRequest('CMT-001');
    const res = await GET(req, { params: { id: 'CMT-001' } });
    const body = await res.json();

    expect(body.data.expiresAt).toBeNull();
  });

  it('returns maxLossPercent=null (not part of ChainCommitment)', async () => {
    const req = makeRequest('CMT-001');
    const res = await GET(req, { params: { id: 'CMT-001' } });
    const body = await res.json();

    expect(body.data.maxLossPercent).toBeNull();
  });

  it('returns nftMetadataLink when commitmentNFT contract is configured', async () => {
    // Mock contractAddresses.commitmentNFT
    const originalGetter = Object.getOwnPropertyDescriptor(
      require('@/utils/soroban').contractAddresses,
      'commitmentNFT'
    );
    Object.defineProperty(require('@/utils/soroban').contractAddresses, 'commitmentNFT', {
      get: () => 'CNFT123',
      configurable: true,
    });

    const req = makeRequest('CMT-001');
    const res = await GET(req, { params: { id: 'CMT-001' } });
    const body = await res.json();

    expect(body.data.nftMetadataLink).toBe('CNFT123/metadata/CMT-001');

    // Restore original getter
    if (originalGetter) {
      Object.defineProperty(
        require('@/utils/soroban').contractAddresses,
        'commitmentNFT',
        originalGetter
      );
    }
  });

  it('returns nftMetadataLink=null when commitmentNFT contract is not configured', async () => {
    const originalGetter = Object.getOwnPropertyDescriptor(
      require('@/utils/soroban').contractAddresses,
      'commitmentNFT'
    );
    Object.defineProperty(require('@/utils/soroban').contractAddresses, 'commitmentNFT', {
      get: () => '',
      configurable: true,
    });

    const req = makeRequest('CMT-001');
    const res = await GET(req, { params: { id: 'CMT-001' } });
    const body = await res.json();

    expect(body.data.nftMetadataLink).toBeNull();

    if (originalGetter) {
      Object.defineProperty(
        require('@/utils/soroban').contractAddresses,
        'commitmentNFT',
        originalGetter
      );
    }
  });
});

// ─── GET /api/commitments/[id] — 404 not found ───────────────────────────────

describe('GET /api/commitments/[id] — 404 not found', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when getCommitmentFromChain throws BackendError with NOT_FOUND code', async () => {
    vi.mocked(contracts.getCommitmentFromChain).mockRejectedValue(
      new BackendError({
        code: 'NOT_FOUND',
        message: 'Commitment does not exist on chain.',
        status: 404,
      })
    );

    const req = makeRequest('CMT-MISSING');
    const res = await GET(req, { params: { id: 'CMT-MISSING' } });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toMatch(/Commitment not found/i);
  });

  it('returns 404 when getCommitmentFromChain returns null', async () => {
    vi.mocked(contracts.getCommitmentFromChain).mockResolvedValue(null as any);

    const req = makeRequest('CMT-NULL');
    const res = await GET(req, { params: { id: 'CMT-NULL' } });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 404 when getCommitmentFromChain returns a commitment without an id', async () => {
    vi.mocked(contracts.getCommitmentFromChain).mockResolvedValue({
      ...MOCK_COMMITMENT,
      id: '',
    });

    const req = makeRequest('CMT-NO-ID');
    const res = await GET(req, { params: { id: 'CMT-NO-ID' } });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});

// ─── GET /api/commitments/[id] — 502 upstream errors ─────────────────────────

describe('GET /api/commitments/[id] — 502 upstream errors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 502 when getCommitmentFromChain throws a generic error', async () => {
    vi.mocked(contracts.getCommitmentFromChain).mockRejectedValue(
      new Error('RPC node unreachable')
    );

    const req = makeRequest('CMT-001');
    const res = await GET(req, { params: { id: 'CMT-001' } });
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error.code).toBe('BLOCKCHAIN_CALL_FAILED');
    expect(body.error.message).toMatch(/Unable to fetch commitment from chain/i);
  });

  it('returns 502 when getCommitmentFromChain throws BackendError with BLOCKCHAIN_CALL_FAILED', async () => {
    vi.mocked(contracts.getCommitmentFromChain).mockRejectedValue(
      new BackendError({
        code: 'BLOCKCHAIN_CALL_FAILED',
        message: 'Soroban simulation failed.',
        status: 502,
      })
    );

    const req = makeRequest('CMT-001');
    const res = await GET(req, { params: { id: 'CMT-001' } });
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error.code).toBe('BLOCKCHAIN_CALL_FAILED');
  });

  it('returns 502 when getCommitmentFromChain throws BackendError with BLOCKCHAIN_UNAVAILABLE', async () => {
    vi.mocked(contracts.getCommitmentFromChain).mockRejectedValue(
      new BackendError({
        code: 'BLOCKCHAIN_UNAVAILABLE',
        message: 'Soroban RPC is down.',
        status: 503,
      })
    );

    const req = makeRequest('CMT-001');
    const res = await GET(req, { params: { id: 'CMT-001' } });
    const body = await res.json();

    // normalizeBackendError preserves the original BackendError, so status is 503
    expect(res.status).toBe(503);
    expect(body.error.code).toBe('BLOCKCHAIN_UNAVAILABLE');
  });

  it('includes commitmentId in error details', async () => {
    vi.mocked(contracts.getCommitmentFromChain).mockRejectedValue(
      new Error('Network timeout')
    );

    const req = makeRequest('CMT-TIMEOUT');
    const res = await GET(req, { params: { id: 'CMT-TIMEOUT' } });
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error.details).toMatchObject({ commitmentId: 'CMT-TIMEOUT' });
  });
});

// ─── GET /api/commitments/[id] — edge cases ───────────────────────────────────

describe('GET /api/commitments/[id] — edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles commitmentId with special characters', async () => {
    vi.mocked(contracts.getCommitmentFromChain).mockResolvedValue(MOCK_COMMITMENT);

    const req = makeRequest('CMT-001%2FTEST');
    const res = await GET(req, { params: { id: 'CMT-001%2FTEST' } });

    expect(res.status).toBe(200);
    expect(contracts.getCommitmentFromChain).toHaveBeenCalledWith('CMT-001%2FTEST');
  });

  it('handles very long commitmentId', async () => {
    const longId = 'CMT-' + 'A'.repeat(200);
    vi.mocked(contracts.getCommitmentFromChain).mockResolvedValue({
      ...MOCK_COMMITMENT,
      id: longId,
    });

    const req = makeRequest(longId);
    const res = await GET(req, { params: { id: longId } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.commitmentId).toBe(longId);
  });

  it('handles commitment with all optional fields missing', async () => {
    vi.mocked(contracts.getCommitmentFromChain).mockResolvedValue({
      id: 'CMT-MINIMAL',
      ownerAddress: 'GOWNER',
      asset: 'XLM',
      amount: '1000',
      status: 'ACTIVE',
      complianceScore: 0,
      currentValue: '1000',
      feeEarned: '0',
      violationCount: 0,
      // createdAt and expiresAt are undefined
    });

    const req = makeRequest('CMT-MINIMAL');
    const res = await GET(req, { params: { id: 'CMT-MINIMAL' } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.createdAt).toBeNull();
    expect(body.data.expiresAt).toBeNull();
    expect(body.data.daysRemaining).toBeNull();
  });
});
