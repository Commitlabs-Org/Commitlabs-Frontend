import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockRequest, parseResponse } from './helpers';

// ---------------------------------------------------------------------------
// Shared mock data
// ---------------------------------------------------------------------------

const MOCK_COMMITMENT = {
  id: 'CMT-001',
  ownerAddress: 'GOWNER123',
  asset: 'XLM',
  amount: '10000',
  status: 'ACTIVE',
  currentValue: '10500',
  createdAt: '2026-01-10T00:00:00.000Z',
  expiresAt: '2026-06-10T00:00:00.000Z',
  rules: null,
  drawdownPercent: null,
  tokenId: null,
};

/**
 * Protocol constants used for known-input calculations.
 * amount = "10000", platformFeePercent = 1, networkBaseFeeStroops = 100
 *
 * Expected feeBreakdown:
 *   platformFeeAmount = "100"       (Math.trunc(10000 * 1 / 100))
 *   networkFeeAmount  = "0.0000100" ((100 / 10_000_000).toFixed(7))
 *   totalFeeAmount    = "100.00001" (100 + 0.0000100)
 */
const MOCK_PROTOCOL_CONSTANTS = {
  protocolVersion: 'v1',
  network: 'Test SDF Network ; September 2015',
  fees: {
    platformFeePercent: 1,
    networkBaseFeeStroops: 100,
  },
  penalties: [],
  commitmentLimits: {
    minAmountXlm: 10,
    maxAmountXlm: 1_000_000,
    minDurationDays: 1,
    maxDurationDays: 365,
    maxLossPercentCeiling: 100,
  },
  cachedAt: '2026-01-10T00:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockDeps(
  commitment: typeof MOCK_COMMITMENT | null,
  protocolConstantsOverride?: (() => unknown) | 'throw',
) {
  // Mock contracts service — create BackendError lazily inside the factory so
  // it uses the same module instance as the route (vi.resetModules() clears the
  // registry, so a top-level import would be a different class instance).
  vi.doMock('@/lib/backend/services/contracts', async () => {
    const { BackendError } = await import('@/lib/backend/errors');
    return {
      getCommitmentFromChain:
        commitment !== null
          ? vi.fn().mockResolvedValue(commitment)
          : vi.fn().mockRejectedValue(
              new BackendError({
                code: 'NOT_FOUND',
                message: 'Commitment not found.',
                status: 404,
              }),
            ),
    };
  });

  // Mock protocolConstants service
  if (protocolConstantsOverride === 'throw') {
    vi.doMock('@/lib/backend/services/protocolConstants', () => ({
      getProtocolConstants: vi.fn().mockImplementation(() => {
        throw new Error('Protocol constants unavailable');
      }),
    }));
  } else if (typeof protocolConstantsOverride === 'function') {
    vi.doMock('@/lib/backend/services/protocolConstants', () => ({
      getProtocolConstants: vi.fn().mockImplementation(protocolConstantsOverride),
    }));
  } else {
    vi.doMock('@/lib/backend/services/protocolConstants', () => ({
      getProtocolConstants: vi.fn().mockReturnValue(MOCK_PROTOCOL_CONSTANTS),
    }));
  }
}

function makeRequest(id: string) {
  return createMockRequest(`http://localhost:3000/api/commitments/${id}`);
}

