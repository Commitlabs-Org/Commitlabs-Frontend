import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { ValidationError, ConflictError, ForbiddenError } from '@/lib/backend/errors';

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn(),
}));
vi.mock('@/lib/backend/services/contracts', () => ({
  resolveDisputeOnChain: vi.fn(),
}));
vi.mock('@/lib/backend/logger', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/backend/logger')>();
  return { ...actual, logDisputeResolved: vi.fn() };
});
vi.mock('@/lib/backend/auditLog', () => ({
  recordAuditEvent: vi.fn(),
}));
vi.mock('@/lib/backend/requireAuth', () => ({
  requireAdmin: vi.fn(),
}));

import { checkRateLimit } from '@/lib/backend/rateLimit';
import { resolveDisputeOnChain } from '@/lib/backend/services/contracts';
import { logDisputeResolved } from '@/lib/backend/logger';
import { recordAuditEvent } from '@/lib/backend/auditLog';
import { requireAdmin } from '@/lib/backend/requireAuth';

const mockCheckRateLimit = vi.mocked(checkRateLimit);
const mockResolveDisputeOnChain = vi.mocked(resolveDisputeOnChain);
const mockLogDisputeResolved = vi.mocked(logDisputeResolved);
const mockRecordAuditEvent = vi.mocked(recordAuditEvent);
const mockRequireAdmin = vi.mocked(requireAdmin);

const ADMIN_ADDRESS = 'GADMIN123456789';

const MOCK_RESOLVE_RESULT = {
  commitmentId: 'cmt-123',
  disputeId: 'dsp-abc',
  resolution: 'resolved_in_favor_of_owner',
  finalStatus: 'ACTIVE',
  txHash: '0xdeadbeef',
  resolvedAt: '2026-06-27T12:00:00.000Z',
};

