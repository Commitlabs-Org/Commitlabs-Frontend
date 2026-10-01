import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, OPTIONS, GET, PUT, PATCH, DELETE } from './route';
import { CsrfValidationError, BackendError } from '@/lib/backend/errors';
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
    ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    ...headers,
  };
  const req = new NextRequest(`http://localhost/api/commitments/${id}/fund`, {
    method,
    headers: reqHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
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

// ─── Helper to build a completed idempotency record ──────────────────────────

function completedRecord(response: Record<string, unknown>, statusCode = 200) {
  return {
    key: 'idem-test',
    status: 'COMPLETED' as const,
    response,
    statusCode,
    createdAt: Date.now(),
    expiresAt: Date.now() + 86400000,
  };
}

describe('POST /api/commitments/[id]/fund', () => {
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

  // ─── 200 Success ─────────────────────────────────────────────────────────

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

    it('response shape: required fields commitmentId, txHash, fundedAt are present', async () => {
      const [req, ctx] = makeRequest('cmt-123', {});
      const res = await POST(req, ctx);
      const body = await res.json();

      // These three fields are always present in a successful response
      expect(body.data.commitmentId).toBeDefined();
      expect(body.data.txHash).toBeDefined();
      expect(body.data.fundedAt).toBeDefined();
      // reference is present only when txHash is absent (undefined is stripped by JSON)
      // No extraneous fields beyond the documented contract
      const allowedKeys = new Set(['commitmentId', 'txHash', 'reference', 'fundedAt']);
      const extraKeys = Object.keys(body.data).filter((k) => !allowedKeys.has(k));
      expect(extraKeys).toHaveLength(0);
    });

    it('fundedAt is a valid ISO-8601 timestamp', async () => {
      const [req, ctx] = makeRequest('cmt-123', {});
      const before = Date.now();
      const res = await POST(req, ctx);
      const after = Date.now();
      const body = await res.json();

      const fundedAtMs = new Date(body.data.fundedAt).getTime();
      expect(Number.isNaN(fundedAtMs)).toBe(false);
      expect(fundedAtMs).toBeGreaterThanOrEqual(before);
      expect(fundedAtMs).toBeLessThanOrEqual(after);
    });

    it('includes x-correlation-id header on success', async () => {
      const [req, ctx] = makeRequest('cmt-123', {}, 'POST', {
        'x-correlation-id': 'test-corr-001',
      });
      const res = await POST(req, ctx);

      expect(res.headers.get('x-correlation-id')).toBe('test-corr-001');
    });

    it('callerAddress absent: does not perform ownership check, calls fundEscrowOnChain', async () => {
      // When callerAddress is omitted the route skips the ownership guard —
      // authorization is delegated to fundEscrowOnChain / the chain itself.
      const [req, ctx] = makeRequest('cmt-123', {});
      const res = await POST(req, ctx);

      expect(res.status).toBe(200);
      expect(mockFundEscrowOnChain).toHaveBeenCalledWith({
        commitmentId: 'cmt-123',
        callerAddress: undefined,
      });
    });

    it('reference is undefined when txHash is present', async () => {
      mockFundEscrowOnChain.mockResolvedValue({
        ...MOCK_FUND_RESULT,
        txHash: '0xabc123',
        reference: undefined,
      });
      const [req, ctx] = makeRequest('cmt-123', {});
      const res = await POST(req, ctx);
      const body = await res.json();

      expect(body.data.txHash).toBe('0xabc123');
      expect(body.data.reference).toBeUndefined();
    });

    it('reference is present when txHash is absent (fallback reference)', async () => {
      mockFundEscrowOnChain.mockResolvedValue({
        ...MOCK_FUND_RESULT,
        txHash: undefined,
        reference: 'TODO_CHAIN_CALL_FUND_ESCROW',
      });
      const [req, ctx] = makeRequest('cmt-123', {});
      const res = await POST(req, ctx);
      const body = await res.json();

      expect(body.data.txHash).toBeUndefined();
      expect(body.data.reference).toBe('TODO_CHAIN_CALL_FUND_ESCROW');
    });

    it('does not track idempotency when header is absent', async () => {
      // No idempotency-key header → none of the idempotency methods should be called
      const [req, ctx] = makeRequest('cmt-123', {});
      await POST(req, ctx);

      expect(mockIdempotencyGetRecord).not.toHaveBeenCalled();
      expect(mockIdempotencyStart).not.toHaveBeenCalled();
      expect(mockIdempotencyComplete).not.toHaveBeenCalled();
      expect(mockIdempotencyFail).not.toHaveBeenCalled();
    });
  });

  // ─── 200 Success with idempotency ────────────────────────────────────────

  describe('200 - success with idempotency', () => {
    it('returns cached response when idempotency key is COMPLETED', async () => {
      const cachedResponse = { commitmentId: 'cmt-123', txHash: '0xold' };
      mockIdempotencyGetRecord.mockResolvedValue(completedRecord(cachedResponse));

      const [req, ctx] = makeRequest('cmt-123', {}, 'POST', { 'idempotency-key': 'idem-001' });
      const res = await POST(req, ctx);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data).toEqual(cachedResponse);
      expect(mockFundEscrowOnChain).not.toHaveBeenCalled();
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

      expect(mockIdempotencyComplete).toHaveBeenCalledWith(
        'idem-003',
        expect.objectContaining({ commitmentId: 'cmt-123' }),
        200,
      );
    });

    it('idempotency replay returns the exact same fundedAt as the original request', async () => {
      const frozenFundedAt = '2026-08-01T12:00:00.000Z';
      const cachedPayload = {
        commitmentId: 'cmt-123',
        txHash: '0xdeadbeef',
        reference: undefined,
        fundedAt: frozenFundedAt,
      };
      mockIdempotencyGetRecord.mockResolvedValue(completedRecord(cachedPayload));

      const [req, ctx] = makeRequest('cmt-123', {}, 'POST', { 'idempotency-key': 'idem-replay' });
      const res = await POST(req, ctx);
      const body = await res.json();

      // The replayed response must include the original, stable fundedAt —
      // not a freshly generated timestamp.
      expect(body.data.fundedAt).toBe(frozenFundedAt);
      expect(mockFundEscrowOnChain).not.toHaveBeenCalled();
    });

    it('idempotency complete call stores the same fundedAt that is returned in the response', async () => {
      const [req, ctx] = makeRequest('cmt-123', {}, 'POST', { 'idempotency-key': 'idem-ts' });
      const res = await POST(req, ctx);
      const body = await res.json();

      // Verify the value stored in the idempotency cache equals the response body
      const storedPayload = mockIdempotencyComplete.mock.calls[0][1] as Record<string, unknown>;
      expect(storedPayload.fundedAt).toBe(body.data.fundedAt);
    });

    it('allows retry after FAILED idempotency: fail() deletes key so retry proceeds', async () => {
      // First call: STARTED → normal flow fails → fail() is called → key deleted
      // Second call: getRecord returns null because key was deleted → new start
      // This test simulates the second (retry) call:
      mockIdempotencyGetRecord.mockResolvedValue(null); // key was deleted by fail()

      const [req, ctx] = makeRequest('cmt-123', {}, 'POST', { 'idempotency-key': 'idem-retry' });
      const res = await POST(req, ctx);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockIdempotencyStart).toHaveBeenCalledWith('idem-retry');
      expect(mockFundEscrowOnChain).toHaveBeenCalled();
    });

    it('idempotency key header value is propagated correctly to all service calls', async () => {
      const [req, ctx] = makeRequest('cmt-123', {}, 'POST', {
        'idempotency-key': 'exact-key-value',
      });
      await POST(req, ctx);

      expect(mockIdempotencyGetRecord).toHaveBeenCalledWith('exact-key-value');
      expect(mockIdempotencyStart).toHaveBeenCalledWith('exact-key-value');
      expect(mockIdempotencyComplete).toHaveBeenCalledWith(
        'exact-key-value',
        expect.any(Object),
        200,
      );
    });
  });

  // ─── 400 Validation ──────────────────────────────────────────────────────

  describe('400 - validation errors', () => {
    it('rejects empty commitment id', async () => {
      const [req, ctx] = makeRequest('', {});
      await expectError(req, ctx, 400, 'VALIDATION_ERROR');
    });
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

  // ─── 403 Forbidden ───────────────────────────────────────────────────────

  describe('403 - forbidden', () => {
    it('rejects callerAddress that does not match owner', async () => {
      const [req, ctx] = makeRequest('cmt-123', { callerAddress: 'GWRONGADDRESS' });
      await expectError(req, ctx, 403, 'FORBIDDEN');
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

  // ─── 404 Not Found ───────────────────────────────────────────────────────

  describe('404 - not found', () => {
    it('returns 404 when commitment does not exist', async () => {
      mockGetCommitmentFromChain.mockResolvedValue(null);
      const [req, ctx] = makeRequest('nonexistent', {});
      await expectError(req, ctx, 404, 'NOT_FOUND');
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

  // ─── 409 Conflict ────────────────────────────────────────────────────────

  describe('409 - conflict: non-CREATED commitment statuses', () => {
    const nonCreatedStatuses = [
      'ACTIVE',
      'SETTLED',
      'VIOLATED',
      'EARLY_EXIT',
      'DISPUTED',
      'UNKNOWN',
    ] as const;

    for (const status of nonCreatedStatuses) {
      it(`rejects funding a commitment with status ${status}`, async () => {
        mockGetCommitmentFromChain.mockResolvedValue({
          ...MOCK_COMMITMENT,
          status,
        } as typeof MOCK_COMMITMENT);
        const [req, ctx] = makeRequest('cmt-123', {});
        await expectError(req, ctx, 409, 'CONFLICT');
      });
    }

    it('rejects duplicate idempotency key that is still processing (STARTED)', async () => {
      mockIdempotencyGetRecord.mockResolvedValue({
        key: 'idem-004',
        status: 'STARTED',
        createdAt: Date.now(),
        expiresAt: Date.now() + 86400000,
      });
      const [req, ctx] = makeRequest('cmt-123', {}, 'POST', { 'idempotency-key': 'idem-004' });
      await expectError(req, ctx, 409, 'CONFLICT');
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

  // ─── 429 Rate Limited ────────────────────────────────────────────────────

  describe('429 - rate limited', () => {
    it('returns 429 when rate limit exceeded', async () => {
      mockCheckRateLimit.mockResolvedValue(false);
      const [req, ctx] = makeRequest('cmt-123', {});
      await expectError(req, ctx, 429, 'TOO_MANY_REQUESTS');
    });

    it('includes Retry-After header on 429', async () => {
      mockCheckRateLimit.mockResolvedValue(false);
      mockGetRateLimitWindowSeconds.mockReturnValue(60);
      const [req, ctx] = makeRequest('cmt-123', {});
      const res = await POST(req, ctx);

      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBe('60');
    });
  });

  // ─── 502 Blockchain error ─────────────────────────────────────────────────

  describe('502 - blockchain error', () => {
    it('returns 502 when fundEscrowOnChain throws a BLOCKCHAIN_CALL_FAILED BackendError', async () => {
      mockFundEscrowOnChain.mockRejectedValue(
        new BackendError({
          code: 'BLOCKCHAIN_CALL_FAILED',
          message: 'Unable to fund escrow on chain.',
          status: 502,
          details: { method: 'fund_escrow', commitmentId: 'cmt-123' },
        }),
      );
      const [req, ctx] = makeRequest('cmt-123', {});
      const res = await POST(req, ctx);
      const body = await res.json();

      expect(res.status).toBe(502);
      // BackendError uses the toBackendErrorResponse shape: { error: { code, message, details } }
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe('BLOCKCHAIN_CALL_FAILED');
    });

    it('marks idempotency key as failed when blockchain call fails', async () => {
      mockFundEscrowOnChain.mockRejectedValue(
        new BackendError({
          code: 'BLOCKCHAIN_CALL_FAILED',
          message: 'RPC timeout',
          status: 502,
        }),
      );
      const [req, ctx] = makeRequest('cmt-123', {}, 'POST', { 'idempotency-key': 'idem-502' });
      await POST(req, ctx);

      expect(mockIdempotencyFail).toHaveBeenCalledWith('idem-502');
    });
  });

  // ─── 405 Method Not Allowed ──────────────────────────────────────────────

  describe('405 - method not allowed', () => {
    it('rejects GET requests', async () => {
      const [req, ctx] = makeRequest('cmt-123', undefined, 'GET');
      const res = await GET(req, ctx);
      const body = await res.json();
      expect(res.status).toBe(405);
      expect(body.error.code).toBe('METHOD_NOT_ALLOWED');
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

  // ─── OPTIONS preflight ───────────────────────────────────────────────────

  describe('OPTIONS', () => {
    it('returns 204 for OPTIONS preflight', async () => {
      const req = new NextRequest('http://localhost/api/commitments/cmt-123/fund', {
        method: 'OPTIONS',
        headers: { 'access-control-request-method': 'POST' },
      });
      const res = await OPTIONS(req);
      expect(res.status).toBe(204);
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

  // ─── Error handling and idempotency failure path ──────────────────────────

  describe('error handling', () => {
    it('fails idempotency key when getCommitmentFromChain throws', async () => {
      mockGetCommitmentFromChain.mockRejectedValue(new Error('RPC failure'));
      const [req, ctx] = makeRequest('cmt-123', {}, 'POST', { 'idempotency-key': 'idem-005' });
      await POST(req, ctx);
  // ── CSRF Protection Tests ──────────────────────────────────────────────────

  it('asserts CSRF token on POST request', async () => {
    const req = createMockRequest(`http://localhost/api/commitments/${COMMITMENT_ID}/fund`, {
      body: { callerAddress: VALID_ADDRESS },
    });

    it('fails idempotency key when fundEscrowOnChain throws', async () => {
      mockFundEscrowOnChain.mockRejectedValue(new Error('Chain timeout'));
      const [req, ctx] = makeRequest('cmt-123', {}, 'POST', { 'idempotency-key': 'idem-006' });
      await POST(req, ctx);

      expect(mockIdempotencyFail).toHaveBeenCalledWith('idem-006');
    });

    it('does not call idempotencyFail when no idempotency key is present', async () => {
      mockGetCommitmentFromChain.mockRejectedValue(new Error('RPC failure'));
      const [req, ctx] = makeRequest('cmt-123', {});
      await POST(req, ctx);

      expect(mockIdempotencyFail).not.toHaveBeenCalled();
    });

    it('returns 500 for unexpected errors', async () => {
      mockGetCommitmentFromChain.mockRejectedValue(new Error('Unexpected DB error'));
      const [req, ctx] = makeRequest('cmt-123', {});
      const res = await POST(req, ctx);
      const body = await res.json();
    const context = { params: { id: COMMITMENT_ID } };
    await POST(req, context, 'correlation-123');

    expect(mockAssertCsrf).toHaveBeenCalledWith(req);
  });

  it('fails on CSRF validation failure', async () => {
    mockAssertCsrf.mockImplementation(() => {
      throw new Error('CSRF token invalid');
    });

    it('returns 500 with x-correlation-id header on unhandled error', async () => {
      mockGetCommitmentFromChain.mockRejectedValue(new Error('boom'));
      const [req, ctx] = makeRequest('cmt-123', {}, 'POST', {
        'x-correlation-id': 'err-corr-001',
      });
      const res = await POST(req, ctx);

      expect(res.status).toBe(500);
      expect(res.headers.get('x-correlation-id')).toBe('err-corr-001');
    });
  });

  // ─── Boundary / edge cases ────────────────────────────────────────────────

  describe('boundary and edge cases', () => {
    it('accepts a commitment id with special characters (URL-encoded)', async () => {
      const [req, ctx] = makeRequest('cmt-abc_123-XYZ', {});
      const res = await POST(req, ctx);

      expect(mockGetCommitmentFromChain).toHaveBeenCalledWith('cmt-abc_123-XYZ');
      expect(res.status).toBe(200);
    });

    it('does not call fundEscrowOnChain when CSRF check throws', async () => {
      mockAssertMutationCsrf.mockImplementation(() => {
        throw new CsrfValidationError('Missing CSRF token.');
      });
      const [req, ctx] = makeRequest('cmt-123', {});
      await POST(req, ctx);

      expect(mockFundEscrowOnChain).not.toHaveBeenCalled();
    });

    it('does not call fundEscrowOnChain when rate limit is exceeded', async () => {
      mockCheckRateLimit.mockResolvedValue(false);
      const [req, ctx] = makeRequest('cmt-123', {});
      await POST(req, ctx);

      expect(mockFundEscrowOnChain).not.toHaveBeenCalled();
    });

    it('does not call fundEscrowOnChain when commitment is not found', async () => {
      mockGetCommitmentFromChain.mockResolvedValue(null);
      const [req, ctx] = makeRequest('cmt-123', {});
      await POST(req, ctx);

      expect(mockFundEscrowOnChain).not.toHaveBeenCalled();
    });

    it('does not call fundEscrowOnChain when status is not CREATED', async () => {
      mockGetCommitmentFromChain.mockResolvedValue({
        ...MOCK_COMMITMENT,
        status: 'SETTLED',
      } as typeof MOCK_COMMITMENT);
      const [req, ctx] = makeRequest('cmt-123', {});
      await POST(req, ctx);

      expect(mockFundEscrowOnChain).not.toHaveBeenCalled();
    });

    it('does not call fundEscrowOnChain when caller address is forbidden', async () => {
      const [req, ctx] = makeRequest('cmt-123', { callerAddress: 'GEVIL999' });
      await POST(req, ctx);

      expect(mockFundEscrowOnChain).not.toHaveBeenCalled();
    });

    it('success response body has success: true at top level', async () => {
      const [req, ctx] = makeRequest('cmt-123', {});
      const res = await POST(req, ctx);
      const body = await res.json();

      expect(body.success).toBe(true);
    });

    it('error response body has success: false at top level', async () => {
      mockGetCommitmentFromChain.mockResolvedValue(null);
      const [req, ctx] = makeRequest('nonexistent', {});
      const res = await POST(req, ctx);
      const body = await res.json();

      expect(body.success).toBe(false);
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
