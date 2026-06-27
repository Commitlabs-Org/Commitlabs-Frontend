import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, OPTIONS, GET, PUT, PATCH, DELETE } from './route';
import { ConflictError, CsrfValidationError } from '@/lib/backend/errors';

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn(),
  getRateLimitWindowSeconds: vi.fn(),
}));
vi.mock('@/lib/backend/services/contracts', () => ({
  fundEscrowOnChain: vi.fn(),
  getCommitmentFromChain: vi.fn(),
}));
vi.mock('@/lib/backend/csrf', () => ({
  assertMutationCsrf: vi.fn(),
}));
vi.mock('@/lib/backend/idempotency', () => ({
  idempotencyService: {
    getRecord: vi.fn(),
    start: vi.fn(),
    complete: vi.fn(),
    fail: vi.fn(),
  },
}));

import { checkRateLimit, getRateLimitWindowSeconds } from '@/lib/backend/rateLimit';
import { fundEscrowOnChain, getCommitmentFromChain } from '@/lib/backend/services/contracts';
import { assertMutationCsrf } from '@/lib/backend/csrf';
import { idempotencyService } from '@/lib/backend/idempotency';
import { NextResponse } from 'next/server';

const mockCheckRateLimit = vi.mocked(checkRateLimit);
const mockGetRateLimitWindowSeconds = vi.mocked(getRateLimitWindowSeconds);
const mockFundEscrowOnChain = vi.mocked(fundEscrowOnChain);
const mockGetCommitmentFromChain = vi.mocked(getCommitmentFromChain);
const mockAssertMutationCsrf = vi.mocked(assertMutationCsrf);
const mockIdempotencyGetRecord = vi.mocked(idempotencyService.getRecord);
const mockIdempotencyStart = vi.mocked(idempotencyService.start);
const mockIdempotencyComplete = vi.mocked(idempotencyService.complete);
const mockIdempotencyFail = vi.mocked(idempotencyService.fail);

const MOCK_COMMITMENT = {
  id: 'cmt-123',
  ownerAddress: 'GOWNER123456789',
  asset: 'USDC',
  amount: '10000',
  status: 'CREATED' as const,
  complianceScore: 90,
  currentValue: '10000',
  feeEarned: '0',
  violationCount: 0,
  createdAt: '2026-06-01T00:00:00.000Z',
};

const MOCK_FUND_RESULT = {
  commitmentId: 'cmt-123',
  txHash: '0xdeadbeef',
  contractVersion: '1.0.0',
  reference: undefined,
};

function makeRequest(
  id: string,
  body?: Record<string, unknown>,
  method = 'POST',
  headers?: Record<string, string>,
): [NextRequest, { params: { id: string } }] {
  const reqHeaders: Record<string, string> = {
    ...(body ? { 'content-type': 'application/json' } : {}),
    ...headers,
  };
  const req = new NextRequest(`http://localhost/api/commitments/${id}/fund`, {
    method,
    headers: reqHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });
  return [req, { params: { id } }];
}

async function expectError(
  req: NextRequest,
  ctx: { params: { id: string } },
  status: number,
  code?: string,
): Promise<void> {
  const res = await POST(req, ctx);
  const body = await res.json();
  expect(res.status).toBe(status);
  expect(body.success).toBe(false);
  expect(body.error).toBeDefined();
  if (code) expect(body.error.code).toBe(code);
}

