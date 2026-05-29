import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockRequest, parseResponse } from './helpers';

const MOCK_COMMITMENT = {
  id: 'CMT-001',
  ownerAddress: 'GOWNER1234567890',
  asset: 'XLM',
  amount: '50000',
  status: 'ACTIVE' as const,
  complianceScore: 95,
  currentValue: '52000',
  feeEarned: '200',
  violationCount: 0,
  createdAt: '2026-01-10T00:00:00.000Z',
  expiresAt: '2026-03-10T00:00:00.000Z',
};

const MOCK_DISPUTED_COMMITMENT = { ...MOCK_COMMITMENT, status: 'DISPUTED' as const };
const MOCK_SETTLED_COMMITMENT = { ...MOCK_COMMITMENT, status: 'SETTLED' as const };

function mockDeps(commitment: typeof MOCK_COMMITMENT | null) {
  const disputeResult = {
    commitmentId: 'CMT-001',
    disputeId: 'DSP-001',
    status: 'DISPUTED',
    txHash: '0xdispute123',
    disputedAt: new Date().toISOString(),
  };

  vi.doMock('@/lib/backend/services/contracts', () => ({
    getCommitmentFromChain: commitment
      ? vi.fn().mockResolvedValue(commitment)
      : vi.fn().mockRejectedValue(new Error('not found')),
    openDisputeOnChain: vi.fn().mockResolvedValue(disputeResult),
  }));

  vi.doMock('@/lib/backend/logger', () => ({
    logDisputeOpened: vi.fn(),
    logInfo: vi.fn(),
    logWarn: vi.fn(),
    logError: vi.fn(),
    logDebug: vi.fn(),
  }));

  vi.doMock('@/lib/backend/auditLog', () => ({
    recordAuditEvent: vi.fn().mockReturnValue({
      id: 'audit-001',
      eventType: 'DISPUTE_OPENED',
      timestamp: new Date().toISOString(),
      actorAddress: 'GOWNER1234567890',
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
}

function makeRequest(id: string, body?: Record<string, unknown>) {
  return createMockRequest(
    `http://localhost:3000/api/commitments/${id}/dispute`,
    { method: 'POST', body },
  );
}

async function callRoute(id: string, body: Record<string, unknown>) {
  const { POST } = await import('@/app/api/commitments/[id]/dispute/route');
  const req = makeRequest(id, body);
  const res = await POST(req, { params: { id } });
  return parseResponse(res);
}

describe('POST /api/commitments/[id]/dispute', () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { vi.resetModules(); });

  it('returns 200 on successful dispute', async () => {
    mockDeps(MOCK_COMMITMENT);
    const result = await callRoute('CMT-001', { reason: 'Payment not received' });
    expect(result.status).toBe(200);
    expect(result.data.success).toBe(true);
    expect(result.data.data.commitmentId).toBe('CMT-001');
    expect(result.data.data.disputeId).toBe('DSP-001');
    expect(result.data.data.status).toBe('DISPUTED');
    expect(result.data.data.txHash).toBe('0xdispute123');
    expect(result.data.data.disputedAt).toBeDefined();
  });

  it('accepts optional evidence field', async () => {
    mockDeps(MOCK_COMMITMENT);
    const result = await callRoute('CMT-001', {
      reason: 'Payment not received',
      evidence: 'https://example.com/proof',
    });
    expect(result.status).toBe(200);
    expect(result.data.success).toBe(true);
  });

  it('accepts optional callerAddress field', async () => {
    mockDeps(MOCK_COMMITMENT);
    const result = await callRoute('CMT-001', {
      reason: 'Test dispute',
      callerAddress: 'GCALLER123',
    });
    expect(result.status).toBe(200);
    expect(result.data.success).toBe(true);
  });

  it('returns 400 when reason is missing', async () => {
    mockDeps(MOCK_COMMITMENT);
    const result = await callRoute('CMT-001', {});
    expect(result.status).toBe(400);
    expect(result.data.success).toBe(false);
    expect(result.data.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when reason is empty', async () => {
    mockDeps(MOCK_COMMITMENT);
    const result = await callRoute('CMT-001', { reason: '' });
    expect(result.status).toBe(400);
    expect(result.data.success).toBe(false);
  });

  it('returns 400 when reason exceeds max length', async () => {
    mockDeps(MOCK_COMMITMENT);
    const result = await callRoute('CMT-001', { reason: 'A'.repeat(501) });
    expect(result.status).toBe(400);
    expect(result.data.success).toBe(false);
  });

  it('returns 400 when commitment ID is empty', async () => {
    mockDeps(MOCK_COMMITMENT);
    const result = await callRoute('', { reason: 'Test' });
    expect(result.status).toBe(400);
    expect(result.data.success).toBe(false);
  });

  it('response includes all required fields', async () => {
    mockDeps(MOCK_COMMITMENT);
    const result = await callRoute('CMT-001', { reason: 'Test dispute' });
    expect(result.data.data).toHaveProperty('commitmentId');
    expect(result.data.data).toHaveProperty('disputeId');
    expect(result.data.data).toHaveProperty('status');
    expect(result.data.data).toHaveProperty('disputedAt');
  });
});
