import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { CsrfValidationError } from '@/lib/backend/errors';

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn(),
}));
vi.mock('@/lib/backend/services/contracts', () => ({
  openDisputeOnChain: vi.fn(),
}));
vi.mock('@/lib/backend/csrf', () => ({
  assertMutationCsrf: vi.fn(),
}));
vi.mock('@/lib/backend/logger', () => ({
  logDisputeOpened: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));
vi.mock('@/lib/backend/auditLog', () => ({
  recordAuditEvent: vi.fn(),
}));

import { checkRateLimit } from '@/lib/backend/rateLimit';
import { openDisputeOnChain } from '@/lib/backend/services/contracts';
import { assertMutationCsrf } from '@/lib/backend/csrf';

const mockCheckRateLimit = vi.mocked(checkRateLimit);
const mockOpenDisputeOnChain = vi.mocked(openDisputeOnChain);
const mockAssertMutationCsrf = vi.mocked(assertMutationCsrf);

const MOCK_DISPUTE_RESULT = {
  commitmentId: 'cmt-123',
  disputeId: 'dis-1',
  status: 'DISPUTED',
  txHash: '0xabc',
  disputedAt: '2026-06-01T00:00:00.000Z',
};

function makeRequest(
  id: string,
  body?: Record<string, unknown>,
  method = 'POST',
): [NextRequest, { params: { id: string } }] {
  const init: RequestInit = { method };
  if (body) {
    init.headers = { 'content-type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  const req = new NextRequest(`http://localhost/api/commitments/${id}/dispute`, init);
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

describe('POST /api/commitments/[id]/dispute', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockCheckRateLimit.mockResolvedValue(true);
    mockOpenDisputeOnChain.mockResolvedValue(MOCK_DISPUTE_RESULT);
    mockAssertMutationCsrf.mockImplementation(() => {});
  });

  describe('authorization boundary', () => {
    it('enforces CSRF before any processing', async () => {
      mockAssertMutationCsrf.mockImplementation(() => {
        throw new CsrfValidationError();
      });
      const [req, ctx] = makeRequest('cmt-123', { reason: 'Fraud', callerAddress: 'GOWNER1' });
      await expectError(req, ctx, 403, 'CSRF_INVALID');
      expect(mockOpenDisputeOnChain).not.toHaveBeenCalled();
    });

    it('rejects a missing caller address as Forbidden', async () => {
      const [req, ctx] = makeRequest('cmt-123', { reason: 'Fraud' });
      await expectError(req, ctx, 403, 'FORBIDDEN');
      expect(mockOpenDisputeOnChain).not.toHaveBeenCalled();
    });
  });

  describe('route-parameter validation (hostile input boundary)', () => {
    it('rejects an empty commitment id', async () => {
      const [req, ctx] = makeRequest('', { reason: 'Fraud', callerAddress: 'GOWNER1' });
      await expectError(req, ctx, 400, 'VALIDATION_ERROR');
      expect(mockOpenDisputeOnChain).not.toHaveBeenCalled();
    });

    it('rejects path-traversal characters in the id', async () => {
      const [req, ctx] = makeRequest('../etc/passwd', {
        reason: 'Fraud',
        callerAddress: 'GOWNER1',
      });
      await expectError(req, ctx, 400, 'VALIDATION_ERROR');
      expect(mockOpenDisputeOnChain).not.toHaveBeenCalled();
    });

    it('rejects an over-long id', async () => {
      const [req, ctx] = makeRequest('x'.repeat(200), {
        reason: 'Fraud',
        callerAddress: 'GOWNER1',
      });
      await expectError(req, ctx, 400, 'VALIDATION_ERROR');
      expect(mockOpenDisputeOnChain).not.toHaveBeenCalled();
    });
  });

  describe('request-body validation', () => {
    it('rejects an empty reason', async () => {
      const [req, ctx] = makeRequest('cmt-123', { reason: '', callerAddress: 'GOWNER1' });
      await expectError(req, ctx, 400, 'VALIDATION_ERROR');
    });

    it('rejects invalid JSON', async () => {
      const req = new NextRequest('http://localhost/api/commitments/cmt-123/dispute', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{not json',
      });
      await expectError(req, { params: { id: 'cmt-123' } }, 400, 'VALIDATION_ERROR');
    });
  });

  describe('rate limit', () => {
    it('returns 429 when rate limited', async () => {
      mockCheckRateLimit.mockResolvedValue(false);
      const [req, ctx] = makeRequest('cmt-123', { reason: 'Fraud', callerAddress: 'GOWNER1' });
      await expectError(req, ctx, 429, 'TOO_MANY_REQUESTS');
      expect(mockOpenDisputeOnChain).not.toHaveBeenCalled();
    });
  });

  describe('success', () => {
    it('opens a dispute and returns the result envelope', async () => {
      const [req, ctx] = makeRequest('cmt-123', {
        reason: 'Fraud',
        evidence: 'tx-id',
        callerAddress: 'GOWNER1',
      });
      const res = await POST(req, ctx);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.commitmentId).toBe('cmt-123');
      expect(body.data.disputeId).toBe('dis-1');
      expect(mockOpenDisputeOnChain).toHaveBeenCalledWith({
        commitmentId: 'cmt-123',
        reason: 'Fraud',
        evidence: 'tx-id',
        callerAddress: 'GOWNER1',
      });
    });
  });
});
