import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, OPTIONS, GET } from './route';
import { CsrfValidationError, BackendError } from '@/lib/backend/errors';
import type { ChainCommitment } from '@/lib/backend/services/contracts';
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

const mockPOST = POST as (
  req: NextRequest,
  context: { params: Record<string, string> },
) => Promise<Response>;

// ── Helpers ───────────────────────────────────────────────────────────────────

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
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return [req, { params: { id } }];
}

async function expectError(
  req: NextRequest,
  ctx: { params: { id: string } },
  status: number,
  code?: string,
): Promise<void> {
  const res = await mockPOST(req, ctx);
  const body = await res.json();
  expect(res.status).toBe(status);
  expect(body.success).toBe(false);
  expect(body.error).toBeDefined();
  if (code) expect(body.error.code).toBe(code);
}

// ── Test Data ─────────────────────────────────────────────────────────────────

const VALID_ADDRESS = `GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
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
  txHash: '0xdeadbeef',
  reference: undefined,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/commitments/[id]/fund - Contract & Idempotency Regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    diagnosticsService.clear();
    mockAssertCsrf.mockImplementation(() => undefined);
    mockCheckRateLimit.mockResolvedValue(true);
    mockGetCommitment.mockResolvedValue(MOCK_COMMITMENT_CREATED);
    mockFundEscrow.mockResolvedValue({ ...MOCK_FUND_RESULT });
    mockIdempotency.getRecord.mockResolvedValue(null);
    mockIdempotency.start.mockResolvedValue(true);
    mockIdempotency.complete.mockResolvedValue(undefined);
    mockIdempotency.fail.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
    diagnosticsService.clear();
  });

  // ── Success ────────────────────────────────────────────────────────────────

  it('funds a commitment in CREATED state', async () => {
    const [req, ctx] = makeRequest(COMMITMENT_ID, { callerAddress: VALID_ADDRESS });
    const res = await mockPOST(req, ctx);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.commitmentId).toBe(COMMITMENT_ID);
    expect(body.data.txHash).toBe('0xdeadbeef');
    expect(body.data.fundedAt).toBeDefined();
    expect(body.data.reference).toBeUndefined();
    expect(mockFundEscrow).toHaveBeenCalledWith({
      commitmentId: COMMITMENT_ID,
      callerAddress: VALID_ADDRESS,
    });
  });

  it('falls back to a reference when txHash is absent (legacy chain responses)', async () => {
    mockFundEscrow.mockResolvedValue({ txHash: undefined, reference: 'LEGACY_REF' } as any);
    const [req, ctx] = makeRequest(COMMITMENT_ID, { callerAddress: VALID_ADDRESS });
    const res = await mockPOST(req, ctx);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.txHash).toBeUndefined();
    expect(body.data.reference).toBe('LEGACY_REF');
  });

  it('exposes x-correlation-id on success', async () => {
    const [req, ctx] = makeRequest(COMMITMENT_ID, { callerAddress: VALID_ADDRESS });
    const res = await mockPOST(req, ctx);
    expect(res.headers.get('x-correlation-id')).toBeDefined();
  });

  // ── Boundary Validation ────────────────────────────────────────────────────

  it('rejects an empty/whitespace commitment ID', async () => {
    const [req, ctx] = makeRequest('   ', { callerAddress: VALID_ADDRESS });
    await expectError(req, ctx, 400, 'VALIDATION_ERROR');
  });

  it('rejects malformed JSON in the request body', async () => {
    const req = new NextRequest(`http://localhost/api/commitments/${COMMITMENT_ID}/fund`, {
      method: 'POST',
      body: 'not json',
      headers: { 'content-type': 'application/json' },
    });
    const ctx = { params: { id: COMMITMENT_ID } };
    await expectError(req, ctx, 400, 'VALIDATION_ERROR');
  });

  it('rejects a request body missing callerAddress', async () => {
    const [req, ctx] = makeRequest(COMMITMENT_ID, {});
    await expectError(req, ctx, 400, 'VALIDATION_ERROR');
  });

  it('rejects a callerAddress that does not match the owner (ownership invariant)', async () => {
    const [req, ctx] = makeRequest(COMMITMENT_ID, { callerAddress: 'GWRONGADDRESS' });
    const res = await mockPOST(req, ctx);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
    expect(body.error.message).toContain('Only the commitment owner may fund');
  });

  it('rejects funding of a non-existent commitment', async () => {
    mockGetCommitment.mockResolvedValue(null as unknown as ChainCommitment);
    const [req, ctx] = makeRequest('nonexistent', { callerAddress: VALID_ADDRESS });
    await expectError(req, ctx, 404, 'NOT_FOUND');
  });

  it('rejects funding of a non-CREATED commitment (precondition invariant)', async () => {
    mockGetCommitment.mockResolvedValue({ ...MOCK_COMMITMENT_CREATED, status: 'ACTIVE' });
    const [req, ctx] = makeRequest(COMMITMENT_ID, { callerAddress: VALID_ADDRESS });
    const res = await mockPOST(req, ctx);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error.code).toBe('CONFLICT');
    expect(body.error.message).toContain('Only CREATED commitments can be funded');
  });

  it('rejects funding of a SETTLED commitment', async () => {
    mockGetCommitment.mockResolvedValue({ ...MOCK_COMMITMENT_CREATED, status: 'SETTLED' });
    const [req, ctx] = makeRequest(COMMITMENT_ID, { callerAddress: VALID_ADDRESS });
    await expectError(req, ctx, 409, 'CONFLICT');
  });

  // ── Rate Limiting ──────────────────────────────────────────────────────────

  it('returns 429 when the rate limit is exceeded', async () => {
    mockCheckRateLimit.mockResolvedValue(false);
    const [req, ctx] = makeRequest(COMMITMENT_ID, { callerAddress: VALID_ADDRESS });
    const res = await mockPOST(req, ctx);
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('includes Retry-After on 429 responses', async () => {
    mockCheckRateLimit.mockResolvedValue(false);
    const [req, ctx] = makeRequest(COMMITMENT_ID, { callerAddress: VALID_ADDRESS });
    const res = await mockPOST(req, ctx);
    expect(res.headers.get('Retry-After')).toBe('60');
  });

  // ── CSRF ───────────────────────────────────────────────────────────────────

  it('asserts CSRF on every POST', async () => {
    const [req, ctx] = makeRequest(COMMITMENT_ID, { callerAddress: VALID_ADDRESS });
    await mockPOST(req, ctx);
    expect(mockAssertCsrf).toHaveBeenCalledWith(req);
  });

  it('returns 403 CSRF_INVALID when CSRF validation fails', async () => {
    mockAssertCsrf.mockImplementation(() => {
      throw new CsrfValidationError('Missing CSRF token.');
    });
    const [req, ctx] = makeRequest(COMMITMENT_ID, { callerAddress: VALID_ADDRESS });
    const res = await mockPOST(req, ctx);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe('CSRF_INVALID');
    expect(mockFundEscrow).not.toHaveBeenCalled();
  });

  // ── Idempotency ────────────────────────────────────────────────────────────

  it('replays the cached response for a COMPLETED idempotency key', async () => {
    const idempotencyKey = 'idempotency-fund-' + randomUUID();
    const cached = {
      commitmentId: COMMITMENT_ID,
      txHash: '0xcached',
      reference: undefined,
      fundedAt: new Date().toISOString(),
    };
    mockIdempotency.getRecord.mockResolvedValue({
      key: idempotencyKey,
      status: 'COMPLETED' as const,
      response: cached,
      statusCode: 200,
      createdAt: Date.now(),
      expiresAt: Date.now() + 86400000,
    });

    const [req, ctx] = makeRequest(COMMITMENT_ID, { callerAddress: VALID_ADDRESS }, 'POST', {
      'idempotency-key': idempotencyKey,
    });
    const res = await mockPOST(req, ctx);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Idempotent-Replay')).toBe('true');
    expect(body.data).toEqual(cached);
    expect(mockFundEscrow).not.toHaveBeenCalled();
  });

  it('blocks concurrent requests with a STARTED idempotency key', async () => {
    const idempotencyKey = 'idempotency-fund-' + randomUUID();
    mockIdempotency.getRecord.mockResolvedValue({
      key: idempotencyKey,
      status: 'STARTED' as const,
      createdAt: Date.now(),
      expiresAt: Date.now() + 86400000,
    });

    const [req, ctx] = makeRequest(COMMITMENT_ID, { callerAddress: VALID_ADDRESS }, 'POST', {
      'idempotency-key': idempotencyKey,
    });
    const res = await mockPOST(req, ctx);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error.code).toBe('CONFLICT');
    expect(body.error.message).toContain('currently processing');
    expect(mockFundEscrow).not.toHaveBeenCalled();
  });

  it('stores the response under the idempotency key on success', async () => {
    const idempotencyKey = 'idempotency-fund-' + randomUUID();
    const [req, ctx] = makeRequest(COMMITMENT_ID, { callerAddress: VALID_ADDRESS }, 'POST', {
      'idempotency-key': idempotencyKey,
    });
    const res = await mockPOST(req, ctx);
    const body = await res.json();

    expect(mockIdempotency.start).toHaveBeenCalledWith(idempotencyKey);
    expect(mockIdempotency.complete).toHaveBeenCalledWith(
      idempotencyKey,
      expect.objectContaining({ commitmentId: COMMITMENT_ID }),
      200,
    );
    expect(body.data.fundedAt).toBeDefined();
  });

  it('deletes the idempotency key on failure so retries proceed', async () => {
    const idempotencyKey = 'idempotency-fund-' + randomUUID();
    mockGetCommitment.mockResolvedValue({ ...MOCK_COMMITMENT_CREATED, status: 'ACTIVE' });

    const [req, ctx] = makeRequest(COMMITMENT_ID, { callerAddress: VALID_ADDRESS }, 'POST', {
      'idempotency-key': idempotencyKey,
    });
    const res = await mockPOST(req, ctx);
    expect(res.status).toBe(409);
    expect(mockIdempotency.fail).toHaveBeenCalledWith(idempotencyKey);
  });

  it('does not touch idempotency when no key is provided', async () => {
    const [req, ctx] = makeRequest(COMMITMENT_ID, { callerAddress: VALID_ADDRESS });
    await mockPOST(req, ctx);

    expect(mockIdempotency.getRecord).not.toHaveBeenCalled();
    expect(mockIdempotency.start).not.toHaveBeenCalled();
    expect(mockIdempotency.complete).not.toHaveBeenCalled();
    expect(mockIdempotency.fail).not.toHaveBeenCalled();
  });

  // ── Blockchain Errors ──────────────────────────────────────────────────────

  it('returns 502 with the backend code when the chain call fails', async () => {
    mockFundEscrow.mockRejectedValue(
      new BackendError({
        message: 'Stellar RPC unavailable',
        code: 'BLOCKCHAIN_CALL_FAILED',
        status: 502,
      }),
    );

    const [req, ctx] = makeRequest(COMMITMENT_ID, { callerAddress: VALID_ADDRESS });
    const res = await mockPOST(req, ctx);
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error.code).toBe('BLOCKCHAIN_CALL_FAILED');
  });

  it('marks the idempotency key as failed when the chain call throws', async () => {
    const idempotencyKey = 'idempotency-fund-' + randomUUID();
    mockFundEscrow.mockRejectedValue(
      new BackendError({
        message: 'Stellar RPC unavailable',
        code: 'BLOCKCHAIN_CALL_FAILED',
        status: 502,
      }),
    );

    const [req, ctx] = makeRequest(COMMITMENT_ID, { callerAddress: VALID_ADDRESS }, 'POST', {
      'idempotency-key': idempotencyKey,
    });
    await mockPOST(req, ctx);

    expect(mockIdempotency.fail).toHaveBeenCalledWith(idempotencyKey);
  });

  // ── Telemetry ─────────────────────────────────────────────────────────────

  it('records success telemetry', async () => {
    const [req, ctx] = makeRequest(COMMITMENT_ID, { callerAddress: VALID_ADDRESS });
    await mockPOST(req, ctx);

    const stats = diagnosticsService.getOperationStats('fund_commitment');
    expect(stats.successCount).toBeGreaterThan(0);
  });

  it('records telemetry failures for rejected states', async () => {
    mockGetCommitment.mockResolvedValue({ ...MOCK_COMMITMENT_CREATED, status: 'ACTIVE' });
    const [req, ctx] = makeRequest(COMMITMENT_ID, { callerAddress: VALID_ADDRESS });
    await mockPOST(req, ctx);

    const stats = diagnosticsService.getOperationStats('fund_commitment');
    expect(stats.failureCount).toBeGreaterThan(0);
  });

  // ── Method / Preflight ─────────────────────────────────────────────────────

  it('returns 204 for OPTIONS preflight', async () => {
    const req = new NextRequest('http://localhost/api/commitments/cmt-123/fund', {
      method: 'OPTIONS',
      headers: {
        origin: 'http://localhost:3000',
        'access-control-request-method': 'POST',
      },
    });
    const res = await OPTIONS(req);
    expect(res.status).toBe(204);
  });

  it('rejects GET with 405', async () => {
    const [req, ctx] = makeRequest(COMMITMENT_ID, undefined, 'GET');
    const res = await GET(req, ctx);
    const body = await res.json();

    expect(res.status).toBe(405);
    expect(body.error.code).toBe('METHOD_NOT_ALLOWED');
  });
});