function makeRequest(
  id: string,
  body?: Record<string, unknown>,
): [NextRequest, { params: { id: string } }] {
  const req = new NextRequest(`http://localhost/api/commitments/${id}/resolve`, {
    method: 'POST',
    headers: body ? { 'content-type': 'application/json' } : undefined,
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

describe('POST /api/commitments/[id]/resolve', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({ allowed: true, retryAfterSeconds: 60 } as any);
    mockResolveDisputeOnChain.mockResolvedValue(MOCK_RESOLVE_RESULT);
    mockRequireAdmin.mockReturnValue({ address: ADMIN_ADDRESS, isAdmin: true });
  });

  describe('200 - success', () => {
    it('resolves a dispute in favor of owner', async () => {
      const [req, ctx] = makeRequest('cmt-123', {
        resolution: 'resolved_in_favor_of_owner',
      });
      const res = await POST(req, ctx);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toEqual({
        commitmentId: 'cmt-123',
        disputeId: 'dsp-abc',
        resolution: 'resolved_in_favor_of_owner',
        finalStatus: 'ACTIVE',
        txHash: '0xdeadbeef',
        resolvedAt: '2026-06-27T12:00:00.000Z',
      });
      expect(body.meta).toBeUndefined();
    });

    it('resolves a dispute in favor of counterparty', async () => {
      mockResolveDisputeOnChain.mockResolvedValue({
        ...MOCK_RESOLVE_RESULT,
        resolution: 'resolved_in_favor_of_counterparty',
        finalStatus: 'SETTLED',
      });
      const [req, ctx] = makeRequest('cmt-123', {
        resolution: 'resolved_in_favor_of_counterparty',
      });
      const res = await POST(req, ctx);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.resolution).toBe('resolved_in_favor_of_counterparty');
      expect(body.data.finalStatus).toBe('SETTLED');
    });

    it('dismisses a dispute', async () => {
      mockResolveDisputeOnChain.mockResolvedValue({
        ...MOCK_RESOLVE_RESULT,
        resolution: 'dismissed',
        finalStatus: 'ACTIVE',
      });
      const [req, ctx] = makeRequest('cmt-123', { resolution: 'dismissed' });
      const res = await POST(req, ctx);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.resolution).toBe('dismissed');
    });

    it('includes optional notes', async () => {
      const [req, ctx] = makeRequest('cmt-123', {
        resolution: 'resolved_in_favor_of_owner',
        notes: 'After reviewing evidence, the claim is valid.',
      });
      await POST(req, ctx);

      expect(mockResolveDisputeOnChain).toHaveBeenCalledWith(
        expect.objectContaining({
          notes: 'After reviewing evidence, the claim is valid.',
        }),
      );
    });

    it('passes admin address as resolverAddress', async () => {
      const [req, ctx] = makeRequest('cmt-123', {
        resolution: 'resolved_in_favor_of_owner',
      });
      await POST(req, ctx);

      expect(mockResolveDisputeOnChain).toHaveBeenCalledWith(
        expect.objectContaining({ resolverAddress: ADMIN_ADDRESS }),
      );
    });

    it('records audit event with DISPUTE_RESOLVED', async () => {
      const [req, ctx] = makeRequest('cmt-123', {
        resolution: 'resolved_in_favor_of_owner',
      });
      await POST(req, ctx);

      expect(mockRecordAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'DISPUTE_RESOLVED',
          actorAddress: ADMIN_ADDRESS,
          commitmentId: 'cmt-123',
        }),
      );
    });

    it('logs dispute resolved on success', async () => {
      const [req, ctx] = makeRequest('cmt-123', {
        resolution: 'resolved_in_favor_of_owner',
      });
      await POST(req, ctx);

      expect(mockLogDisputeResolved).toHaveBeenCalledWith(
        expect.objectContaining({
          commitmentId: 'cmt-123',
          resolverAddress: ADMIN_ADDRESS,
        }),
      );
    });
  });

  describe('400 - validation errors', () => {
    it('rejects empty commitment id', async () => {
      const [req, ctx] = makeRequest('', { resolution: 'resolved_in_favor_of_owner' });
      await expectError(req, ctx, 400, 'VALIDATION_ERROR');
    });

    it('rejects missing request body', async () => {
      const req = new NextRequest('http://localhost/api/commitments/cmt-123/resolve', { method: 'POST' });
      await expectError(req, { params: { id: 'cmt-123' } }, 400, 'VALIDATION_ERROR');
    });

    it('rejects invalid JSON body', async () => {
      const req = new NextRequest('http://localhost/api/commitments/cmt-123/resolve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'not-json',
      });
      await expectError(req, { params: { id: 'cmt-123' } }, 400, 'VALIDATION_ERROR');
    });

    it('rejects missing resolution field', async () => {
      const [req, ctx] = makeRequest('cmt-123', {});
      await expectError(req, ctx, 400, 'VALIDATION_ERROR');
    });

    it('rejects invalid resolution value', async () => {
      const [req, ctx] = makeRequest('cmt-123', { resolution: 'invalid_value' });
      await expectError(req, ctx, 400, 'VALIDATION_ERROR');
    });

    it('rejects notes exceeding 1000 characters', async () => {
      const [req, ctx] = makeRequest('cmt-123', {
        resolution: 'resolved_in_favor_of_owner',
        notes: 'x'.repeat(1001),
      });
      await expectError(req, ctx, 400, 'VALIDATION_ERROR');
    });
  });

  describe('403 - forbidden / unauthorized', () => {
    it('returns 403 when requireAdmin throws ForbiddenError', async () => {
      mockRequireAdmin.mockImplementation(() => {
        throw new ForbiddenError('Admin access required');
      });
      const [req, ctx] = makeRequest('cmt-123', { resolution: 'resolved_in_favor_of_owner' });
      await expectError(req, ctx, 403, 'FORBIDDEN');
    });

    it('rejects request with invalid bearer token', async () => {
      mockRequireAdmin.mockImplementation(() => {
        throw new ForbiddenError('Admin access required');
      });
      const [req, ctx] = makeRequest('cmt-123', { resolution: 'resolved_in_favor_of_owner' });
      await expectError(req, ctx, 403, 'FORBIDDEN');
    });
  });

  describe('409 - conflict', () => {
    it('returns 409 when commitment is not in DISPUTED status', async () => {
      mockResolveDisputeOnChain.mockRejectedValue(
        new ConflictError('Can only resolve a commitment that is currently in dispute.'),
      );
      const [req, ctx] = makeRequest('cmt-123', { resolution: 'resolved_in_favor_of_owner' });
      await expectError(req, ctx, 409, 'CONFLICT');
    });
  });

  describe('429 - rate limited', () => {
    it('returns 429 when rate limit exceeded', async () => {
      mockCheckRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 60 } as any);
      const [req, ctx] = makeRequest('cmt-123', { resolution: 'resolved_in_favor_of_owner' });
      await expectError(req, ctx, 429, 'TOO_MANY_REQUESTS');
    });
  });

  describe('error logging', () => {
    it('logs error when resolve fails', async () => {
      mockResolveDisputeOnChain.mockRejectedValue(new Error('RPC failure'));
      const [req, ctx] = makeRequest('cmt-123', { resolution: 'resolved_in_favor_of_owner' });
      await POST(req, ctx);

      expect(mockLogDisputeResolved).toHaveBeenCalledWith(
        expect.objectContaining({
          commitmentId: 'cmt-123',
          error: 'RPC failure',
        }),
      );
    });
  });
});