async function callRoute(id: string) {
  const { GET } = await import('@/app/api/commitments/[id]/route');
  const req = makeRequest(id);
  const res = await GET(req, { params: { id } });
  return parseResponse(res);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/commitments/[id]', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it('returns 200 with feeBreakdown for a valid commitment (Req 4.6)', async () => {
    mockDeps(MOCK_COMMITMENT);
    const result = await callRoute('CMT-001');

    expect(result.status).toBe(200);
    expect(result.data.success).toBe(true);

    const { feeBreakdown } = result.data.data;
    expect(feeBreakdown).toBeDefined();

    // Shape: creationFee
    expect(feeBreakdown.creationFee).toMatchObject({
      platformFeeAmount: expect.any(String),
      networkFeeAmount: expect.any(String),
      totalFeeAmount: expect.any(String),
    });

    // Shape: settlementFee
    expect(feeBreakdown.settlementFee).toMatchObject({
      platformFeeAmount: expect.any(String),
      networkFeeAmount: expect.any(String),
      totalFeeAmount: expect.any(String),
    });

    // Shape: rateSnapshot
    expect(feeBreakdown.rateSnapshot).toBeDefined();
    expect(typeof feeBreakdown.rateSnapshot.platformFeePercent).toBe('number');
    expect(typeof feeBreakdown.rateSnapshot.networkBaseFeeStroops).toBe('number');
  });

  it('feeBreakdown values match expected calculation for known inputs (Req 4.6)', async () => {
    // amount = "10000", platformFeePercent = 1, networkBaseFeeStroops = 100
    mockDeps(MOCK_COMMITMENT);
    const result = await callRoute('CMT-001');

    expect(result.status).toBe(200);
    const { feeBreakdown } = result.data.data;

    // platformFeeAmount = Math.trunc(10000 * 1 / 100) = "100"
    expect(feeBreakdown.creationFee.platformFeeAmount).toBe('100');
    // networkFeeAmount = (100 / 10_000_000).toFixed(7) = "0.0000100"
    expect(feeBreakdown.creationFee.networkFeeAmount).toBe('0.0000100');
    // totalFeeAmount = String(100 + 0.0000100) = "100.00001"
    expect(feeBreakdown.creationFee.totalFeeAmount).toBe('100.00001');

    // settlementFee uses the same formula
    expect(feeBreakdown.settlementFee.platformFeeAmount).toBe('100');
    expect(feeBreakdown.settlementFee.networkFeeAmount).toBe('0.0000100');
    expect(feeBreakdown.settlementFee.totalFeeAmount).toBe('100.00001');

    // rateSnapshot echoes the constants
    expect(feeBreakdown.rateSnapshot.platformFeePercent).toBe(1);
    expect(feeBreakdown.rateSnapshot.networkBaseFeeStroops).toBe(100);
  });

  it('rateSnapshot fields are numbers, not strings (Req 2.7)', async () => {
    mockDeps(MOCK_COMMITMENT);
    const result = await callRoute('CMT-001');

    const { rateSnapshot } = result.data.data.feeBreakdown;
    expect(typeof rateSnapshot.platformFeePercent).toBe('number');
    expect(typeof rateSnapshot.networkBaseFeeStroops).toBe('number');
  });

  it('all existing fields are present alongside feeBreakdown (Req 4.8)', async () => {
    mockDeps(MOCK_COMMITMENT);
    const result = await callRoute('CMT-001');

    expect(result.status).toBe(200);
    const data = result.data.data;

    // Existing fields must still be present
    expect(data).toHaveProperty('commitmentId', 'CMT-001');
    expect(data).toHaveProperty('owner', 'GOWNER123');
    expect(data).toHaveProperty('amount', '10000');
    expect(data).toHaveProperty('asset', 'XLM');
    expect(data).toHaveProperty('status', 'ACTIVE');
    expect(data).toHaveProperty('daysRemaining');
    expect(data).toHaveProperty('createdAt', '2026-01-10T00:00:00.000Z');

    // New field also present
    expect(data).toHaveProperty('feeBreakdown');
  });

  // ── Error paths ───────────────────────────────────────────────────────────

  it('returns HTTP 500 when getProtocolConstants() throws (Req 4.7)', async () => {
    mockDeps(MOCK_COMMITMENT, 'throw');
    const result = await callRoute('CMT-001');

    expect(result.status).toBe(500);
    // No partial feeBreakdown in the response
    expect(result.data.success).toBe(false);
    expect(result.data?.data?.feeBreakdown).toBeUndefined();
  });

  it('returns 404 when getCommitmentFromChain throws NOT_FOUND BackendError', async () => {
    mockDeps(null);
    const result = await callRoute('CMT-MISSING');

    expect(result.status).toBe(404);
    expect(result.data.success).toBe(false);
    expect(result.data.error.code).toBe('NOT_FOUND');
  });

  it('getProtocolConstants() is never called when commitment is not found (Req 2.9)', async () => {
    // Set up a spy to track whether getProtocolConstants was called
    const getProtocolConstantsMock = vi.fn().mockReturnValue(MOCK_PROTOCOL_CONSTANTS);

    vi.doMock('@/lib/backend/services/contracts', async () => {
      const { BackendError } = await import('@/lib/backend/errors');
      return {
        getCommitmentFromChain: vi.fn().mockRejectedValue(
          new BackendError({
            code: 'NOT_FOUND',
            message: 'Commitment not found.',
            status: 404,
          }),
        ),
      };
    });

    vi.doMock('@/lib/backend/services/protocolConstants', () => ({
      getProtocolConstants: getProtocolConstantsMock,
    }));

    const result = await callRoute('CMT-MISSING');

    expect(result.status).toBe(404);
    // getProtocolConstants must NOT have been called on the 404 path
    expect(getProtocolConstantsMock).not.toHaveBeenCalled();
  });

  it('returns 502 when getCommitmentFromChain throws a non-NOT_FOUND error', async () => {
    // This covers the normalizeBackendError path (lines 40-46 in route.ts)
    vi.doMock('@/lib/backend/services/contracts', () => ({
      getCommitmentFromChain: vi.fn().mockRejectedValue(
        new Error('Network timeout'),
      ),
    }));
    vi.doMock('@/lib/backend/services/protocolConstants', () => ({
      getProtocolConstants: vi.fn().mockReturnValue(MOCK_PROTOCOL_CONSTANTS),
    }));

    const result = await callRoute('CMT-001');

    expect(result.status).toBe(502);
    // The 502 path returns { error: { code, message } } directly (not wrapped in success/data)
    expect(result.data.error.code).toBe('BLOCKCHAIN_CALL_FAILED');
  });

  it('returns 404 when getCommitmentFromChain returns a commitment with no id or commitmentId', async () => {
    // This covers the null-check guard on line 50 in route.ts
    vi.doMock('@/lib/backend/services/contracts', () => ({
      getCommitmentFromChain: vi.fn().mockResolvedValue({ amount: '1000', status: 'ACTIVE' }),
    }));
    vi.doMock('@/lib/backend/services/protocolConstants', () => ({
      getProtocolConstants: vi.fn().mockReturnValue(MOCK_PROTOCOL_CONSTANTS),
    }));

    const result = await callRoute('CMT-NOID');

    expect(result.status).toBe(404);
    expect(result.data.success).toBe(false);
    expect(result.data.error.code).toBe('NOT_FOUND');
  });

  it('handles commitment with no expiresAt — daysRemaining is null', async () => {
    // Covers the getDaysRemaining(!expiresAt) branch
    const commitmentNoExpiry = { ...MOCK_COMMITMENT, expiresAt: undefined };
    mockDeps(commitmentNoExpiry as any);
    const result = await callRoute('CMT-001');

    expect(result.status).toBe(200);
    expect(result.data.data.daysRemaining).toBeNull();
  });

  it('handles commitment with invalid expiresAt date — daysRemaining is null', async () => {
    // Covers the getDaysRemaining(Number.isNaN) branch
    const commitmentBadDate = { ...MOCK_COMMITMENT, expiresAt: 'not-a-date' };
    mockDeps(commitmentBadDate as any);
    const result = await callRoute('CMT-001');

    expect(result.status).toBe(200);
    expect(result.data.data.daysRemaining).toBeNull();
  });

  it('handles commitment with bigint amount and currentValue', async () => {
    // Covers the typeof bigint branches for amount and currentValue (lines 54, 59-60)
    vi.doMock('@/lib/backend/services/contracts', () => ({
      getCommitmentFromChain: vi.fn().mockResolvedValue({
        ...MOCK_COMMITMENT,
        amount: BigInt(10000),
        currentValue: BigInt(10500),
      }),
    }));
    vi.doMock('@/lib/backend/services/protocolConstants', () => ({
      getProtocolConstants: vi.fn().mockReturnValue(MOCK_PROTOCOL_CONSTANTS),
    }));

    const result = await callRoute('CMT-001');

    expect(result.status).toBe(200);
    expect(result.data.data.amount).toBe('10000');
    expect(result.data.data.currentValue).toBe('10500');
  });

  it('includes tokenId when commitment has a tokenId', async () => {
    // Covers the tokenId ?? null non-null branch (line 75)
    vi.doMock('@/lib/backend/services/contracts', () => ({
      getCommitmentFromChain: vi.fn().mockResolvedValue({
        ...MOCK_COMMITMENT,
        tokenId: 'TOKEN-42',
      }),
    }));
    vi.doMock('@/lib/backend/services/protocolConstants', () => ({
      getProtocolConstants: vi.fn().mockReturnValue(MOCK_PROTOCOL_CONSTANTS),
    }));

    const result = await callRoute('CMT-001');

    expect(result.status).toBe(200);
    expect(result.data.data.tokenId).toBe('TOKEN-42');
  });

  it('includes nftMetadataLink when commitmentNFT contract address is configured', async () => {
    // Covers the truthy branch of getNftMetadataLink (line 20 in route.ts)
    vi.doMock('@/utils/soroban', () => ({
      contractAddresses: {
        commitmentNFT: 'CONTRACT_ADDRESS_123',
      },
    }));
    vi.doMock('@/lib/backend/services/contracts', () => ({
      getCommitmentFromChain: vi.fn().mockResolvedValue(MOCK_COMMITMENT),
    }));
    vi.doMock('@/lib/backend/services/protocolConstants', () => ({
      getProtocolConstants: vi.fn().mockReturnValue(MOCK_PROTOCOL_CONSTANTS),
    }));

    const result = await callRoute('CMT-001');

    expect(result.status).toBe(200);
    expect(result.data.data.nftMetadataLink).toBe('CONTRACT_ADDRESS_123/metadata/CMT-001');
  });

  it('uses commitmentId field when id is absent', async () => {
    // Covers the commitment.id ?? commitment.commitmentId fallback branch
    vi.doMock('@/lib/backend/services/contracts', () => ({
      getCommitmentFromChain: vi.fn().mockResolvedValue({
        ...MOCK_COMMITMENT,
        id: undefined,
        commitmentId: 'CMT-FALLBACK',
      }),
    }));
    vi.doMock('@/lib/backend/services/protocolConstants', () => ({
      getProtocolConstants: vi.fn().mockReturnValue(MOCK_PROTOCOL_CONSTANTS),
    }));

    const result = await callRoute('CMT-FALLBACK');

    expect(result.status).toBe(200);
    expect(result.data.data.commitmentId).toBe('CMT-FALLBACK');
  });

  it('uses owner field when ownerAddress is absent', async () => {
    // Covers the commitment.ownerAddress ?? commitment.owner fallback branch
    vi.doMock('@/lib/backend/services/contracts', () => ({
      getCommitmentFromChain: vi.fn().mockResolvedValue({
        ...MOCK_COMMITMENT,
        ownerAddress: undefined,
        owner: 'GOWNER_FALLBACK',
      }),
    }));
    vi.doMock('@/lib/backend/services/protocolConstants', () => ({
      getProtocolConstants: vi.fn().mockReturnValue(MOCK_PROTOCOL_CONSTANTS),
    }));

    const result = await callRoute('CMT-001');

    expect(result.status).toBe(200);
    expect(result.data.data.owner).toBe('GOWNER_FALLBACK');
  });
});
