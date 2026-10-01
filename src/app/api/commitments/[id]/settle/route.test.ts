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
  settleCommitmentOnChain: vi.fn(),
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

vi.mock('@/lib/backend/logger', () => ({
  logCommitmentSettled: vi.fn(),
}));

import { checkRateLimit } from '@/lib/backend/rateLimit';
import { assertMutationCsrf } from '@/lib/backend/csrf';
import { settleCommitmentOnChain, getCommitmentFromChain } from '@/lib/backend/services/contracts';
import { idempotencyService } from '@/lib/backend/idempotency';
import { logCommitmentSettled } from '@/lib/backend/logger';

const mockCheckRateLimit = vi.mocked(checkRateLimit);
const mockAssertCsrf = vi.mocked(assertMutationCsrf);
const mockSettleCommitment = vi.mocked(settleCommitmentOnChain);
const mockGetCommitment = vi.mocked(getCommitmentFromChain);
const mockIdempotency = vi.mocked(idempotencyService);
const mockLogSettled = vi.mocked(logCommitmentSettled);

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

  if (options.idempotencyKey) {
    const headers = new Headers(req.headers);
    headers.set('idempotency-key', options.idempotencyKey);
    return new NextRequest(url, {
      method: options.method || 'POST',
      body: options.body ? JSON.stringify(options.body) : undefined,
      headers,
    });
  }

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
const DIFFERENT_ADDRESS = `GBAAAAABBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB`;
const COMMITMENT_ID = 'commitment-settle-test-123';

const MOCK_COMMITMENT_ACTIVE = {
  id: COMMITMENT_ID,
  ownerAddress: VALID_ADDRESS,
  asset: 'USDC',
  amount: '10000',
  status: 'ACTIVE' as const,
  complianceScore: 90,
  currentValue: '10500',
  feeEarned: '500',
  violationCount: 0,
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
};

