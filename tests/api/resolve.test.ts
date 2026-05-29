import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockRequest, parseResponse } from './helpers';

const MOCK_DISPUTED_COMMITMENT = {
  id: 'CMT-001',
  ownerAddress: 'GOWNER1234567890',
  asset: 'XLM',
  amount: '50000',
  status: 'DISPUTED' as const,
  complianceScore: 95,
  currentValue: '52000',
  feeEarned: '200',
  violationCount: 0,
  createdAt: '2026-01-10T00:00:00.000Z',
  expiresAt: '2026-03-10T00:00:00.000Z',
};

const MOCK_ACTIVE_COMMITMENT = { ...MOCK_DISPUTED_COMMITMENT, status: 'ACTIVE' as const };
const MOCK_ADMIN_ADDRESS = 'GADMIN1234567890';

function mockDeps(commitment: typeof MOCK_DISPUTED_COMMITMENT | null, resolution: string = 'resolved_in_favor_of_owner') {
  const resolveResult = {
    commitmentId: 'CMT-001',
    disputeId: 'DSP-001',
    resolution,
    finalStatus: 'ACTIVE',
    txHash: '0xresolve123',
    resolvedAt: new Date().toISOString(),
  };

  vi.doMock('@/lib/backend/services/contracts', () => ({
    getCommitmentFromChain: commitment
      ? vi.fn().mockResolvedValue(commitment)
      : vi.fn().mockRejectedValue(new Error('not found')),
    resolveDisputeOnChain: vi.fn().mockResolvedValue(resolveResult),
  }));

  vi.doMock('@/lib/backend/logger', () => ({
    logDisputeResolved: vi.fn(),
    logInfo: vi.fn(),
    logWarn: vi.fn(),
    logError: vi.fn(),
    logDebug: vi.fn(),
  }));

  vi.doMock('@/lib/backend/auditLog', () => ({
    recordAuditEvent: vi.fn().mockReturnValue({
      id: 'audit-001',
      eventType: 'DISPUTE_RESOLVED',
      timestamp: new Date().toISOString(),
      actorAddress: MOCK_ADMIN_ADDRESS,
      commitmentId: 'CMT-001',
      details: {},
    }),
  }));

  vi.doMock('@/lib/backend/cache/factory', () => ({
    cache: {
      delete: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
    },
  }));

  vi.doMock('@/lib/backend/rateLimit', () => ({
    checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 }),
  }));

  vi.doMock('@/lib/backend/getClientIp', () => ({
    getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  }));

  vi.doMock('@/lib/backend/requireAuth', () => ({
    requireAdmin: vi.fn().mockReturnValue({
      address: MOCK_ADMIN_ADDRESS,
      isAdmin: true,
    }),
  }));
}

function makeRequest(id: string, body?: Record<string, unknown>) {
  return createMockRequest(
    `http://localhost:3000/api/commitments/${id}/resolve`,
    { method: 'POST', body },
  );
}

async function callRoute(id: string, body: Record<string, unknown>) {
  const { POST } = await import('@/app/api/commitments/[id]/resolve/route');
  const req = makeRequest(id, body);
  const res = await POST(req, { params: { id } });
  return parseResponse(res);
}

