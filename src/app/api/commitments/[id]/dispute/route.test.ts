import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { ValidationError, NotFoundError, ConflictError, TooManyRequestsError } from '@/lib/backend/errors';

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn(),
}));
vi.mock('@/lib/backend/services/contracts', () => ({
  openDisputeOnChain: vi.fn(),
}));
vi.mock('@/lib/backend/logger', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/backend/logger')>();
  return { ...actual, logDisputeOpened: vi.fn() };
});
vi.mock('@/lib/backend/auditLog', () => ({
  recordAuditEvent: vi.fn(),
}));

import { checkRateLimit } from '@/lib/backend/rateLimit';
import { openDisputeOnChain } from '@/lib/backend/services/contracts';
import { logDisputeOpened } from '@/lib/backend/logger';
import { recordAuditEvent } from '@/lib/backend/auditLog';

const mockCheckRateLimit = vi.mocked(checkRateLimit);
const mockOpenDisputeOnChain = vi.mocked(openDisputeOnChain);
const mockLogDisputeOpened = vi.mocked(logDisputeOpened);
const mockRecordAuditEvent = vi.mocked(recordAuditEvent);

const MOCK_DISPUTE_RESULT = {
  commitmentId: 'cmt-123',
  disputeId: 'dsp-abc',
  status: 'DISPUTED',
  txHash: '0xdeadbeef',
  disputedAt: '2026-06-27T12:00:00.000Z',
};

function makeRequest(
  id: string,
  body?: Record<string, unknown>,
): [NextRequest, { params: { id: string } }] {
  const req = new NextRequest(`http://localhost/api/commitments/${id}/dispute`, {
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

describe('POST /api/commitments/[id]/dispute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({ allowed: true, retryAfterSeconds: 60 } as any);
    mockOpenDisputeOnChain.mockResolvedValue(MOCK_DISPUTE_RESULT);
  });

  describe('200 - success', () => {
    it('opens a dispute with reason', async () => {
      const [req, ctx] = makeRequest('cmt-123', { reason: 'Counterparty breached terms' });
      const res = await POST(req, ctx);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toEqual({
        commitmentId: 'cmt-123',
        disputeId: 'dsp-abc',
        status: 'DISPUTED',
        txHash: '0xdeadbeef',
        disputedAt: '2026-06-27T12:00:00.000Z',
      });
      expect(body.meta).toBeUndefined();
    });

    it('passes evidence and callerAddress to the contract', async () => {
      const [req, ctx] = makeRequest('cmt-123', {
        reason: 'Breach',
        evidence: 'screenshot.png',
        callerAddress: 'GABCDEF123',
      });
      await POST(req, ctx);

      expect(mockOpenDisputeOnChain).toHaveBeenCalledWith({
        commitmentId: 'cmt-123',
        reason: 'Breach',
        evidence: 'screenshot.png',
        callerAddress: 'GABCDEF123',
      });
    });

    it('defaults callerAddress to empty string when omitted', async () => {
      const [req, ctx] = makeRequest('cmt-123', { reason: 'Test' });
      await POST(req, ctx);

      expect(mockOpenDisputeOnChain).toHaveBeenCalledWith(
        expect.objectContaining({ callerAddress: '' }),
      );
    });

    it('records audit event with DISPUTE_OPENED', async () => {
      const [req, ctx] = makeRequest('cmt-123', { reason: 'Test' });
      await POST(req, ctx);

      expect(mockRecordAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'DISPUTE_OPENED',
          commitmentId: 'cmt-123',
        }),
      );
      expect(mockRecordAuditEvent).toHaveBeenCalledTimes(1);
    });

    it('logs dispute opened on success', async () => {
      const [req, ctx] = makeRequest('cmt-123', { reason: 'Test reason' });
      await POST(req, ctx);

      expect(mockLogDisputeOpened).toHaveBeenCalledWith(
        expect.objectContaining({
          commitmentId: 'cmt-123',
          reason: 'Test reason',
        }),
      );
    });
  });

  describe('400 - validation errors', () => {
    it('rejects empty commitment id', async () => {
      const [req, ctx] = makeRequest('', { reason: 'Test' });
      await expectError(req, ctx, 400, 'VALIDATION_ERROR');
    });

    it('rejects whitespace-only id', async () => {
      const [req, ctx] = makeRequest('   ', { reason: 'Test' });
      await expectError(req, ctx, 400, 'VALIDATION_ERROR');
    });

    it('rejects missing request body', async () => {
      const req = new NextRequest('http://localhost/api/commitments/cmt-123/dispute', { method: 'POST' });
      await expectError(req, { params: { id: 'cmt-123' } }, 400, 'VALIDATION_ERROR');
    });

    it('rejects invalid JSON body', async () => {
      const req = new NextRequest('http://localhost/api/commitments/cmt-123/dispute', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'not-json',
      });
      await expectError(req, { params: { id: 'cmt-123' } }, 400, 'VALIDATION_ERROR');
    });

    it('rejects missing reason', async () => {
      const [req, ctx] = makeRequest('cmt-123', {});
      await expectError(req, ctx, 400, 'VALIDATION_ERROR');
    });

    it('rejects empty reason', async () => {
      const [req, ctx] = makeRequest('cmt-123', { reason: '' });
      await expectError(req, ctx, 400, 'VALIDATION_ERROR');
    });

    it('rejects reason exceeding 500 characters', async () => {
      const [req, ctx] = makeRequest('cmt-123', { reason: 'x'.repeat(501) });
      await expectError(req, ctx, 400, 'VALIDATION_ERROR');
    });
  });

  describe('404 - not found', () => {
    it('returns 404 when openDisputeOnChain throws NotFoundError', async () => {
      mockOpenDisputeOnChain.mockRejectedValue(new NotFoundError('Commitment'));
      const [req, ctx] = makeRequest('nonexistent', { reason: 'Test' });
      await expectError(req, ctx, 404, 'NOT_FOUND');
    });
  });

  describe('409 - conflict', () => {
    it('returns 409 when commitment is already in dispute', async () => {
      mockOpenDisputeOnChain.mockRejectedValue(
        new ConflictError('Commitment is already in dispute.'),
      );
      const [req, ctx] = makeRequest('cmt-123', { reason: 'Test' });
      await expectError(req, ctx, 409, 'CONFLICT');
    });

    it('returns 409 when commitment is settled', async () => {
      mockOpenDisputeOnChain.mockRejectedValue(
        new ConflictError('Cannot dispute a commitment that is already settled or exited.'),
      );
      const [req, ctx] = makeRequest('cmt-123', { reason: 'Test' });
      await expectError(req, ctx, 409, 'CONFLICT');
    });
  });

  describe('429 - rate limited', () => {
    it('returns 429 when rate limit exceeded', async () => {
      mockCheckRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 60 } as any);
      const [req, ctx] = makeRequest('cmt-123', { reason: 'Test' });
      await expectError(req, ctx, 429, 'TOO_MANY_REQUESTS');
    });
  });

  describe('error logging', () => {
    it('logs error when dispute fails', async () => {
      mockOpenDisputeOnChain.mockRejectedValue(new Error('RPC failure'));
      const [req, ctx] = makeRequest('cmt-123', { reason: 'Test' });
      await POST(req, ctx);

      expect(mockLogDisputeOpened).toHaveBeenCalledWith(
        expect.objectContaining({
          commitmentId: 'cmt-123',
          error: 'RPC failure',
        }),
      );
    });
  });
});
