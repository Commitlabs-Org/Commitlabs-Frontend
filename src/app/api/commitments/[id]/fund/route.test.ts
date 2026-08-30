import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, OPTIONS, GET, PUT, PATCH, DELETE } from './route';
import { CsrfValidationError, BackendError, UnauthorizedError } from '@/lib/backend/errors';
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
vi.mock('@/lib/backend/requireAuth', () => ({
  verifyAuth: vi.fn(),
}));
vi.mock('@/lib/backend/config', () => ({
  getBackendConfig: vi.fn(),
}));
vi.mock('@/lib/backend/validation', () => ({
  validateStellarAddress: vi.fn(),
  validateCommitmentId: vi.fn(),
}));

import { checkRateLimit, getRateLimitWindowSeconds } from '@/lib/backend/rateLimit';
import { assertMutationCsrf } from '@/lib/backend/csrf';
import { fundEscrowOnChain, getCommitmentFromChain } from '@/lib/backend/services/contracts';
import { idempotencyService } from '@/lib/backend/idempotency';
import { verifyAuth } from '@/lib/backend/requireAuth';
import { getBackendConfig } from '@/lib/backend/config';
import { validateStellarAddress, validateCommitmentId } from '@/lib/backend/validation';
import { ValidationError } from '@/lib/backend/errors';

const mockCheckRateLimit = vi.mocked(checkRateLimit);
const mockGetRateLimitWindowSeconds = vi.mocked(getRateLimitWindowSeconds);
const mockAssertMutationCsrf = vi.mocked(assertMutationCsrf);
const mockFundEscrowOnChain = vi.mocked(fundEscrowOnChain);
const mockGetCommitmentFromChain = vi.mocked(getCommitmentFromChain);
const mockIdempotencyGetRecord = vi.mocked(idempotencyService.getRecord);
const mockIdempotencyStart = vi.mocked(idempotencyService.start);
const mockIdempotencyComplete = vi.mocked(idempotencyService.complete);
const mockIdempotencyFail = vi.mocked(idempotencyService.fail);
const mockVerifyAuth = vi.mocked(verifyAuth);
const mockGetBackendConfig = vi.mocked(getBackendConfig);
const mockValidateStellarAddress = vi.mocked(validateStellarAddress);
const mockValidateCommitmentId = vi.mocked(validateCommitmentId);

// ── Test Data ──────────────────────────────────────────────────────────────────

// Valid Stellar public keys use the Stellar base32 alphabet: G[A-HJ-NP-Z0-9]{55}
const OWNER_ADDRESS  = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const OTHER_ADDRESS  = 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
const COMMITMENT_ID  = 'commitment-fund-test-123';
const TEST_NETWORK   = 'Test SDF Network ; September 2015';