const MOCK_COMMITMENT_FUNDED = {
  ...MOCK_COMMITMENT_ACTIVE,
  status: 'FUNDED' as const,
};

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('POST /api/commitments/[id]/settle - Authorization & Boundary Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    diagnosticsService.clear();
    mockCheckRateLimit.mockResolvedValue(true);
    mockGetCommitment.mockResolvedValue(MOCK_COMMITMENT_ACTIVE);
    mockSettleCommitment.mockResolvedValue({
      settlementAmount: '10500',
      finalStatus: 'SETTLED',
      txHash: 'abc123def456789012345678901234567890123456789012345678901234',
      reference: 'settle-ref-123',
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

  it('successfully settles a commitment from ACTIVE state', async () => {
    const req = createMockRequest(`http://localhost/api/commitments/${COMMITMENT_ID}/settle`, {
      body: { callerAddress: VALID_ADDRESS },
    });

    const context = { params: { id: COMMITMENT_ID } };
    const response = await POST(req, context, 'correlation-123');

    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    expect(result.data.success).toBe(true);
    expect(result.data.data.commitmentId).toBe(COMMITMENT_ID);
    expect(result.data.data.settlementAmount).toBe('10500');
    expect(result.data.data.finalStatus).toBe('SETTLED');
  });

  it('successfully settles a commitment from FUNDED state', async () => {
    mockGetCommitment.mockResolvedValue(MOCK_COMMITMENT_FUNDED);

    const req = createMockRequest(`http://localhost/api/commitments/${COMMITMENT_ID}/settle`, {
      body: { callerAddress: VALID_ADDRESS },
    });

    const context = { params: { id: COMMITMENT_ID } };
    const response = await POST(req, context, 'correlation-123');

    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    expect(result.data.success).toBe(true);
  });

  // ── Authorization Boundary Tests ──────────────────────────────────────────

  it('rejects settlement by non-owner (ownership verification)', async () => {
    const req = createMockRequest(`http://localhost/api/commitments/${COMMITMENT_ID}/settle`, {
      body: { callerAddress: DIFFERENT_ADDRESS },
    });

    const context = { params: { id: COMMITMENT_ID } };
    const response = await POST(req, context, 'correlation-123');

    const result = await parseResponse(response);
    expect(result.status).toBe(403);
    expect(result.data.error.code).toBe('FORBIDDEN_ERROR');
    expect(result.data.error.message).toContain('Ownership verification failed');
  });

  it('records authorization failure in diagnostics', async () => {
    mockGetCommitment.mockResolvedValue(MOCK_COMMITMENT_ACTIVE);

    const req = createMockRequest(`http://localhost/api/commitments/${COMMITMENT_ID}/settle`, {
      body: { callerAddress: DIFFERENT_ADDRESS },
    });

    const context = { params: { id: COMMITMENT_ID } };
    await POST(req, context, 'correlation-123');

    const stats = diagnosticsService.getOperationStats('settle_commitment');
    expect(stats.failureCount).toBeGreaterThan(0);
  });

  // ── State Precondition Tests ───────────────────────────────────────────────

  it('rejects settlement of non-existent commitment', async () => {
    mockGetCommitment.mockResolvedValue(null);

    const req = createMockRequest(`http://localhost/api/commitments/${COMMITMENT_ID}/settle`, {
      body: { callerAddress: VALID_ADDRESS },
    });

    const context = { params: { id: COMMITMENT_ID } };
    const response = await POST(req, context, 'correlation-123');

    const result = await parseResponse(response);
    expect(result.status).toBe(404);
    expect(result.data.error.code).toBe('NOT_FOUND_ERROR');
  });

  it('rejects settlement of already-settled commitment', async () => {
    mockGetCommitment.mockResolvedValue({
      ...MOCK_COMMITMENT_ACTIVE,
      status: 'SETTLED',
    });

    const req = createMockRequest(`http://localhost/api/commitments/${COMMITMENT_ID}/settle`, {
      body: { callerAddress: VALID_ADDRESS },
    });

    const context = { params: { id: COMMITMENT_ID } };
    const response = await POST(req, context, 'correlation-123');

    const result = await parseResponse(response);
    expect(result.status).toBe(409);
    expect(result.data.error.message).toContain('already been settled');
  });

  it('rejects settlement of violated commitment', async () => {
    mockGetCommitment.mockResolvedValue({
      ...MOCK_COMMITMENT_ACTIVE,
      status: 'VIOLATED',
    });

    const req = createMockRequest(`http://localhost/api/commitments/${COMMITMENT_ID}/settle`, {
      body: { callerAddress: VALID_ADDRESS },
    });

    const context = { params: { id: COMMITMENT_ID } };
    const response = await POST(req, context, 'correlation-123');

    const result = await parseResponse(response);
    expect(result.status).toBe(409);
    expect(result.data.error.message).toContain('violated');
  });

  it('rejects settlement of early-exited commitment', async () => {
    mockGetCommitment.mockResolvedValue({
      ...MOCK_COMMITMENT_ACTIVE,
      status: 'EARLY_EXIT',
    });

    const req = createMockRequest(`http://localhost/api/commitments/${COMMITMENT_ID}/settle`, {
      body: { callerAddress: VALID_ADDRESS },
    });

    const context = { params: { id: COMMITMENT_ID } };
    const response = await POST(req, context, 'correlation-123');

    const result = await parseResponse(response);
    expect(result.status).toBe(409);
    expect(result.data.error.message).toContain('already been exited early');
  });

  // ── Boundary Validation Tests ──────────────────────────────────────────────

  it('rejects commitment ID with empty/whitespace string', async () => {
    const req = createMockRequest(`http://localhost/api/commitments/   /settle`, {
      body: { callerAddress: VALID_ADDRESS },
    });

    const context = { params: { id: '   ' } };
    const response = await POST(req, context, 'correlation-123');

    const result = await parseResponse(response);
    expect(result.status).toBe(400);
    expect(result.data.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects malformed caller address', async () => {
    const req = createMockRequest(`http://localhost/api/commitments/${COMMITMENT_ID}/settle`, {
      body: { callerAddress: 'not-a-valid-address' },
    });

    const context = { params: { id: COMMITMENT_ID } };
    const response = await POST(req, context, 'correlation-123');

    const result = await parseResponse(response);
    expect(result.status).toBe(400);
    expect(result.data.error.code).toBe('VALIDATION_ERROR');
    expect(result.data.error.message).toContain('address');
  });

  it('rejects missing caller address', async () => {
    const req = createMockRequest(`http://localhost/api/commitments/${COMMITMENT_ID}/settle`, {
      body: {},
    });

    const context = { params: { id: COMMITMENT_ID } };
    const response = await POST(req, context, 'correlation-123');

    const result = await parseResponse(response);
    expect(result.status).toBe(400);
    expect(result.data.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects malformed JSON in request body', async () => {
    const req = new NextRequest(`http://localhost/api/commitments/${COMMITMENT_ID}/settle`, {
      method: 'POST',
      body: 'invalid json',
    });

    const context = { params: { id: COMMITMENT_ID } };
    const response = await POST(req, context, 'correlation-123');

    const result = await parseResponse(response);
    expect(result.status).toBe(400);
  });

  // ── Idempotency Tests ──────────────────────────────────────────────────────

  it('returns cached response on idempotent replay', async () => {
    const idempotencyKey = 'settle-' + randomUUID();
    const cachedResponse = {
      commitmentId: COMMITMENT_ID,
      settlementAmount: '10500',
      finalStatus: 'SETTLED',
      txHash: 'cached-tx-hash',
      reference: 'cached-ref',
      settledAt: new Date().toISOString(),
    };

    mockIdempotency.getRecord.mockResolvedValue({
      key: idempotencyKey,
      status: 'COMPLETED' as const,
      response: cachedResponse,
      statusCode: 200,
      createdAt: Date.now(),
      expiresAt: Date.now() + 86400000,
    });

    const req = createMockRequest(`http://localhost/api/commitments/${COMMITMENT_ID}/settle`, {
      body: { callerAddress: VALID_ADDRESS },
      idempotencyKey,
    });

    const context = { params: { id: COMMITMENT_ID } };
    const response = await POST(req, context, 'correlation-123');

    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    expect(result.data.data).toEqual(cachedResponse);
    expect(response.headers.get('X-Idempotent-Replay')).toBe('true');
    // Should not call settleCommitment for cache hit
    expect(mockSettleCommitment).not.toHaveBeenCalled();
  });

  it('blocks concurrent requests with same idempotency key', async () => {
    const idempotencyKey = 'settle-' + randomUUID();

    mockIdempotency.getRecord.mockResolvedValue({
      key: idempotencyKey,
      status: 'STARTED' as const,
      createdAt: Date.now(),
      expiresAt: Date.now() + 86400000,
    });

    const req = createMockRequest(`http://localhost/api/commitments/${COMMITMENT_ID}/settle`, {
      body: { callerAddress: VALID_ADDRESS },
      idempotencyKey,
    });

    const context = { params: { id: COMMITMENT_ID } };
    const response = await POST(req, context, 'correlation-123');

    const result = await parseResponse(response);
    expect(result.status).toBe(409);
    expect(result.data.error.message).toContain('currently processing');
  });

  // ── CSRF Protection Tests ──────────────────────────────────────────────────

  it('asserts CSRF token on POST request', async () => {
    const req = createMockRequest(`http://localhost/api/commitments/${COMMITMENT_ID}/settle`, {
      body: { callerAddress: VALID_ADDRESS },
    });\n\n    const context = { params: { id: COMMITMENT_ID } };
    await POST(req, context, 'correlation-123');

    expect(mockAssertCsrf).toHaveBeenCalledWith(req);
  });

  it('fails on CSRF validation failure', async () => {
    mockAssertCsrf.mockImplementation(() => {
      throw new Error('CSRF token invalid');
    });

    const req = createMockRequest(`http://localhost/api/commitments/${COMMITMENT_ID}/settle`, {
      body: { callerAddress: VALID_ADDRESS },
    });

    const context = { params: { id: COMMITMENT_ID } };
    const response = await POST(req, context, 'correlation-123');

    const result = await parseResponse(response);
    expect(result.status).toBe(400);
  });

  // ── Rate Limit Tests ───────────────────────────────────────────────────────

  it('respects rate limit for IP', async () => {
    mockCheckRateLimit.mockResolvedValue(false);

    const req = createMockRequest(`http://localhost/api/commitments/${COMMITMENT_ID}/settle`, {
      body: { callerAddress: VALID_ADDRESS },
    });

    const context = { params: { id: COMMITMENT_ID } };
    const response = await POST(req, context, 'correlation-123');

    const result = await parseResponse(response);
    expect(result.status).toBe(429);
    expect(result.data.error.code).toBe('TOO_MANY_REQUESTS_ERROR');
  });

  // ── Transaction Response Validation ────────────────────────────────────────

  it('validates transaction response has required fields', async () => {
    mockSettleCommitment.mockResolvedValue({
      settlementAmount: '10500',
      finalStatus: 'SETTLED',
      txHash: '', // Empty tx hash should fail validation
      reference: 'settle-ref-123',
    } as any);

    const req = createMockRequest(`http://localhost/api/commitments/${COMMITMENT_ID}/settle`, {
      body: { callerAddress: VALID_ADDRESS },
    });

    const context = { params: { id: COMMITMENT_ID } };
    const response = await POST(req, context, 'correlation-123');

    const result = await parseResponse(response);
    expect(result.status).toBe(400);
    expect(result.data.error.code).toBe('VALIDATION_ERROR');
  });
});
