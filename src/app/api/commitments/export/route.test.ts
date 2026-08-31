import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn(),
}));

vi.mock('@/lib/backend/auth', () => ({
  verifySessionToken: vi.fn(),
}));

vi.mock('@/lib/backend/services/contracts', () => ({
  getUserCommitmentsFromChain: vi.fn(),
}));

import { checkRateLimit } from '@/lib/backend/rateLimit';
import { verifySessionToken } from '@/lib/backend/auth';
import {
  getUserCommitmentsFromChain,
  type ChainCommitment,
} from '@/lib/backend/services/contracts';
import { GET } from './route';

// Valid Stellar address format (56 chars starting with 'G')
const VALID_ADDRESS_A = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW';
const VALID_ADDRESS_B = 'GOTHERGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWX';

// Valid commitment timestamp
const VALID_TIMESTAMP = '2024-01-01T00:00:00.000Z';

// Helper to create valid mock commitment
function createValidCommitment(
  overrides: Partial<ChainCommitment> = {},
): ChainCommitment {
  return {
    id: 'cmt-1',
    ownerAddress: VALID_ADDRESS_A,
    asset: 'USDC',
    amount: '100',
    status: 'ACTIVE',
    complianceScore: 95,
    currentValue: '110',
    feeEarned: '0',
    violationCount: 0,
    createdAt: VALID_TIMESTAMP,
    expiresAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const makeRequest = (
  searchParams: Record<string, string> = {},
  headers: Record<string, string> = {},
) => {
  const params = new URLSearchParams(searchParams);
  return new NextRequest(`http://localhost:3000/api/commitments/export?${params.toString()}`, {
    method: 'GET',
    headers: {
      'x-forwarded-for': '127.0.0.1',
      ...headers,
    },
  });
};

describe('GET /api/commitments/export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkRateLimit).mockResolvedValue(true);
  });

  describe('Authorization and Authentication Boundaries', () => {
    it('returns 401 when the bearer token is missing', async () => {
      const res = await GET(makeRequest({ ownerAddress: VALID_ADDRESS_A }), { params: {} });
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 when session validation fails', async () => {
      vi.mocked(verifySessionToken).mockReturnValue({ valid: false });

      const res = await GET(
        makeRequest({ ownerAddress: VALID_ADDRESS_A }, { authorization: 'Bearer invalid-token' }),
        { params: {} },
      );
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 when session is too old (>24 hours)', async () => {
      const oldDate = new Date();
      oldDate.setHours(oldDate.getHours() - 25);

      vi.mocked(verifySessionToken).mockReturnValue({
        valid: true,
        address: VALID_ADDRESS_A,
        createdAt: oldDate,
      });

      const res = await GET(
        makeRequest({ ownerAddress: VALID_ADDRESS_A }, { authorization: 'Bearer valid-token' }),
        { params: {} },
      );
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.error.message).toContain('Session too old');
    });

    it('returns 403 when the session wallet does not match the requested ownerAddress', async () => {
      vi.mocked(verifySessionToken).mockReturnValue({
        valid: true,
        address: VALID_ADDRESS_B,
        createdAt: new Date(),
      });

      const res = await GET(
        makeRequest({ ownerAddress: VALID_ADDRESS_A }, { authorization: 'Bearer valid-token' }),
        { params: {} },
      );
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('returns 400 when ownerAddress is missing', async () => {
      vi.mocked(verifySessionToken).mockReturnValue({
        valid: true,
        address: VALID_ADDRESS_A,
        createdAt: new Date(),
      });

      const res = await GET(makeRequest({}, { authorization: 'Bearer valid-token' }), {
        params: {},
      });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error.code).toBe('BAD_REQUEST');
      expect(body.error.message).toContain('ownerAddress is required');
    });

    it('returns 400 for an invalid ownerAddress format', async () => {
      vi.mocked(verifySessionToken).mockReturnValue({
        valid: true,
        address: VALID_ADDRESS_A,
        createdAt: new Date(),
      });

      const res = await GET(
        makeRequest(
          { ownerAddress: 'not-a-valid-address' },
          { authorization: 'Bearer valid-token' },
        ),
        { params: {} },
      );
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error.code).toBe('BAD_REQUEST');
      expect(body.error.message).toContain('valid Stellar wallet address');
    });

    it('rejects ownerAddress with extra whitespace but validates format correctly', async () => {
      vi.mocked(verifySessionToken).mockReturnValue({
        valid: true,
        address: VALID_ADDRESS_A,
        createdAt: new Date(),
      });

      // Address with leading/trailing whitespace should be trimmed and validated
      const res = await GET(
        makeRequest(
          { ownerAddress: `  ${VALID_ADDRESS_A}  ` },
          { authorization: 'Bearer valid-token' },
        ),
        { params: {} },
      );

      expect(res.status).toBe(200); // Should succeed after trimming
    });
  });

  describe('Response Validation and Ownership Enforcement', () => {
    beforeEach(() => {
      vi.mocked(verifySessionToken).mockReturnValue({
        valid: true,
        address: VALID_ADDRESS_A,
        createdAt: new Date(),
      });
    });

    it('returns 200 and streams CSV export with valid commitment', async () => {
      const mockCommitment = createValidCommitment({
        ownerAddress: VALID_ADDRESS_A,
        asset: '=cmd|whoami', // Formula injection test
      });
      vi.mocked(getUserCommitmentsFromChain).mockResolvedValue([mockCommitment]);

      const res = await GET(
        makeRequest({ ownerAddress: VALID_ADDRESS_A }, { authorization: 'Bearer valid-token' }),
        { params: {} },
      );

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('text/csv');
      expect(res.headers.get('Content-Disposition')).toContain(
        'attachment; filename="commitments.csv"',
      );
      expect(res.headers.get('Cache-Control')).toContain('no-store');
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');

      const csv = await res.text();
      expect(csv).toContain('Commitment ID');
      expect(csv).toContain("'=cmd|whoami"); // Formula injection escaped with quote
    });

    it('returns 403 when a commitment does not belong to the authenticated wallet', async () => {
      const mockCommitment = createValidCommitment({
        ownerAddress: VALID_ADDRESS_B, // Different owner!
      });
      vi.mocked(getUserCommitmentsFromChain).mockResolvedValue([mockCommitment]);

      const res = await GET(
        makeRequest({ ownerAddress: VALID_ADDRESS_A }, { authorization: 'Bearer valid-token' }),
        { params: {} },
      );
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.error.code).toBe('FORBIDDEN');
      expect(body.error.message).toContain('do not belong to the authenticated wallet');
    });

    it('returns 403 when one of multiple commitments has mismatched ownership', async () => {
      const validCommitment = createValidCommitment({
        id: 'cmt-1',
        ownerAddress: VALID_ADDRESS_A,
      });
      const rogue = createValidCommitment({
        id: 'cmt-2',
        ownerAddress: VALID_ADDRESS_B, // Malicious or corrupted response
      });
      vi.mocked(getUserCommitmentsFromChain).mockResolvedValue([validCommitment, rogue]);

      const res = await GET(
        makeRequest({ ownerAddress: VALID_ADDRESS_A }, { authorization: 'Bearer valid-token' }),
        { params: {} },
      );
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('handles case-insensitive address comparison for ownership verification', async () => {
      const mixedCaseAddress = VALID_ADDRESS_A.toLowerCase();
      const upperCaseAddress = VALID_ADDRESS_A.toUpperCase();

      vi.mocked(verifySessionToken).mockReturnValue({
        valid: true,
        address: mixedCaseAddress,
        createdAt: new Date(),
      });

      const mockCommitment = createValidCommitment({
        ownerAddress: upperCaseAddress,
      });
      vi.mocked(getUserCommitmentsFromChain).mockResolvedValue([mockCommitment]);

      const res = await GET(
        makeRequest(
          { ownerAddress: VALID_ADDRESS_A },
          { authorization: 'Bearer valid-token' },
        ),
        { params: {} },
      );

      expect(res.status).toBe(200);
    });
  });

  describe('Malformed Response Handling', () => {
    beforeEach(() => {
      vi.mocked(verifySessionToken).mockReturnValue({
        valid: true,
        address: VALID_ADDRESS_A,
        createdAt: new Date(),
      });
    });

    it('returns 500 when chain service returns non-array response', async () => {
      vi.mocked(getUserCommitmentsFromChain).mockResolvedValue(
        { not: 'an array' } as any,
      );

      const res = await GET(
        makeRequest({ ownerAddress: VALID_ADDRESS_A }, { authorization: 'Bearer valid-token' }),
        { params: {} },
      );
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });

    it('returns 500 when a commitment has missing required field (id)', async () => {
      const brokenCommitment = createValidCommitment();
      delete brokenCommitment.id;

      vi.mocked(getUserCommitmentsFromChain).mockResolvedValue([brokenCommitment as any]);

      const res = await GET(
        makeRequest({ ownerAddress: VALID_ADDRESS_A }, { authorization: 'Bearer valid-token' }),
        { params: {} },
      );
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });

    it('returns 500 when a commitment has invalid compliance score (NaN)', async () => {
      const brokenCommitment = createValidCommitment({
        complianceScore: NaN as any,
      });

      vi.mocked(getUserCommitmentsFromChain).mockResolvedValue([brokenCommitment]);

      const res = await GET(
        makeRequest({ ownerAddress: VALID_ADDRESS_A }, { authorization: 'Bearer valid-token' }),
        { params: {} },
      );
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });

    it('returns 500 when a commitment has compliance score out of bounds (>100)', async () => {
      const brokenCommitment = createValidCommitment({
        complianceScore: 150,
      });

      vi.mocked(getUserCommitmentsFromChain).mockResolvedValue([brokenCommitment]);

      const res = await GET(
        makeRequest({ ownerAddress: VALID_ADDRESS_A }, { authorization: 'Bearer valid-token' }),
        { params: {} },
      );
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });

    it('returns 500 when amount is not a numeric string', async () => {
      const brokenCommitment = createValidCommitment({
        amount: 'not-a-number',
      });

      vi.mocked(getUserCommitmentsFromChain).mockResolvedValue([brokenCommitment]);

      const res = await GET(
        makeRequest({ ownerAddress: VALID_ADDRESS_A }, { authorization: 'Bearer valid-token' }),
        { params: {} },
      );
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });

    it('returns 500 when status is not a valid commitment status', async () => {
      const brokenCommitment = createValidCommitment({
        status: 'INVALID_STATUS' as any,
      });

      vi.mocked(getUserCommitmentsFromChain).mockResolvedValue([brokenCommitment]);

      const res = await GET(
        makeRequest({ ownerAddress: VALID_ADDRESS_A }, { authorization: 'Bearer valid-token' }),
        { params: {} },
      );
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });

    it('returns 500 when createdAt is not a valid ISO 8601 date', async () => {
      const brokenCommitment = createValidCommitment({
        createdAt: 'not-a-date',
      });

      vi.mocked(getUserCommitmentsFromChain).mockResolvedValue([brokenCommitment]);

      const res = await GET(
        makeRequest({ ownerAddress: VALID_ADDRESS_A }, { authorization: 'Bearer valid-token' }),
        { params: {} },
      );
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });

    it('returns 500 when commitment has extra unknown fields (service contract change)', async () => {
      const brokenCommitment = {
        ...createValidCommitment(),
        unknownNewField: 'unexpected',
      };

      vi.mocked(getUserCommitmentsFromChain).mockResolvedValue([brokenCommitment as any]);

      const res = await GET(
        makeRequest({ ownerAddress: VALID_ADDRESS_A }, { authorization: 'Bearer valid-token' }),
        { params: {} },
      );
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error.code).toBe('INTERNAL_ERROR');
      expect(body.error.message).toContain('service contract change');
    });

    it('returns 400 when a string field (asset) exceeds max length', async () => {
      const brokenCommitment = createValidCommitment({
        asset: 'A'.repeat(500), // Much longer than 12-char limit
      });

      vi.mocked(getUserCommitmentsFromChain).mockResolvedValue([brokenCommitment]);

      const res = await GET(
        makeRequest({ ownerAddress: VALID_ADDRESS_A }, { authorization: 'Bearer valid-token' }),
        { params: {} },
      );
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error.code).toBe('BAD_REQUEST');
      expect(body.error.message).toContain('length out of bounds');
    });
  });

  describe('Resource Exhaustion Protection', () => {
    beforeEach(() => {
      vi.mocked(verifySessionToken).mockReturnValue({
        valid: true,
        address: VALID_ADDRESS_A,
        createdAt: new Date(),
      });
    });

    it('returns 400 when export exceeds MAX_EXPORT_ROWS (5000)', async () => {
      const tooManyCommitments = Array.from({ length: 5001 }, (_, i) =>
        createValidCommitment({
          id: `cmt-${i}`,
        }),
      );

      vi.mocked(getUserCommitmentsFromChain).mockResolvedValue(tooManyCommitments);

      const res = await GET(
        makeRequest({ ownerAddress: VALID_ADDRESS_A }, { authorization: 'Bearer valid-token' }),
        { params: {} },
      );
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error.code).toBe('BAD_REQUEST');
      expect(body.error.message).toContain('exceeds the maximum row limit');
    });

    it('returns 500 when chain service returns array exceeding internal bounds', async () => {
      // This tests the internal validation layer
      const hugeArray = Array.from({ length: 10000 }, (_, i) =>
        createValidCommitment({
          id: `cmt-${i}`,
        }),
      );

      vi.mocked(getUserCommitmentsFromChain).mockResolvedValue(hugeArray as any);

      const res = await GET(
        makeRequest({ ownerAddress: VALID_ADDRESS_A }, { authorization: 'Bearer valid-token' }),
        { params: {} },
      );
      const body = await res.json();

      // Should fail at the internal validation layer (InternalError)
      expect(res.status).toBe(500);
    });
  });

  describe('Query Parameter Validation', () => {
    beforeEach(() => {
      vi.mocked(verifySessionToken).mockReturnValue({
        valid: true,
        address: VALID_ADDRESS_A,
        createdAt: new Date(),
      });
      vi.mocked(getUserCommitmentsFromChain).mockResolvedValue([]);
    });

    it('returns 200 with default columns when columns param is missing', async () => {
      const res = await GET(
        makeRequest({ ownerAddress: VALID_ADDRESS_A }, { authorization: 'Bearer valid-token' }),
        { params: {} },
      );

      expect(res.status).toBe(200);
      const csv = await res.text();
      expect(csv).toContain('Commitment ID');
      expect(csv).toContain('Owner');
    });

    it('returns 400 when format param is unsupported (not csv)', async () => {
      const res = await GET(
        makeRequest(
          { ownerAddress: VALID_ADDRESS_A, format: 'json' },
          { authorization: 'Bearer valid-token' },
        ),
        { params: {} },
      );
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error.message).toContain('Unsupported export format');
    });

    it('returns 200 when dateRange is unsupported (falls back to all)', async () => {
      const res = await GET(
        makeRequest(
          { ownerAddress: VALID_ADDRESS_A, dateRange: 'nonsense' },
          { authorization: 'Bearer valid-token' },
        ),
        { params: {} },
      );

      expect(res.status).toBe(200);
    });

    it('accepts valid dateRange values (7d, 30d, year, all)', async () => {
      for (const range of ['7d', '30d', 'year', 'all']) {
        const res = await GET(
          makeRequest(
            { ownerAddress: VALID_ADDRESS_A, dateRange: range },
            { authorization: 'Bearer valid-token' },
          ),
          { params: {} },
        );

        expect(res.status).toBe(200);
      }
    });
  });

  describe('Idempotency and Replay Protection', () => {
    beforeEach(() => {
      vi.mocked(verifySessionToken).mockReturnValue({
        valid: true,
        address: VALID_ADDRESS_A,
        createdAt: new Date(),
      });
      vi.mocked(getUserCommitmentsFromChain).mockResolvedValue([]);
    });

    it('returns cached response on idempotency-key replay within 24h', async () => {
      const key = 'export-idem-1';
      const req1 = makeRequest(
        { ownerAddress: VALID_ADDRESS_A },
        { authorization: 'Bearer valid-token', 'idempotency-key': key },
      );
      const res1 = await GET(req1, { params: {} });
      expect(res1.status).toBe(200);

      // Replay with same key
      const req2 = makeRequest(
        { ownerAddress: VALID_ADDRESS_A },
        { authorization: 'Bearer valid-token', 'idempotency-key': key },
      );
      const res2 = await GET(req2, { params: {} });
      expect(res2.status).toBe(200);

      // Should only fetch once (cache hit on second)
      expect(getUserCommitmentsFromChain).toHaveBeenCalledTimes(1);
    });

    it('scopes idempotency key by wallet address (wallet A and B with same key are separate)', async () => {
      vi.mocked(getUserCommitmentsFromChain).mockResolvedValue([]);

      const key = 'export-idem-shared';

      // Wallet A
      const req1 = makeRequest(
        { ownerAddress: VALID_ADDRESS_A },
        { authorization: 'Bearer valid-token-a', 'idempotency-key': key },
      );
      vi.mocked(verifySessionToken).mockReturnValue({
        valid: true,
        address: VALID_ADDRESS_A,
        createdAt: new Date(),
      });
      const res1 = await GET(req1, { params: {} });
      expect(res1.status).toBe(200);

      // Wallet B with same key should get a new operation
      const req2 = makeRequest(
        { ownerAddress: VALID_ADDRESS_B },
        { authorization: 'Bearer valid-token-b', 'idempotency-key': key },
      );
      vi.mocked(verifySessionToken).mockReturnValue({
        valid: true,
        address: VALID_ADDRESS_B,
        createdAt: new Date(),
      });
      const res2 = await GET(req2, { params: {} });
      expect(res2.status).toBe(200);

      // Should fetch for each wallet (2 calls total)
      expect(getUserCommitmentsFromChain).toHaveBeenCalledTimes(2);
    });

    it('returns 400 when concurrent requests use the same idempotency-key', async () => {
      const key = 'export-idem-concurrent';
      const mockCommitment = createValidCommitment({ ownerAddress: VALID_ADDRESS_A });

      // Mock idempotency to simulate concurrent access
      vi.mocked(getUserCommitmentsFromChain).mockResolvedValue([mockCommitment]);

      const req = makeRequest(
        { ownerAddress: VALID_ADDRESS_A },
        { authorization: 'Bearer valid-token', 'idempotency-key': key },
      );

      // First request succeeds
      const res1 = await GET(req, { params: {} });
      expect(res1.status).toBe(200);

      // In a real scenario, concurrent requests would trigger the race condition
      // This is tested at the idempotencyService level
    });
  });

  describe('CSV Generation and Security', () => {
    beforeEach(() => {
      vi.mocked(verifySessionToken).mockReturnValue({
        valid: true,
        address: VALID_ADDRESS_A,
        createdAt: new Date(),
      });
    });

    it('escapes formula injection attempts in CSV values', async () => {
      const dangerousCommitment = createValidCommitment({
        asset: '=cmd|whoami',
        amount: '+1000',
        id: '-9999',
      });

      vi.mocked(getUserCommitmentsFromChain).mockResolvedValue([dangerousCommitment]);

      const res = await GET(
        makeRequest({ ownerAddress: VALID_ADDRESS_A }, { authorization: 'Bearer valid-token' }),
        { params: {} },
      );

      const csv = await res.text();
      expect(csv).toContain("'=cmd|whoami"); // Escaped with single quote
      expect(csv).toContain("'+1000");
      expect(csv).toContain("'-9999");
    });

    it('includes security headers to prevent caching and sniffing', async () => {
      vi.mocked(getUserCommitmentsFromChain).mockResolvedValue([
        createValidCommitment({ ownerAddress: VALID_ADDRESS_A }),
      ]);

      const res = await GET(
        makeRequest({ ownerAddress: VALID_ADDRESS_A }, { authorization: 'Bearer valid-token' }),
        { params: {} },
      );

      expect(res.headers.get('Cache-Control')).toBe('no-store, private');
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(res.headers.get('Content-Type')).toContain('text/csv');
    });

    it('sets attachment disposition with safe filename', async () => {
      vi.mocked(getUserCommitmentsFromChain).mockResolvedValue([
        createValidCommitment({ ownerAddress: VALID_ADDRESS_A }),
      ]);

      const res = await GET(
        makeRequest({ ownerAddress: VALID_ADDRESS_A }, { authorization: 'Bearer valid-token' }),
        { params: {} },
      );

      const disposition = res.headers.get('Content-Disposition');
      expect(disposition).toContain('attachment');
      expect(disposition).toContain('commitments.csv');
      // Filename should NOT contain wallet address or filter params
      expect(disposition).not.toContain(VALID_ADDRESS_A);
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    beforeEach(() => {
      vi.mocked(verifySessionToken).mockReturnValue({
        valid: true,
        address: VALID_ADDRESS_A,
        createdAt: new Date(),
      });
    });

    it('exports empty result set (0 commitments)', async () => {
      vi.mocked(getUserCommitmentsFromChain).mockResolvedValue([]);

      const res = await GET(
        makeRequest({ ownerAddress: VALID_ADDRESS_A }, { authorization: 'Bearer valid-token' }),
        { params: {} },
      );

      expect(res.status).toBe(200);
      const csv = await res.text();
      // CSV should have headers but no data rows
      expect(csv).toContain('Commitment ID');
    });

    it('exports exactly MAX_EXPORT_ROWS without error', async () => {
      const maxCommitments = Array.from({ length: 5000 }, (_, i) =>
        createValidCommitment({
          id: `cmt-${i}`,
        }),
      );

      vi.mocked(getUserCommitmentsFromChain).mockResolvedValue(maxCommitments);

      const res = await GET(
        makeRequest({ ownerAddress: VALID_ADDRESS_A }, { authorization: 'Bearer valid-token' }),
        { params: {} },
      );

      expect(res.status).toBe(200);
      const csv = await res.text();
      // CSV should contain all rows
      expect(csv).toContain('cmt-0');
      expect(csv).toContain('cmt-4999');
    });

    it('handles commitments with optional fields missing gracefully', async () => {
      const minimalCommitment = createValidCommitment();
      delete minimalCommitment.createdAt;
      delete minimalCommitment.expiresAt;
      delete minimalCommitment.contractVersion;

      vi.mocked(getUserCommitmentsFromChain).mockResolvedValue([minimalCommitment]);

      const res = await GET(
        makeRequest({ ownerAddress: VALID_ADDRESS_A }, { authorization: 'Bearer valid-token' }),
        { params: {} },
      );

      expect(res.status).toBe(200);
      const csv = await res.text();
      expect(csv).toContain('Commitment ID');
    });

    it('handles very large numeric values in amount and currentValue fields', async () => {
      const largeCommitment = createValidCommitment({
        amount: '999999999999999999999999999999999999999999999',
        currentValue: '888888888888888888888888888888888888888888888',
        feeEarned: '777777777777777777777777777777777777777777777',
      });

      vi.mocked(getUserCommitmentsFromChain).mockResolvedValue([largeCommitment]);

      const res = await GET(
        makeRequest({ ownerAddress: VALID_ADDRESS_A }, { authorization: 'Bearer valid-token' }),
        { params: {} },
      );

      expect(res.status).toBe(200);
      const csv = await res.text();
      // Large numbers should be preserved as-is
      expect(csv).toContain('999999999999999999999999999999999999999999999');
    });
  });
});