describe('POST /api/commitments/[id]/resolve', () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { vi.resetModules(); });

  it('returns 200 on successful resolution', async () => {
    mockDeps(MOCK_DISPUTED_COMMITMENT, 'resolved_in_favor_of_owner');
    const result = await callRoute('CMT-001', { resolution: 'resolved_in_favor_of_owner' });
    expect(result.status).toBe(200);
    expect(result.data.success).toBe(true);
    expect(result.data.data.commitmentId).toBe('CMT-001');
    expect(result.data.data.disputeId).toBe('DSP-001');
    expect(result.data.data.resolution).toBe('resolved_in_favor_of_owner');
    expect(result.data.data.finalStatus).toBe('ACTIVE');
    expect(result.data.data.txHash).toBe('0xresolve123');
    expect(result.data.data.resolvedAt).toBeDefined();
  });

  it('accepts resolved_in_favor_of_counterparty resolution', async () => {
    mockDeps(MOCK_DISPUTED_COMMITMENT, 'resolved_in_favor_of_counterparty');
    const result = await callRoute('CMT-001', {
      resolution: 'resolved_in_favor_of_counterparty',
    });
    expect(result.status).toBe(200);
    expect(result.data.data.resolution).toBe('resolved_in_favor_of_counterparty');
  });

  it('accepts dismissed resolution', async () => {
    mockDeps(MOCK_DISPUTED_COMMITMENT, 'dismissed');
    const result = await callRoute('CMT-001', { resolution: 'dismissed' });
    expect(result.status).toBe(200);
    expect(result.data.data.resolution).toBe('dismissed');
  });

  it('accepts optional notes field', async () => {
    mockDeps(MOCK_DISPUTED_COMMITMENT);
    const result = await callRoute('CMT-001', {
      resolution: 'dismissed',
      notes: 'Insufficient evidence provided',
    });
    expect(result.status).toBe(200);
    expect(result.data.success).toBe(true);
  });

  it('returns 400 when resolution is missing', async () => {
    mockDeps(MOCK_DISPUTED_COMMITMENT);
    const result = await callRoute('CMT-001', {});
    expect(result.status).toBe(400);
    expect(result.data.success).toBe(false);
    expect(result.data.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when resolution is invalid', async () => {
    mockDeps(MOCK_DISPUTED_COMMITMENT);
    const result = await callRoute('CMT-001', { resolution: 'invalid_resolution' });
    expect(result.status).toBe(400);
    expect(result.data.success).toBe(false);
  });

  it('returns 400 when notes exceeds max length', async () => {
    mockDeps(MOCK_DISPUTED_COMMITMENT);
    const result = await callRoute('CMT-001', {
      resolution: 'dismissed',
      notes: 'A'.repeat(1001),
    });
    expect(result.status).toBe(400);
    expect(result.data.success).toBe(false);
  });

  it('returns 400 when commitment ID is empty', async () => {
    mockDeps(MOCK_DISPUTED_COMMITMENT);
    const result = await callRoute('', { resolution: 'dismissed' });
    expect(result.status).toBe(400);
    expect(result.data.success).toBe(false);
  });

  it('response includes all required fields', async () => {
    mockDeps(MOCK_DISPUTED_COMMITMENT);
    const result = await callRoute('CMT-001', { resolution: 'dismissed' });
    expect(result.data.data).toHaveProperty('commitmentId');
    expect(result.data.data).toHaveProperty('disputeId');
    expect(result.data.data).toHaveProperty('resolution');
    expect(result.data.data).toHaveProperty('finalStatus');
    expect(result.data.data).toHaveProperty('resolvedAt');
  });

  it('records audit event on successful resolution', async () => {
    const mockRecordAuditEvent = vi.fn().mockReturnValue({
      id: 'audit-001',
      eventType: 'DISPUTE_RESOLVED',
      timestamp: new Date().toISOString(),
      actorAddress: MOCK_ADMIN_ADDRESS,
      commitmentId: 'CMT-001',
      details: {},
    });

    vi.doMock('@/lib/backend/services/contracts', () => ({
      getCommitmentFromChain: vi.fn().mockResolvedValue(MOCK_DISPUTED_COMMITMENT),
      resolveDisputeOnChain: vi.fn().mockResolvedValue({
        commitmentId: 'CMT-001',
        disputeId: 'DSP-001',
        resolution: 'dismissed',
        finalStatus: 'ACTIVE',
        txHash: '0xresolve123',
        resolvedAt: new Date().toISOString(),
      }),
    }));
    vi.doMock('@/lib/backend/logger', () => ({
      logDisputeResolved: vi.fn(),
      logInfo: vi.fn(),
      logWarn: vi.fn(),
      logError: vi.fn(),
      logDebug: vi.fn(),
    }));
    vi.doMock('@/lib/backend/auditLog', () => ({
      recordAuditEvent: mockRecordAuditEvent,
    }));
    vi.doMock('@/lib/backend/cache/factory', () => ({
      cache: { delete: vi.fn(), get: vi.fn(), set: vi.fn() },
    }));
    vi.doMock('@/lib/backend/rateLimit', () => ({
      checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 }),
    }));
    vi.doMock('@/lib/backend/getClientIp', () => ({
      getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
    }));
    vi.doMock('@/lib/backend/requireAuth', () => ({
      requireAdmin: vi.fn().mockReturnValue({
        address: MOCK_ADMIN_ADDRESS,
        isAdmin: true,
      }),
    }));

    const { POST } = await import('@/app/api/commitments/[id]/resolve/route');
    const req = makeRequest('CMT-001', { resolution: 'dismissed' });
    await POST(req, { params: { id: 'CMT-001' } });

    expect(mockRecordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'DISPUTE_RESOLVED',
        actorAddress: MOCK_ADMIN_ADDRESS,
        commitmentId: 'CMT-001',
      }),
    );
  });
});
