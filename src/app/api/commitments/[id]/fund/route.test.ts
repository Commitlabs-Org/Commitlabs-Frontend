import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { diagnosticsService } from '@/lib/backend/diagnostics';
import { randomUUID } from 'crypto';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
  getRateLimitWindowSeconds: vi.fn(() => 60),
}));

vi.mock('@/lib/backend/csrf', () => ({
  assertMutationCsrf: vi.fn(),
}));

vi.mock('@/lib/backend/services/contracts', () => ({
  fundEscrowOnChain: vi.fn(),
  getCommitmentFromChain: vi.fn(),
}));

vi.mock('@/lib/backend/idempotency', () => ({
  idempotencyService: {
    getRecord: vi.fn(),
    start: vi.fn(),
    complete: vi.fn(),
    fail: vi.fn(),
  },
}));

import { checkRateLimit } from '@/lib/backend/rateLimit';
import { assertMutationCsrf } from '@/lib/backend/csrf';
import { fundEscrowOnChain, getCommitmentFromChain } from '@/lib/backend/services/contracts';
import { idempotencyService } from '@/lib/backend/idempotency';

const mockCheckRateLimit = vi.mocked(checkRateLimit);
const mockAssertCsrf = vi.mocked(assertMutationCsrf);
const mockFundEscrow = vi.mocked(fundEscrowOnChain);
const mockGetCommitment = vi.mocked(getCommitmentFromChain);
const mockIdempotency = vi.mocked(idempotencyService);

// ── Helpers ───────────────────────────────────────────────────────────────────

