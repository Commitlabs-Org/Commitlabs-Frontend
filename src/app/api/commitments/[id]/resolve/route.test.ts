import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { CsrfValidationError, ForbiddenError } from '@/lib/backend/errors';

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn(),
}));
vi.mock('@/lib/backend/services/contracts', () => ({
  resolveDisputeOnChain: vi.fn(),
}));
vi.mock('@/lib/backend/csrf', () => ({
  assertMutationCsrf: vi.fn(),
}));
vi.mock('@/lib/backend/requireAuth', () => ({
  requireAdmin: vi.fn(),
}));
vi.mock('@/lib/backend/logger', () => ({
  logDisputeResolved: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));
vi.mock('@/lib/backend/auditLog', () => ({
  recordAuditEvent: vi.fn(),
}));

import { checkRateLimit } from '@/lib/backend/rateLimit';
import { resolveDisputeOnChain } from '@/lib/backend/services/contracts';
import { assertMutationCsrf } from '@/lib/backend/csrf';
import { requireAdmin } from '@/lib/backend/requireAuth';

const mockCheckRateLimit = vi.mocked(checkRateLimit);
const mockResolveDisputeOnChain = vi.mocked(resolveDisputeOnChain);
const mockAssertMutationCsrf = vi.mocked(assertMutationCsrf);
const mockRequireAdmin = vi.mocked(requireAdmin);

const MOCK_RESOLVE_RESULT = {
  commitmentId: 'cmt-123',
  disputeId: 'dis-1',
  resolution: 'dismissed',
  finalStatus: 'RESOLVED',
  txHash: '0xabc',
  resolvedAt: '2026-06-01T00:00:00.000Z',
};

const ADMIN = { address: 'GADMIN123456789', isAdmin: true };

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
  const req = new NextRequest(`http://localhost/api/commitments/${id}/resolve`, init);
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

describe('POST /api/commitments/[id]/resolve', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockCheckRateLimit.mockResolvedValue(true);
    mockResolveDisputeOnChain.mockResolvedValue(MOCK_RESOLVE_RESULT);
    mockAssertMutationCsrf.mockImplementation(() => {});
    mockRequireAdmin.mockReturnValue(ADMIN);
  });

  describe('authorization boundary', () => {
    it('enforces CSRF before admin check and processing', async () => {
      mockAssertMutationCsrf.mockImplementation(() => {
        throw new CsrfValidationError();
      });
      const [req, ctx] = makeRequest('cmt-123', { resolution: 'dismissed' });
      await expectError(req, ctx, 403, 'CSRF_INVALID');
      expect(mockResolveDisputeOnChain).not.toHaveBeenCalled();
    });

    it('enforces admin authorization before any processing', async () => {
      mockRequireAdmin.mockImplementation(() => {
        throw new ForbiddenError('Admin access required');
      });
      const [req, ctx] = makeRequest('cmt-123', { resolution: 'dismissed' });
      await expectError(req, ctx, 403, 'FORBIDDEN');
      expect(mockResolveDisputeOnChain).not.toHaveBeenCalled();
    });
  });

  describe('route-parameter validation (hostile input boundary)', () => {
    it('rejects an empty commitment id', async () => {
      const [req, ctx] = makeRequest('', { resolution: 'dismissed' });
      await expectError(req, ctx, 400, 'VALIDATION_ERROR');
      expect(mockResolveDisputeOnChain).not.toHaveBeenCalled();
    });

    it('rejects path-traversal characters in the id', async () => {
      const [req, ctx] = makeRequest('../etc/passwd', { resolution: 'dismissed' });
      await expectError(req, ctx, 400, 'VALIDATION_ERROR');
      expect(mockResolveDisputeOnChain).not.toHaveBeenCalled();
    });
  });

  describe('request-body validation', () => {
    it('rejects an unknown resolution value', async () => {
      const [req, ctx] = makeRequest('cmt-123', { resolution: 'not-a-valid-choice' });
      await expectError(req, ctx, 400, 'VALIDATION_ERROR');
      expect(mockResolveDisputeOnChain).not.toHaveBeenCalled();
    });
  });

  describe('rate limit', () => {
    it('returns 429 when rate limited', async () => {
      mockCheckRateLimit.mockResolvedValue(false);
      const [req, ctx] = makeRequest('cmt-123', { resolution: 'dismissed' });
      await expectError(req, ctx, 429, 'TOO_MANY_REQUESTS');
      expect(mockResolveDisputeOnChain).not.toHaveBeenCalled();
    });
  });

  describe('success', () => {
    it('resolves a dispute as an admin and returns the envelope', async () => {
      const [req, ctx] = makeRequest('cmt-123', {
        resolution: 'dismissed',
        notes: 'No evidence',
      });
      const res = await POST(req, ctx);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.commitmentId).toBe('cmt-123');
      expect(mockResolveDisputeOnChain).toHaveBeenCalledWith({
        commitmentId: 'cmt-123',
        resolution: 'dismissed',
        notes: 'No evidence',
        resolverAddress: ADMIN.address,
      });
    });
  });
});