describe('POST /api/commitments/[id]/fund', () => {

  beforeEach(() => {
    vi.resetAllMocks();
    mockCheckRateLimit.mockResolvedValue(true);
    mockGetRateLimitWindowSeconds.mockReturnValue(60);
    mockGetCommitmentFromChain.mockResolvedValue(MOCK_COMMITMENT);
    mockFundEscrowOnChain.mockResolvedValue(MOCK_FUND_RESULT);
    mockIdempotencyGetRecord.mockResolvedValue(null);
    mockIdempotencyStart.mockResolvedValue(true);
  });

  describe('200 - success', () => {
    it('funds a commitment escrow', async () => {
      const [req, ctx] = makeRequest('cmt-123', {});
      const res = await POST(req, ctx);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.commitmentId).toBe('cmt-123');
      expect(body.data.txHash).toBe('0xdeadbeef');
      expect(body.data.reference).toBeUndefined();
      expect(body.data.fundedAt).toBeDefined();
      expect(body.meta).toBeDefined();
    });

    it('calls fundEscrowOnChain with correct params', async () => {
      const [req, ctx] = makeRequest('cmt-123', { callerAddress: 'GOWNER123456789' });
      await POST(req, ctx);

      expect(mockFundEscrowOnChain).toHaveBeenCalledWith({
        commitmentId: 'cmt-123',
        callerAddress: 'GOWNER123456789',
      });
    });

    it('emits CSRF check for the request', async () => {
      const [req, ctx] = makeRequest('cmt-123', {});
      await POST(req, ctx);

      expect(mockAssertMutationCsrf).toHaveBeenCalledWith(req);
    });

    it('checks rate limit', async () => {
      const [req, ctx] = makeRequest('cmt-123', {});
      await POST(req, ctx);

      expect(mockCheckRateLimit).toHaveBeenCalledWith(expect.any(String), 'api/commitments/fund');
    });

    it('fetches commitment from chain to verify state', async () => {
      const [req, ctx] = makeRequest('cmt-123', {});
      await POST(req, ctx);

      expect(mockGetCommitmentFromChain).toHaveBeenCalledWith('cmt-123');
    });
  });

  describe('200 - success with idempotency', () => {
    it('returns cached response when idempotency key is COMPLETED', async () => {
      const cachedResponse = { commitmentId: 'cmt-123', txHash: '0xold' };
      mockIdempotencyGetRecord.mockResolvedValue({
        key: 'idem-001',
        status: 'COMPLETED',
        response: cachedResponse,
        statusCode: 200,
        createdAt: Date.now(),
        expiresAt: Date.now() + 86400000,
      });

      const [req, ctx] = makeRequest('cmt-123', {}, 'POST', { 'idempotency-key': 'idem-001' });
      const res = await POST(req, ctx);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data).toEqual(cachedResponse);
      expect(mockFundEscrowOnChain).not.toHaveBeenCalled();
    });

    it('starts idempotency tracking for a new key', async () => {
      const [req, ctx] = makeRequest('cmt-123', {}, 'POST', { 'idempotency-key': 'idem-002' });
      await POST(req, ctx);

      expect(mockIdempotencyStart).toHaveBeenCalledWith('idem-002');
    });

    it('completes idempotency tracking on success', async () => {
      const [req, ctx] = makeRequest('cmt-123', {}, 'POST', { 'idempotency-key': 'idem-003' });
      await POST(req, ctx);

      expect(mockIdempotencyComplete).toHaveBeenCalledWith(
        'idem-003',
        expect.objectContaining({ commitmentId: 'cmt-123' }),
        200,
      );
    });
  });

  describe('400 - validation errors', () => {
    it('rejects empty commitment id', async () => {
      const [req, ctx] = makeRequest('', {});
      await expectError(req, ctx, 400, 'VALIDATION_ERROR');
    });

    it('rejects whitespace-only id', async () => {
      const [req, ctx] = makeRequest('   ', {});
      await expectError(req, ctx, 400, 'VALIDATION_ERROR');
    });

    it('rejects invalid JSON body', async () => {
      const req = new NextRequest('http://localhost/api/commitments/cmt-123/fund', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'not-json',
      });
      await expectError(req, { params: { id: 'cmt-123' } }, 400, 'VALIDATION_ERROR');
    });
  });

  describe('403 - forbidden', () => {
    it('rejects callerAddress that does not match owner', async () => {
      const [req, ctx] = makeRequest('cmt-123', { callerAddress: 'GWRONGADDRESS' });
      await expectError(req, ctx, 403, 'FORBIDDEN');
    });

    it('rejects CSRF violation when session cookie is present and token is missing', async () => {
      mockAssertMutationCsrf.mockImplementation(() => {
        throw new CsrfValidationError('Missing CSRF token.');
      });
      const [req, ctx] = makeRequest('cmt-123', {});
      await expectError(req, ctx, 403, 'CSRF_INVALID');
    });
  });

  describe('404 - not found', () => {
    it('returns 404 when commitment does not exist', async () => {
      mockGetCommitmentFromChain.mockResolvedValue(null);
      const [req, ctx] = makeRequest('nonexistent', {});
      await expectError(req, ctx, 404, 'NOT_FOUND');
    });
  });

  describe('409 - conflict', () => {
    it('rejects funding a non-CREATED commitment', async () => {
      mockGetCommitmentFromChain.mockResolvedValue({
        ...MOCK_COMMITMENT,
        status: 'ACTIVE',
      } as typeof MOCK_COMMITMENT);
      const [req, ctx] = makeRequest('cmt-123', {});
      await expectError(req, ctx, 409, 'CONFLICT');
    });

    it('rejects duplicate idempotency key that is still processing', async () => {
      mockIdempotencyGetRecord.mockResolvedValue({
        key: 'idem-004',
        status: 'STARTED',
        createdAt: Date.now(),
        expiresAt: Date.now() + 86400000,
      });
      const [req, ctx] = makeRequest('cmt-123', {}, 'POST', { 'idempotency-key': 'idem-004' });
      await expectError(req, ctx, 409, 'CONFLICT');
    });
  });

  describe('429 - rate limited', () => {
    it('returns 429 when rate limit exceeded', async () => {
      mockCheckRateLimit.mockResolvedValue(false);
      const [req, ctx] = makeRequest('cmt-123', {});
      await expectError(req, ctx, 429, 'TOO_MANY_REQUESTS');
    });
  });

  describe('405 - method not allowed', () => {
    it('rejects GET requests', async () => {
      const [req, ctx] = makeRequest('cmt-123', undefined, 'GET');
      const res = await GET(req, ctx);
      const body = await res.json();
      expect(res.status).toBe(405);
      expect(body.error.code).toBe('METHOD_NOT_ALLOWED');
    });

    it('rejects PUT requests', async () => {
      const [req, ctx] = makeRequest('cmt-123', undefined, 'PUT');
      const res = await PUT(req, ctx);
      expect(res.status).toBe(405);
    });

    it('rejects PATCH requests', async () => {
      const [req, ctx] = makeRequest('cmt-123', undefined, 'PATCH');
      const res = await PATCH(req, ctx);
      expect(res.status).toBe(405);
    });

    it('rejects DELETE requests', async () => {
      const [req, ctx] = makeRequest('cmt-123', undefined, 'DELETE');
      const res = await DELETE(req, ctx);
      expect(res.status).toBe(405);
    });
  });

  describe('OPTIONS', () => {
    it('returns 204 for OPTIONS preflight', async () => {
      const req = new NextRequest('http://localhost/api/commitments/cmt-123/fund', {
        method: 'OPTIONS',
        headers: { 'access-control-request-method': 'POST' },
      });
      const res = await OPTIONS(req);
      expect(res.status).toBe(204);
    });
  });

  describe('error handling', () => {
    it('fails idempotency key on error', async () => {
      mockGetCommitmentFromChain.mockRejectedValue(new Error('RPC failure'));
      const [req, ctx] = makeRequest('cmt-123', {}, 'POST', { 'idempotency-key': 'idem-005' });
      await POST(req, ctx);

      expect(mockIdempotencyFail).toHaveBeenCalledWith('idem-005');
    });

    it('returns 500 for unexpected errors', async () => {
      mockGetCommitmentFromChain.mockRejectedValue(new Error('Unexpected DB error'));
      const [req, ctx] = makeRequest('cmt-123', {});
      const res = await POST(req, ctx);
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });
  });
});