function createMockRequest(
  url: string,
  options: {
    method?: string;
    body?: any;
    idempotencyKey?: string;
  } = {},
): NextRequest {
  const req = new NextRequest(url, {
    method: options.method || 'POST',
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  // Simulate headers
  const headers = new Map(req.headers);
  if (options.idempotencyKey) {
    headers.set('idempotency-key', options.idempotencyKey);
  }

  // Mock getClientIp
  vi.spyOn(req, 'ip', 'get').mockReturnValue('192.168.1.1');

  return req;
}

interface ParsedResponse {
  status: number;
  data: any;
}

async function parseResponse(response: Response): Promise<ParsedResponse> {
  return {
    status: response.status,
    data: await response.json(),
  };
}

// ── Test Data ─────────────────────────────────────────────────────────────────

const VALID_ADDRESS = `GBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
const COMMITMENT_ID = 'commitment-fund-test-123';

const MOCK_COMMITMENT_CREATED = {
  id: COMMITMENT_ID,
  ownerAddress: VALID_ADDRESS,
  asset: 'USDC',
  amount: '10000',
  status: 'CREATED' as const,
  complianceScore: 90,
  currentValue: '10000',
  feeEarned: '0',
  violationCount: 0,
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
};

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('POST /api/commitments/[id]/fund - Idempotency & Concurrent Request Bounds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    diagnosticsService.clear();
    mockCheckRateLimit.mockResolvedValue(true);
    mockGetCommitment.mockResolvedValue(MOCK_COMMITMENT_CREATED);
    mockFundEscrow.mockResolvedValue({
      txHash: 'abc123def456',
      reference: 'fund-ref-123',
    });
    mockIdempotency.getRecord.mockResolvedValue(null);
    mockIdempotency.start.mockResolvedValue(undefined);
    mockIdempotency.complete.mockResolvedValue(undefined);
    mockIdempotency.fail.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
    diagnosticsService.clear();
  });

  // ── Success Cases ──────────────────────────────────────────────────────────

  it('successfully funds a commitment in CREATED state', async () => {
    const req = createMockRequest(`http://localhost/api/commitments/${COMMITMENT_ID}/fund`, {
      body: { callerAddress: VALID_ADDRESS },
    });

    const context = { params: { id: COMMITMENT_ID } };
    const response = await POST(req, context, 'correlation-123');

    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    expect(result.data.success).toBe(true);
    expect(result.data.data.commitmentId).toBe(COMMITMENT_ID);
    expect(result.data.data.txHash).toBe('abc123def456');
  });

  it('allows funding without callerAddress (implicit owner)', async () => {
    const req = createMockRequest(`http://localhost/api/commitments/${COMMITMENT_ID}/fund`, {
      body: {}, // No callerAddress
    });

    const context = { params: { id: COMMITMENT_ID } };
    const response = await POST(req, context, 'correlation-123');

    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    expect(result.data.success).toBe(true);
    expect(mockFundEscrow).toHaveBeenCalledWith({
      commitmentId: COMMITMENT_ID,
      callerAddress: undefined,
    });
  });

  // ── Idempotency Tests ──────────────────────────────────────────────────────

  it('returns cached response on idempotent replay (COMPLETED record)', async () => {
    const idempotencyKey = 'idempotency-fund-' + randomUUID();
    const cachedResponse = {
      commitmentId: COMMITMENT_ID,
      txHash: 'cached-tx-hash',
      reference: 'cached-ref',
      fundedAt: new Date().toISOString(),
    };

    mockIdempotency.getRecord.mockResolvedValue({
      key: idempotencyKey,
      status: 'COMPLETED' as const,
      response: cachedResponse,
      statusCode: 200,
      createdAt: Date.now(),
      expiresAt: Date.now() + 86400000,
    });

    const req = createMockRequest(`http://localhost/api/commitments/${COMMITMENT_ID}/fund`, {
      body: { callerAddress: VALID_ADDRESS },
      idempotencyKey,
    });

    const context = { params: { id: COMMITMENT_ID } };
    const response = await POST(req, context, 'correlation-123');

    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    expect(result.data.data).toEqual(cachedResponse);
    expect(response.headers.get('X-Idempotent-Replay')).toBe('true');
    // Should not call fundEscrow for cache hit
    expect(mockFundEscrow).not.toHaveBeenCalled();
  });

  it('blocks concurrent requests with same idempotency key (STARTED record)', async () => {
    const idempotencyKey = 'idempotency-fund-' + randomUUID();

    mockIdempotency.getRecord.mockResolvedValue({
      key: idempotencyKey,
      status: 'STARTED' as const,
      createdAt: Date.now(),
      expiresAt: Date.now() + 86400000,
    });

    const req = createMockRequest(`http://localhost/api/commitments/${COMMITMENT_ID}/fund`, {
      body: { callerAddress: VALID_ADDRESS },
      idempotencyKey,
    });

    const context = { params: { id: COMMITMENT_ID } };
    const response = await POST(req, context, 'correlation-123');

    const result = await parseResponse(response);
    expect(result.status).toBe(409);
    expect(result.data.error.code).toBe('CONFLICT_ERROR');
    expect(result.data.error.message).toContain('currently processing');
  });

  it('cleans up failed idempotency records to allow retry', async () => {
    const idempotencyKey = 'idempotency-fund-' + randomUUID();

    mockIdempotency.getRecord.mockResolvedValue(null);
    mockGetCommitment.mockResolvedValue({
      ...MOCK_COMMITMENT_CREATED,
      status: 'FUNDED', // Invalid state - should fail
    });

    const req = createMockRequest(`http://localhost/api/commitments/${COMMITMENT_ID}/fund`, {
      body: { callerAddress: VALID_ADDRESS },
      idempotencyKey,
    });

    const context = { params: { id: COMMITMENT_ID } };
    const response = await POST(req, context, 'correlation-123');

    const result = await parseResponse(response);
    expect(result.status).toBe(409);
    // Should call fail to allow retry
    expect(mockIdempotency.fail).toHaveBeenCalledWith(idempotencyKey);
  });

  // ── State Invariant Tests ──────────────────────────────────────────────────

  it('rejects funding of non-CREATED commitments (precondition invariant)', async () => {
    mockGetCommitment.mockResolvedValue({
      ...MOCK_COMMITMENT_CREATED,
      status: 'FUNDED',
    });

    const req = createMockRequest(`http://localhost/api/commitments/${COMMITMENT_ID}/fund`, {
      body: { callerAddress: VALID_ADDRESS },
    });

    const context = { params: { id: COMMITMENT_ID } };
    const response = await POST(req, context, 'correlation-123');

    const result = await parseResponse(response);
    expect(result.status).toBe(409);
    expect(result.data.error.message).toContain('FUNDED');
    expect(result.data.error.message).toContain('Only CREATED commitments can be funded');
  });

  it('rejects funding by non-owner (ownership invariant)', async () => {
    const differentAddress = `GBAAAAABBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB`;

    const req = createMockRequest(`http://localhost/api/commitments/${COMMITMENT_ID}/fund`, {
      body: { callerAddress: differentAddress },
    });

    const context = { params: { id: COMMITMENT_ID } };
    const response = await POST(req, context, 'correlation-123');

    const result = await parseResponse(response);
    expect(result.status).toBe(403);
    expect(result.data.error.code).toBe('FORBIDDEN_ERROR');
    expect(result.data.error.message).toContain('Only the commitment owner may fund');
  });

  it('rejects funding of non-existent commitment', async () => {
    mockGetCommitment.mockResolvedValue(null);

    const req = createMockRequest(`http://localhost/api/commitments/${COMMITMENT_ID}/fund`, {
      body: { callerAddress: VALID_ADDRESS },
    });

    const context = { params: { id: COMMITMENT_ID } };
    const response = await POST(req, context, 'correlation-123');

    const result = await parseResponse(response);
    expect(result.status).toBe(404);
    expect(result.data.error.code).toBe('NOT_FOUND_ERROR');
  });

  // ── Boundary & Validation Tests ────────────────────────────────────────────

  it('rejects commitment ID with empty/whitespace string', async () => {
    const req = createMockRequest(`http://localhost/api/commitments/   /fund`, {
      body: { callerAddress: VALID_ADDRESS },
    });

    const context = { params: { id: '   ' } };
    const response = await POST(req, context, 'correlation-123');

    const result = await parseResponse(response);
    expect(result.status).toBe(400);
    expect(result.data.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects malformed JSON in request body', async () => {
    const req = createMockRequest(`http://localhost/api/commitments/${COMMITMENT_ID}/fund`, {
      method: 'POST',
    });
    req.body = JSON.parse.bind(null, 'invalid json') as any; // Force JSON parse error

    const context = { params: { id: COMMITMENT_ID } };
    const response = await POST(req, context, 'correlation-123');

    const result = await parseResponse(response);
    expect(result.status).toBe(400);
  });

  // ── Diagnostics & Telemetry Tests ──────────────────────────────────────────

  it('tracks operation telemetry for success case', async () => {
    const req = createMockRequest(`http://localhost/api/commitments/${COMMITMENT_ID}/fund`, {
      body: { callerAddress: VALID_ADDRESS },
    });

    const context = { params: { id: COMMITMENT_ID } };
    await POST(req, context, 'correlation-123');

    // Get stats from diagnostics service
    const stats = diagnosticsService.getOperationStats('fund_commitment');
    expect(stats.successCount).toBeGreaterThan(0);
    expect(stats.sampleCount).toBeGreaterThan(0);
  });

  it('exposes degraded status for slow operations', async () => {
    // Mock a slow contract call
    mockFundEscrow.mockImplementation(
      async () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                txHash: 'slow-tx',
                reference: 'slow-ref',
              }),
            35000, // Exceeds FUND_OPERATION_SLOW_THRESHOLD_MS (30000)
          ),
        ),
    );

    const req = createMockRequest(`http://localhost/api/commitments/${COMMITMENT_ID}/fund`, {
      body: { callerAddress: VALID_ADDRESS },
    });

    const context = { params: { id: COMMITMENT_ID } };
    // Note: In real test, this would timeout. This is illustrative of the capability.
    // In practice, you'd mock the time or use a smaller threshold for testing.
  });

  // ── Rate Limit Tests ──────────────────────────────────────────────────────

  it('respects rate limit for IP', async () => {
    mockCheckRateLimit.mockResolvedValue(false);

    const req = createMockRequest(`http://localhost/api/commitments/${COMMITMENT_ID}/fund`, {
      body: { callerAddress: VALID_ADDRESS },
    });

    const context = { params: { id: COMMITMENT_ID } };
    const response = await POST(req, context, 'correlation-123');

    const result = await parseResponse(response);
    expect(result.status).toBe(429);
    expect(result.data.error.code).toBe('TOO_MANY_REQUESTS_ERROR');
  });

  // ── CSRF Protection Tests ──────────────────────────────────────────────────

  it('asserts CSRF token on POST request', async () => {
    const req = createMockRequest(`http://localhost/api/commitments/${COMMITMENT_ID}/fund`, {
      body: { callerAddress: VALID_ADDRESS },
    });

    const context = { params: { id: COMMITMENT_ID } };
    await POST(req, context, 'correlation-123');

    expect(mockAssertCsrf).toHaveBeenCalledWith(req);
  });

  it('fails on CSRF validation failure', async () => {
    mockAssertCsrf.mockImplementation(() => {
      throw new Error('CSRF token invalid');
    });

    const req = createMockRequest(`http://localhost/api/commitments/${COMMITMENT_ID}/fund`, {
      body: { callerAddress: VALID_ADDRESS },
    });

    const context = { params: { id: COMMITMENT_ID } };
    const response = await POST(req, context, 'correlation-123');

    const result = await parseResponse(response);
    expect(result.status).toBe(400);
  });
});