const MOCK_COMMITMENT = {
  id: COMMITMENT_ID,
  ownerAddress: OWNER_ADDRESS,
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
  commitmentId: COMMITMENT_ID,
  txHash: '0xdeadbeef',
  contractVersion: '1.0.0',
  reference: undefined,
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeRequest(
  id: string,
  body?: Record<string, unknown>,
  method = 'POST',
  headers?: Record<string, string>,
): [NextRequest, { params: { id: string } }] {
  const reqHeaders: Record<string, string> = {
    ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    authorization: 'Bearer test-token',
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

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('POST /api/commitments/[id]/fund', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    diagnosticsService.clear();
    mockCheckRateLimit.mockResolvedValue(true);
    mockGetRateLimitWindowSeconds.mockReturnValue(60);
    mockGetCommitmentFromChain.mockResolvedValue(MOCK_COMMITMENT);
    mockFundEscrowOnChain.mockResolvedValue(MOCK_FUND_RESULT);
    mockIdempotencyGetRecord.mockResolvedValue(null);
    mockIdempotencyStart.mockResolvedValue(undefined);
    mockIdempotencyComplete.mockResolvedValue(undefined);
    mockIdempotencyFail.mockResolvedValue(undefined);
    mockVerifyAuth.mockReturnValue({ address: OWNER_ADDRESS, isAdmin: false });
    mockGetBackendConfig.mockReturnValue({
      networkPassphrase: TEST_NETWORK,
      sorobanRpcUrl: 'https://soroban-testnet.stellar.org:443',
      contractAddresses: { commitmentNFT: 'c1', commitmentCore: 'c2', attestationEngine: 'c3' },
      environment: 'test',
      chainWritesEnabled: false,
      activeVersion: '1.0.0',
    } as ReturnType<typeof getBackendConfig>);
    // Default: validateStellarAddress passes; validateCommitmentId returns the id
    mockValidateStellarAddress.mockReturnValue(undefined);
    mockValidateCommitmentId.mockImplementation((id: string | undefined) => {
      if (!id?.trim()) throw new ValidationError('Commitment ID is required');
      return id;
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
    diagnosticsService.clear();
  });

  // ── 200 Success ─────────────────────────────────────────────────────────────

  describe('200 - success', () => {
    it('funds a commitment escrow', async () => {
      const [req, ctx] = makeRequest(COMMITMENT_ID, {});
      const res = await POST(req, ctx);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.commitmentId).toBe(COMMITMENT_ID);
      expect(body.data.txHash).toBe('0xdeadbeef');
      expect(body.data.reference).toBeUndefined();
      expect(body.data.fundedAt).toBeDefined();
      expect(body.meta).toBeDefined();
    });

    it('uses session address as callerAddress when body omits it', async () => {
      const [req, ctx] = makeRequest(COMMITMENT_ID, {});
      await POST(req, ctx);
      expect(mockFundEscrowOnChain).toHaveBeenCalledWith({
        commitmentId: COMMITMENT_ID,
        callerAddress: OWNER_ADDRESS,
      });
    });

    it('calls fundEscrowOnChain with correct params when callerAddress is supplied', async () => {
      const [req, ctx] = makeRequest(COMMITMENT_ID, { callerAddress: OWNER_ADDRESS });
      await POST(req, ctx);
      expect(mockFundEscrowOnChain).toHaveBeenCalledWith({
        commitmentId: COMMITMENT_ID,
        callerAddress: OWNER_ADDRESS,
      });
    });

    it('emits CSRF check for the request', async () => {
      const [req, ctx] = makeRequest(COMMITMENT_ID, {});
      await POST(req, ctx);
      expect(mockAssertMutationCsrf).toHaveBeenCalledWith(req);
    });

    it('checks rate limit', async () => {
      const [req, ctx] = makeRequest(COMMITMENT_ID, {});
      await POST(req, ctx);
      expect(mockCheckRateLimit).toHaveBeenCalledWith(expect.any(String), 'api/commitments/fund');
    });

    it('fetches commitment from chain to verify state', async () => {
      const [req, ctx] = makeRequest(COMMITMENT_ID, {});
      await POST(req, ctx);
      expect(mockGetCommitmentFromChain).toHaveBeenCalledWith(COMMITMENT_ID);
    });

    it('response shape: required fields commitmentId, txHash, fundedAt are present', async () => {
      const [req, ctx] = makeRequest(COMMITMENT_ID, {});
      const res = await POST(req, ctx);
      const body = await res.json();
      expect(body.data.commitmentId).toBeDefined();
      expect(body.data.txHash).toBeDefined();
      expect(body.data.fundedAt).toBeDefined();
      const allowedKeys = new Set(['commitmentId', 'txHash', 'reference', 'fundedAt']);
      const extraKeys = Object.keys(body.data).filter((k) => !allowedKeys.has(k));
      expect(extraKeys).toHaveLength(0);
    });

    it('fundedAt is a valid ISO-8601 timestamp', async () => {
      const [req, ctx] = makeRequest(COMMITMENT_ID, {});
      const before = Date.now();
      const res = await POST(req, ctx);
      const after = Date.now();
      const body = await res.json();
      const fundedAtMs = new Date(body.data.fundedAt).getTime();
      expect(Number.isNaN(fundedAtMs)).toBe(false);
      expect(fundedAtMs).toBeGreaterThanOrEqual(before);
      expect(fundedAtMs).toBeLessThanOrEqual(after);
    });

    it('accepts a matching network passphrase in the body', async () => {
      const [req, ctx] = makeRequest(COMMITMENT_ID, { network: TEST_NETWORK });
      const res = await POST(req, ctx);
      expect(res.status).toBe(200);
    });

    it('reference is present when txHash is absent (fallback reference)', async () => {
      mockFundEscrowOnChain.mockResolvedValue({
        ...MOCK_FUND_RESULT,
        txHash: undefined,
        reference: 'TODO_CHAIN_CALL_FUND_ESCROW',
      });
      const [req, ctx] = makeRequest(COMMITMENT_ID, {});
      const res = await POST(req, ctx);
      const body = await res.json();
      expect(body.data.txHash).toBeUndefined();
      expect(body.data.reference).toBe('TODO_CHAIN_CALL_FUND_ESCROW');
    });

    it('does not track idempotency when header is absent', async () => {
      const [req, ctx] = makeRequest(COMMITMENT_ID, {});
      await POST(req, ctx);
      expect(mockIdempotencyGetRecord).not.toHaveBeenCalled();
      expect(mockIdempotencyStart).not.toHaveBeenCalled();
      expect(mockIdempotencyComplete).not.toHaveBeenCalled();
      expect(mockIdempotencyFail).not.toHaveBeenCalled();
    });

    it('success response body has success: true at top level', async () => {
      const [req, ctx] = makeRequest(COMMITMENT_ID, {});
      const res = await POST(req, ctx);
      const body = await res.json();
      expect(body.success).toBe(true);
    });
  });

  // ── 200 Success with idempotency ────────────────────────────────────────────

  describe('200 - success with idempotency', () => {
    it('returns cached response when idempotency key is COMPLETED', async () => {
      const cachedResponse = { commitmentId: COMMITMENT_ID, txHash: '0xold' };
      mockIdempotencyGetRecord.mockResolvedValue(completedRecord(cachedResponse));
      const [req, ctx] = makeRequest(COMMITMENT_ID, {}, 'POST', { 'idempotency-key': 'idem-001' });
      const res = await POST(req, ctx);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.data).toEqual(cachedResponse);
      expect(res.headers.get('X-Idempotent-Replay')).toBe('true');
      expect(mockFundEscrowOnChain).not.toHaveBeenCalled();
    });

    it('starts idempotency tracking for a new key', async () => {
      const [req, ctx] = makeRequest(COMMITMENT_ID, {}, 'POST', { 'idempotency-key': 'idem-002' });
      await POST(req, ctx);
      expect(mockIdempotencyStart).toHaveBeenCalledWith('idem-002');
    });

    it('completes idempotency tracking on success', async () => {
      const [req, ctx] = makeRequest(COMMITMENT_ID, {}, 'POST', { 'idempotency-key': 'idem-003' });
      await POST(req, ctx);
      expect(mockIdempotencyComplete).toHaveBeenCalledWith(
        'idem-003',
        expect.objectContaining({ commitmentId: COMMITMENT_ID }),
        200,
      );
    });

    it('idempotency replay returns the exact same fundedAt as the original request', async () => {
      const frozenFundedAt = '2026-08-01T12:00:00.000Z';
      const cachedPayload = { commitmentId: COMMITMENT_ID, txHash: '0xdeadbeef', fundedAt: frozenFundedAt };
      mockIdempotencyGetRecord.mockResolvedValue(completedRecord(cachedPayload));
      const [req, ctx] = makeRequest(COMMITMENT_ID, {}, 'POST', { 'idempotency-key': 'idem-replay' });
      const res = await POST(req, ctx);
      const body = await res.json();
      expect(body.data.fundedAt).toBe(frozenFundedAt);
      expect(mockFundEscrowOnChain).not.toHaveBeenCalled();
    });

    it('idempotency complete stores the same fundedAt that is returned in the response', async () => {
      const [req, ctx] = makeRequest(COMMITMENT_ID, {}, 'POST', { 'idempotency-key': 'idem-ts' });
      const res = await POST(req, ctx);
      const body = await res.json();
      const storedPayload = mockIdempotencyComplete.mock.calls[0][1] as Record<string, unknown>;
      expect(storedPayload.fundedAt).toBe(body.data.fundedAt);
    });

    it('allows retry after FAILED idempotency (getRecord returns null after fail())', async () => {
      mockIdempotencyGetRecord.mockResolvedValue(null);
      const [req, ctx] = makeRequest(COMMITMENT_ID, {}, 'POST', { 'idempotency-key': 'idem-retry' });
      const res = await POST(req, ctx);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockIdempotencyStart).toHaveBeenCalledWith('idem-retry');
      expect(mockFundEscrowOnChain).toHaveBeenCalled();
    });

    it('idempotency key header is propagated to all service calls', async () => {
      const [req, ctx] = makeRequest(COMMITMENT_ID, {}, 'POST', { 'idempotency-key': 'exact-key-value' });
      await POST(req, ctx);
      expect(mockIdempotencyGetRecord).toHaveBeenCalledWith('exact-key-value');
      expect(mockIdempotencyStart).toHaveBeenCalledWith('exact-key-value');
      expect(mockIdempotencyComplete).toHaveBeenCalledWith('exact-key-value', expect.any(Object), 200);
    });
  });

  // ── 400 Validation errors ───────────────────────────────────────────────────

  describe('400 - validation errors', () => {
    it('rejects empty commitment id', async () => {
      mockValidateCommitmentId.mockImplementation(() => {
        throw new ValidationError('Commitment ID is required');
      });
      const [req, ctx] = makeRequest('', {});
      await expectError(req, ctx, 400, 'VALIDATION_ERROR');
    });

    it('rejects whitespace-only id', async () => {
      mockValidateCommitmentId.mockImplementation(() => {
        throw new ValidationError('Commitment ID is required');
      });
      const [req, ctx] = makeRequest('   ', {});
      await expectError(req, ctx, 400, 'VALIDATION_ERROR');
    });

    it('rejects invalid JSON body', async () => {
      const req = new NextRequest(`http://localhost/api/commitments/${COMMITMENT_ID}/fund`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer test-token' },
        body: 'not-json',
      });
      await expectError(req, { params: { id: COMMITMENT_ID } }, 400, 'VALIDATION_ERROR');
    });

    it('rejects a callerAddress that fails Stellar address validation', async () => {
      mockValidateStellarAddress.mockImplementation(() => {
        throw new ValidationError('callerAddress must be a valid Stellar public key');
      });
      const [req, ctx] = makeRequest(COMMITMENT_ID, { callerAddress: 'INVALID' });
      await expectError(req, ctx, 400, 'VALIDATION_ERROR');
    });

    it('rejects a body network passphrase that differs from server config', async () => {
      const [req, ctx] = makeRequest(COMMITMENT_ID, { network: 'Public Global Stellar Network ; September 2015' });
      await expectError(req, ctx, 400, 'VALIDATION_ERROR');
    });

    it('rejects an empty network passphrase in body', async () => {
      const [req, ctx] = makeRequest(COMMITMENT_ID, { network: '' });
      await expectError(req, ctx, 400, 'VALIDATION_ERROR');
    });

    it('rejects an idempotency key longer than 128 characters', async () => {
      const oversizedKey = 'k'.repeat(129);
      const [req, ctx] = makeRequest(COMMITMENT_ID, {}, 'POST', { 'idempotency-key': oversizedKey });
      await expectError(req, ctx, 400, 'VALIDATION_ERROR');
    });

    it('accepts an idempotency key at exactly the 128-char limit', async () => {
      const maxKey = 'k'.repeat(128);
      const [req, ctx] = makeRequest(COMMITMENT_ID, {}, 'POST', { 'idempotency-key': maxKey });
      const res = await POST(req, ctx);
      expect(res.status).toBe(200);
    });

    it('rejects commitment whose amount from chain is zero', async () => {
      mockGetCommitmentFromChain.mockResolvedValue({ ...MOCK_COMMITMENT, amount: '0' });
      const [req, ctx] = makeRequest(COMMITMENT_ID, {});
      await expectError(req, ctx, 400, 'VALIDATION_ERROR');
    });

    it('rejects commitment whose amount from chain is negative', async () => {
      mockGetCommitmentFromChain.mockResolvedValue({ ...MOCK_COMMITMENT, amount: '-500' });
      const [req, ctx] = makeRequest(COMMITMENT_ID, {});
      await expectError(req, ctx, 400, 'VALIDATION_ERROR');
    });

    it('rejects commitment whose amount from chain is NaN text', async () => {
      mockGetCommitmentFromChain.mockResolvedValue({ ...MOCK_COMMITMENT, amount: 'not-a-number' });
      const [req, ctx] = makeRequest(COMMITMENT_ID, {});
      await expectError(req, ctx, 400, 'VALIDATION_ERROR');
    });

    it('rejects a chain response where commitmentId does not match the requested id', async () => {
      mockFundEscrowOnChain.mockResolvedValue({ ...MOCK_FUND_RESULT, commitmentId: 'cmt-DIFFERENT' });
      const [req, ctx] = makeRequest(COMMITMENT_ID, {});
      await expectError(req, ctx, 400, 'VALIDATION_ERROR');
    });

    it('rejects a chain response where txHash is a non-string truthy value', async () => {
      mockFundEscrowOnChain.mockResolvedValue({
        ...MOCK_FUND_RESULT,
        // @ts-expect-error deliberate hostile value
        txHash: 12345,
      });
      const [req, ctx] = makeRequest(COMMITMENT_ID, {});
      await expectError(req, ctx, 400, 'VALIDATION_ERROR');
    });
  });

  // ── 401 Unauthorized (disconnected wallet / missing session) ─────────────────

  describe('401 - unauthorized', () => {
    it('rejects when no session token is present', async () => {
      mockVerifyAuth.mockImplementation(() => { throw new UnauthorizedError('Bearer token required'); });
      const [req, ctx] = makeRequest(COMMITMENT_ID, {});
      await expectError(req, ctx, 401, 'UNAUTHORIZED');
    });

    it('rejects when session token is expired or invalid', async () => {
      mockVerifyAuth.mockImplementation(() => { throw new UnauthorizedError('Invalid or expired session'); });
      const [req, ctx] = makeRequest(COMMITMENT_ID, {});
      await expectError(req, ctx, 401, 'UNAUTHORIZED');
    });

    it('rejects a disconnected wallet scenario (no auth header)', async () => {
      mockVerifyAuth.mockImplementation(() => { throw new UnauthorizedError('Bearer token required'); });
      const req = new NextRequest(`http://localhost/api/commitments/${COMMITMENT_ID}/fund`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      await expectError(req, { params: { id: COMMITMENT_ID } }, 401, 'UNAUTHORIZED');
    });
  });

  // ── 403 Forbidden ────────────────────────────────────────────────────────────

  describe('403 - forbidden', () => {
    it('rejects when session address does not match commitment owner', async () => {
      mockVerifyAuth.mockReturnValue({ address: OTHER_ADDRESS, isAdmin: false });
      const [req, ctx] = makeRequest(COMMITMENT_ID, {});
      await expectError(req, ctx, 403, 'FORBIDDEN');
    });

    it('rejects when callerAddress in body does not match the session identity', async () => {
      // Session is OWNER but body asserts OTHER_ADDRESS — mismatch at session check
      const [req, ctx] = makeRequest(COMMITMENT_ID, { callerAddress: OTHER_ADDRESS });
      await expectError(req, ctx, 403, 'FORBIDDEN');
    });

    it('rejects CSRF violation', async () => {
      mockAssertMutationCsrf.mockImplementation(() => {
        throw new CsrfValidationError('Missing CSRF token.');
      });
      const [req, ctx] = makeRequest(COMMITMENT_ID, {});
      await expectError(req, ctx, 403, 'CSRF_INVALID');
    });
  });

  // ── 404 Not Found ─────────────────────────────────────────────────────────────

  describe('404 - not found', () => {
    it('returns 404 when commitment does not exist', async () => {
      mockGetCommitmentFromChain.mockResolvedValue(null);
      const [req, ctx] = makeRequest('nonexistent', {});
      await expectError(req, ctx, 404, 'NOT_FOUND');
    });

    it('does not call fundEscrowOnChain when commitment is not found', async () => {
      mockGetCommitmentFromChain.mockResolvedValue(null);
      const [req, ctx] = makeRequest(COMMITMENT_ID, {});
      await POST(req, ctx);
      expect(mockFundEscrowOnChain).not.toHaveBeenCalled();
    });
  });

  // ── 409 Conflict ──────────────────────────────────────────────────────────────

  describe('409 - conflict', () => {
    const nonCreatedStatuses = [
      'ACTIVE', 'SETTLED', 'VIOLATED', 'EARLY_EXIT', 'DISPUTED', 'UNKNOWN',
    ] as const;

    for (const status of nonCreatedStatuses) {
      it(`rejects funding a commitment with status ${status} (replay guard)`, async () => {
        mockGetCommitmentFromChain.mockResolvedValue({ ...MOCK_COMMITMENT, status } as typeof MOCK_COMMITMENT);
        const [req, ctx] = makeRequest(COMMITMENT_ID, {});
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
      const [req, ctx] = makeRequest(COMMITMENT_ID, {}, 'POST', { 'idempotency-key': 'idem-004' });
      await expectError(req, ctx, 409, 'CONFLICT');
    });

    it('cleans up failed idempotency on conflict to allow retry', async () => {
      const idempotencyKey = 'idempotency-fund-' + randomUUID();
      mockIdempotencyGetRecord.mockResolvedValue(null);
      mockGetCommitmentFromChain.mockResolvedValue({ ...MOCK_COMMITMENT, status: 'ACTIVE' } as typeof MOCK_COMMITMENT);
      const [req, ctx] = makeRequest(COMMITMENT_ID, {}, 'POST', { 'idempotency-key': idempotencyKey });
      await POST(req, ctx);
      expect(mockIdempotencyFail).toHaveBeenCalledWith(idempotencyKey);
    });
  });

  // ── 429 Rate Limited ──────────────────────────────────────────────────────────

  describe('429 - rate limited', () => {
    it('returns 429 when rate limit exceeded', async () => {
      mockCheckRateLimit.mockResolvedValue(false);
      const [req, ctx] = makeRequest(COMMITMENT_ID, {});
      await expectError(req, ctx, 429, 'TOO_MANY_REQUESTS');
    });

    it('includes Retry-After header on 429', async () => {
      mockCheckRateLimit.mockResolvedValue(false);
      mockGetRateLimitWindowSeconds.mockReturnValue(60);
      const [req, ctx] = makeRequest(COMMITMENT_ID, {});
      const res = await POST(req, ctx);
      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBe('60');
    });

    it('does not call fundEscrowOnChain when rate limit is exceeded', async () => {
      mockCheckRateLimit.mockResolvedValue(false);
      const [req, ctx] = makeRequest(COMMITMENT_ID, {});
      await POST(req, ctx);
      expect(mockFundEscrowOnChain).not.toHaveBeenCalled();
    });
  });

  // ── 502 Blockchain error ─────────────────────────────────────────────────────

  describe('502 - blockchain error', () => {
    it('returns 502 when fundEscrowOnChain throws a BLOCKCHAIN_CALL_FAILED BackendError', async () => {
      mockFundEscrowOnChain.mockRejectedValue(
        new BackendError({
          code: 'BLOCKCHAIN_CALL_FAILED',
          message: 'Unable to fund escrow on chain.',
          status: 502,
          details: { method: 'fund_escrow', commitmentId: COMMITMENT_ID },
        }),
      );
      const [req, ctx] = makeRequest(COMMITMENT_ID, {});
      const res = await POST(req, ctx);
      const body = await res.json();
      expect(res.status).toBe(502);
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe('BLOCKCHAIN_CALL_FAILED');
    });

    it('marks idempotency key as failed when blockchain call fails', async () => {
      mockFundEscrowOnChain.mockRejectedValue(
        new BackendError({ code: 'BLOCKCHAIN_CALL_FAILED', message: 'RPC timeout', status: 502 }),
      );
      const [req, ctx] = makeRequest(COMMITMENT_ID, {}, 'POST', { 'idempotency-key': 'idem-502' });
      await POST(req, ctx);
      expect(mockIdempotencyFail).toHaveBeenCalledWith('idem-502');
    });
  });

  // ── 405 Method Not Allowed ────────────────────────────────────────────────────

  describe('405 - method not allowed', () => {
    it('rejects GET requests', async () => {
      const [req, ctx] = makeRequest(COMMITMENT_ID, undefined, 'GET');
      const res = await GET(req, ctx);
      const body = await res.json();
      expect(res.status).toBe(405);
      expect(body.error.code).toBe('METHOD_NOT_ALLOWED');
    });

    it('rejects PUT requests', async () => {
      const [req, ctx] = makeRequest(COMMITMENT_ID, undefined, 'PUT');
      const res = await PUT(req, ctx);
      expect(res.status).toBe(405);
    });

    it('rejects PATCH requests', async () => {
      const [req, ctx] = makeRequest(COMMITMENT_ID, undefined, 'PATCH');
      const res = await PATCH(req, ctx);
      expect(res.status).toBe(405);
    });

    it('rejects DELETE requests', async () => {
      const [req, ctx] = makeRequest(COMMITMENT_ID, undefined, 'DELETE');
      const res = await DELETE(req, ctx);
      expect(res.status).toBe(405);
    });
  });

  // ── OPTIONS ──────────────────────────────────────────────────────────────────

  describe('OPTIONS', () => {
    it('returns 204 for OPTIONS preflight', async () => {
      const req = new NextRequest(`http://localhost/api/commitments/${COMMITMENT_ID}/fund`, {
        method: 'OPTIONS',
        headers: { 'access-control-request-method': 'POST' },
      });
      const res = await OPTIONS(req);
      expect(res.status).toBe(204);
    });
  });

  // ── Error handling and idempotency cleanup ────────────────────────────────────

  describe('error handling', () => {
    it('fails idempotency key when getCommitmentFromChain throws', async () => {
      mockGetCommitmentFromChain.mockRejectedValue(new Error('RPC failure'));
      const [req, ctx] = makeRequest(COMMITMENT_ID, {}, 'POST', { 'idempotency-key': 'idem-005' });
      await POST(req, ctx);
      expect(mockIdempotencyFail).toHaveBeenCalledWith('idem-005');
    });

    it('fails idempotency key when authorization is rejected', async () => {
      mockVerifyAuth.mockImplementation(() => { throw new UnauthorizedError('Invalid or expired session'); });
      const [req, ctx] = makeRequest(COMMITMENT_ID, {}, 'POST', { 'idempotency-key': 'idem-006' });
      await POST(req, ctx);
      expect(mockIdempotencyFail).toHaveBeenCalledWith('idem-006');
    });

    it('does not call idempotencyFail when no idempotency key is present', async () => {
      mockGetCommitmentFromChain.mockRejectedValue(new Error('RPC failure'));
      const [req, ctx] = makeRequest(COMMITMENT_ID, {});
      await POST(req, ctx);
      expect(mockIdempotencyFail).not.toHaveBeenCalled();
    });

    it('returns 500 for unexpected errors', async () => {
      mockGetCommitmentFromChain.mockRejectedValue(new Error('Unexpected DB error'));
      const [req, ctx] = makeRequest(COMMITMENT_ID, {});
      const res = await POST(req, ctx);
      const body = await res.json();
      expect(res.status).toBe(500);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });

    it('returns 500 with x-correlation-id header on unhandled error', async () => {
      mockGetCommitmentFromChain.mockRejectedValue(new Error('boom'));
      const [req, ctx] = makeRequest(COMMITMENT_ID, {}, 'POST', { 'x-correlation-id': 'err-corr-001' });
      const res = await POST(req, ctx);
      expect(res.status).toBe(500);
      expect(res.headers.get('x-correlation-id')).toBe('err-corr-001');
    });
  });

  // ── Boundary / edge cases ─────────────────────────────────────────────────────

  describe('boundary and edge cases', () => {
    it('accepts a commitment id with special characters (URL-encoded)', async () => {
      const specialId = 'cmt-abc_123-XYZ';
      mockFundEscrowOnChain.mockResolvedValue({ ...MOCK_FUND_RESULT, commitmentId: specialId });
      const [req, ctx] = makeRequest(specialId, {});
      const res = await POST(req, ctx);
      expect(mockGetCommitmentFromChain).toHaveBeenCalledWith(specialId);
      expect(res.status).toBe(200);
    });

    it('does not call fundEscrowOnChain when CSRF check throws', async () => {
      mockAssertMutationCsrf.mockImplementation(() => {
        throw new CsrfValidationError('Missing CSRF token.');
      });
      const [req, ctx] = makeRequest(COMMITMENT_ID, {});
      await POST(req, ctx);
      expect(mockFundEscrowOnChain).not.toHaveBeenCalled();
    });

    it('does not call fundEscrowOnChain when status is not CREATED', async () => {
      mockGetCommitmentFromChain.mockResolvedValue({ ...MOCK_COMMITMENT, status: 'SETTLED' } as typeof MOCK_COMMITMENT);
      const [req, ctx] = makeRequest(COMMITMENT_ID, {});
      await POST(req, ctx);
      expect(mockFundEscrowOnChain).not.toHaveBeenCalled();
    });

    it('error response body has success: false at top level', async () => {
      mockGetCommitmentFromChain.mockResolvedValue(null);
      const [req, ctx] = makeRequest('nonexistent', {});
      const res = await POST(req, ctx);
      const body = await res.json();
      expect(body.success).toBe(false);
    });
  });
});
