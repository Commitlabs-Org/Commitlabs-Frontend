/**
 * Comprehensive route-level tests for POST /api/marketplace/listings/[id]/purchase
 *
 * Covers: success, failure, boundary, rate-limit, permission, idempotency
 * (double-purchase), sold/cancelled/non-transferable listing states,
 * on-chain error handling, and audit log invariants.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRequest, createMockRouteContext, parseResponse } from './helpers';

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn(),
  getRateLimitWindowSeconds: vi.fn(() => 60),
}));

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/backend/services/marketplace', () => ({
  marketplaceService: {
    getListing: vi.fn(),
    getPurchasePreflight: vi.fn(),
    markSold: vi.fn(),
  },
}));

vi.mock('@/lib/backend/services/contracts', () => ({
  transferOwnership: vi.fn(),
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
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { POST } from '@/app/api/marketplace/listings/[id]/purchase/route';
import { requireAuth } from '@/lib/backend/requireAuth';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { marketplaceService } from '@/lib/backend/services/marketplace';
import { transferOwnership } from '@/lib/backend/services/contracts';
import { idempotencyService } from '@/lib/backend/idempotency';
import { marketplaceService } from '@/lib/backend/services/marketplace';
import { idempotencyService } from '@/lib/backend/idempotency';
import { verifyAuth } from '@/lib/backend/requireAuth';
import { CsrfValidationError, ConflictError, UnauthorizedError } from '@/lib/backend/errors';

const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedAssertMutationCsrf = vi.mocked(assertMutationCsrf);
const mockedTransferOwnership = vi.mocked(transferOwnership);
const mockedGetListing = vi.mocked(marketplaceService.getListing);
const mockedCompletePurchase = vi.mocked(marketplaceService.completePurchase);
const mockedIdempotencyGetRecord = vi.mocked(idempotencyService.getRecord);
const mockedIdempotencyStart = vi.mocked(idempotencyService.start);

const mockPOST = POST as (
  req: NextRequest,
  context: { params: Record<string, string> },
) => Promise<Response>;

const activeListing = {
  id: 'listing_1',
  commitmentId: 'cm_abc',
  price: '52000',
  currencyAsset: 'USDC',
  sellerAddress: SELLER_ADDRESS,
  status: 'Active' as const,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const soldListing = { ...activeListing, status: 'Sold' };
const cancelledListing = { ...activeListing, status: 'Cancelled' };
const nonTransferableListing = { ...activeListing, commitmentId: 'cm_non-transferable_xyz' };

const mockTransfer = {
  commitmentId: 'cm_abc',
  newOwner: BUYER,
  txHash: 'chain-tx-hash-abc',
  reference: 'ref-001',
};

const TRANSFER_RESULT = {
  commitmentId: 'commitment_123',
  fromAddress: SELLER_ADDRESS,
  toAddress: BUYER_ADDRESS,
  txHash: '0xabc123',
};

function purchaseRequest(
  listingId: string,
  body: Record<string, unknown> = {
    buyerAddress: BUYER_ADDRESS,
    networkPassphrase: NETWORK_PASSPHRASE,
  },
  headers: Record<string, string> = { authorization: 'Bearer valid-session' },
) {
  return [
    createMockRequest(`http://localhost:3000/api/marketplace/listings/${listingId}/purchase`, {
      method: 'POST',
      body,
      headers,
    }),
    createMockRouteContext({ id: listingId }),
  ] as const;
}

describe('POST /api/marketplace/listings/[id]/purchase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCheckRateLimit.mockResolvedValue(true);
    mockedAssertMutationCsrf.mockImplementation(() => {});
    mockedVerifyAuth.mockReturnValue({ address: BUYER_ADDRESS, isAdmin: false });
    mockedIdempotencyGetRecord.mockResolvedValue(null);
    mockedIdempotencyStart.mockResolvedValue(true);
    mockedIdempotencyComplete.mockResolvedValue(undefined);
    mockedIdempotencyFail.mockResolvedValue(undefined);
    mockedGetListing.mockResolvedValue(ACTIVE_LISTING as any);
    mockedTransferOwnership.mockResolvedValue(TRANSFER_RESULT);
    mockedCompletePurchase.mockResolvedValue(SOLD_LISTING as any);
    mockedIdempotencyGetRecord.mockResolvedValue(null);
    mockedIdempotencyStart.mockResolvedValue(true);
  });

    // Default: authenticated buyer, rate-limit passes
    vi.mocked(requireAuth).mockReturnValue({
      user: { address: BUYER, csrfToken: 'tok' },
    } as any);

    vi.mocked(checkRateLimit).mockResolvedValue(true);
    vi.mocked(marketplaceService.getListing).mockResolvedValue(activeListing as any);
    vi.mocked(marketplaceService.getPurchasePreflight).mockResolvedValue({
      eligible: true,
      reasons: [],
    });
    vi.mocked(marketplaceService.markSold).mockResolvedValue(undefined);
    vi.mocked(transferOwnership).mockResolvedValue(mockTransfer);
    vi.mocked(appendAuditEvent).mockResolvedValue(undefined);
  });

  // ── Success path ──────────────────────────────────────────────────────────

  it('returns 200 with purchase details on success', async () => {
    const res = await POST(makeRequest(), makeContext());
    const { status, data } = await parseResponse(res);

    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.listingId).toBe('listing_1');
    expect(data.data.commitmentId).toBe('cm_abc');
    expect(data.data.buyerAddress).toBe(BUYER);
    expect(data.data.price).toBe('52000');
    expect(data.data.currencyAsset).toBe('USDC');
  });

  it('includes txHash in response when transfer returns one', async () => {
    const res = await POST(makeRequest(), makeContext());
    const { data } = await parseResponse(res);

    expect(data.data.txHash).toBe('chain-tx-hash-abc');
    expect(data.data.reference).toBe('ref-001');
  });

  it('coerces missing txHash to null in response', async () => {
    vi.mocked(transferOwnership).mockResolvedValue({
      ...mockTransfer,
      txHash: undefined,
      reference: undefined,
    });

    const res = await POST(makeRequest(), makeContext());
    const { data } = await parseResponse(res);

    expect(data.data.txHash).toBeNull();
    expect(data.data.reference).toBeNull();
  });

    it('applies per-IP rate limiting', async () => {
      const [req, ctx] = purchaseRequest('listing_1_123');
      await mockPOST(req, ctx);

      expect(mockedCheckRateLimit).toHaveBeenCalledWith(
        expect.any(String),
        'api/marketplace/listings/purchase',
      );
    });

    it('replays a completed idempotent purchase response', async () => {
      mockedIdempotencyGetRecord.mockResolvedValue({
        key: 'purchase-key',
        status: 'COMPLETED',
        response: {
          listingId: 'listing_1_123',
          commitmentId: 'commitment_123',
          buyerAddress: BUYER_ADDRESS,
          sellerAddress: SELLER_ADDRESS,
          txHash: '0xcached',
          purchasedAt: '2026-01-02T00:00:00.000Z',
        },
        statusCode: 200,
        createdAt: Date.now(),
        expiresAt: Date.now() + 86400000,
      });

      const [req, ctx] = purchaseRequest('listing_1_123', { buyerAddress: BUYER_ADDRESS });
      Object.defineProperty(req, 'headers', {
        value: new Headers({ 'idempotency-key': 'purchase-key' }),
        configurable: true,
      });

      const response = await mockPOST(req, ctx);
      const result = await parseResponse(response);

      expect(result.status).toBe(200);
      expect(result.data.data.txHash).toBe('0xcached');
      expect(mockedTransferOwnership).not.toHaveBeenCalled();
    });
  });

  it('calls markSold after successful transfer', async () => {
    await POST(makeRequest(), makeContext());

    expect(marketplaceService.markSold).toHaveBeenCalledWith('listing_1', BUYER);
  });

  it('records an audit event on success', async () => {
    await POST(makeRequest(), makeContext());

      const [req, ctx] = purchaseRequest('listing_1_123', { buyerAddress: BUYER_ADDRESS });
      Object.defineProperty(req, 'headers', {
        value: new Headers({ 'idempotency-key': 'purchase-key' }),
        configurable: true,
      });

  it('includes full purchase metadata in audit event', async () => {
    await POST(makeRequest(), makeContext());

    expect(appendAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          listingId: 'listing_1',
          commitmentId: 'cm_abc',
          price: '52000',
          currencyAsset: 'USDC',
          txHash: 'chain-tx-hash-abc',
        }),
      }),
    );
  });

  // ── Authentication & rate limit ────────────────────────────────────────────

  it('returns 401 when caller is unauthenticated', async () => {
    const { UnauthorizedError } = await import('@/lib/backend/errors');
    vi.mocked(requireAuth).mockImplementation(() => {
      throw new UnauthorizedError('No session token provided');
    });

    it('rejects a missing buyerAddress', async () => {
      const [req, ctx] = purchaseRequest('listing_1_123', {
        networkPassphrase: NETWORK_PASSPHRASE,
      });
      const response = await mockPOST(req, ctx);
      const result = await parseResponse(response);

    expect(status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 429 when rate limit is exceeded', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(false);

    const res = await POST(makeRequest(), makeContext());
    const { status, data } = await parseResponse(res);

    expect(status).toBe(429);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('does not call getListing when rate-limited', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(false);

    await POST(makeRequest(), makeContext());

    expect(marketplaceService.getListing).not.toHaveBeenCalled();
  });

  // ── Listing not found ─────────────────────────────────────────────────────

  it('returns 404 when listing does not exist', async () => {
    vi.mocked(marketplaceService.getListing).mockResolvedValue(null);

    const res = await POST(makeRequest('missing_listing'), makeContext('missing_listing'));
    const { status, data } = await parseResponse(res);

    expect(status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('NOT_FOUND');
  });

  it('does not attempt transfer when listing is not found', async () => {
    vi.mocked(marketplaceService.getListing).mockResolvedValue(null);

    await POST(makeRequest(), makeContext());

    expect(transferOwnership).not.toHaveBeenCalled();
  });

  // ── Preflight guard: sold listing ─────────────────────────────────────────

  it('returns 409 when listing is already sold (inactive)', async () => {
    vi.mocked(marketplaceService.getListing).mockResolvedValue(soldListing as any);
    vi.mocked(marketplaceService.getPurchasePreflight).mockResolvedValue({
      eligible: false,
      reasons: ['listing_inactive'],
    });

    it('rejects malformed listing ids before service lookup', async () => {
      const [req, ctx] = purchaseRequest('../listing_1_123');
      const response = await mockPOST(req, ctx);
      const result = await parseResponse(response);

    expect(status).toBe(409);
    expect(data.success).toBe(false);
    expect(data.error.message).toContain('listing_inactive');
  });

  it('returns 409 when listing is cancelled', async () => {
    vi.mocked(marketplaceService.getListing).mockResolvedValue(cancelledListing as any);
    vi.mocked(marketplaceService.getPurchasePreflight).mockResolvedValue({
      eligible: false,
      reasons: ['listing_inactive'],
    });

    const res = await POST(makeRequest(), makeContext());
    const { status, data } = await parseResponse(res);

    expect(status).toBe(409);
    expect(data.success).toBe(false);
  });

  // ── Preflight guard: non-transferable commitment ───────────────────────────

  it('returns 409 for non-transferable commitment', async () => {
    vi.mocked(marketplaceService.getListing).mockResolvedValue(nonTransferableListing as any);
    vi.mocked(marketplaceService.getPurchasePreflight).mockResolvedValue({
      eligible: false,
      reasons: ['non_transferable'],
    });

    const res = await POST(makeRequest(), makeContext());
    const { status, data } = await parseResponse(res);

    expect(status).toBe(409);
    expect(data.error.message).toContain('non_transferable');
  });

  // ── Preflight guard: buyer is seller ──────────────────────────────────────

  it('returns 409 when buyer is the seller', async () => {
    vi.mocked(requireAuth).mockReturnValue({
      user: { address: SELLER, csrfToken: 'tok' },
    } as any);
    vi.mocked(marketplaceService.getPurchasePreflight).mockResolvedValue({
      eligible: false,
      reasons: ['buyer_is_seller'],
    });

    it('rejects invalid buyer wallet addresses', async () => {
      const [req, ctx] = purchaseRequest('listing_1_123', {
        buyerAddress: 'not-a-wallet',
        networkPassphrase: NETWORK_PASSPHRASE,
      });
      const response = await mockPOST(req, ctx);
      const result = await parseResponse(response);

    expect(status).toBe(409);
    expect(data.error.message).toContain('buyer_is_seller');
  });

  // ── Double-purchase idempotency (race-condition guard) ────────────────────

  it('returns 409 when markSold throws ConflictError (concurrent purchase race)', async () => {
    const { ConflictError } = await import('@/lib/backend/errors');
    vi.mocked(marketplaceService.markSold).mockRejectedValue(
      new ConflictError('Listing has already been sold.', { listingId: 'listing_1' }),
    );

    const res = await POST(makeRequest(), makeContext());
    const { status, data } = await parseResponse(res);

    expect(status).toBe(409);
    expect(data.success).toBe(false);
    expect(data.error.message).toContain('already been sold');
  });

  it('does not record audit event when markSold fails (race condition)', async () => {
    const { ConflictError } = await import('@/lib/backend/errors');
    vi.mocked(marketplaceService.markSold).mockRejectedValue(
      new ConflictError('Listing has already been sold.'),
    );

    await POST(makeRequest(), makeContext());

    expect(appendAuditEvent).not.toHaveBeenCalled();
  });

  // ── Preflight blocks side-effects ─────────────────────────────────────────

  it('does not call transferOwnership when preflight fails', async () => {
    vi.mocked(marketplaceService.getPurchasePreflight).mockResolvedValue({
      eligible: false,
      reasons: ['listing_inactive'],
    });

    it('rejects a wallet connected to the wrong network', async () => {
      const [req, ctx] = purchaseRequest('listing_1_123', {
        buyerAddress: BUYER_ADDRESS,
        networkPassphrase: 'Public Global Stellar Network ; September 2015',
      });
      const response = await mockPOST(req, ctx);
      const result = await parseResponse(response);

    expect(transferOwnership).not.toHaveBeenCalled();
  });

  it('does not call markSold when preflight fails', async () => {
    vi.mocked(marketplaceService.getPurchasePreflight).mockResolvedValue({
      eligible: false,
      reasons: ['listing_inactive'],
    });

    await POST(makeRequest(), makeContext());

    expect(marketplaceService.markSold).not.toHaveBeenCalled();
  });

  it('does not record audit event when preflight fails', async () => {
    vi.mocked(marketplaceService.getPurchasePreflight).mockResolvedValue({
      eligible: false,
      reasons: ['listing_inactive'],
    });

    it('rejects tampered extra request fields', async () => {
      const [req, ctx] = purchaseRequest('listing_1_123', {
        buyerAddress: BUYER_ADDRESS,
        networkPassphrase: NETWORK_PASSPHRASE,
        sellerAddress: OTHER_ADDRESS,
      });
      const response = await mockPOST(req, ctx);
      const result = await parseResponse(response);

    expect(appendAuditEvent).not.toHaveBeenCalled();
  });

  // ── On-chain transfer failures ────────────────────────────────────────────

  it('returns 5xx when on-chain transfer fails', async () => {
    vi.mocked(transferOwnership).mockRejectedValue(
      new Error('Soroban RPC unreachable'),
    );

    const res = await POST(makeRequest(), makeContext());
    const { status, data } = await parseResponse(res);

    expect(status).toBeGreaterThanOrEqual(500);
    expect(data.success).toBe(false);
  });

  it('does not mark listing as sold when on-chain transfer fails', async () => {
    vi.mocked(transferOwnership).mockRejectedValue(new Error('RPC timeout'));

    await POST(makeRequest(), makeContext());

    expect(marketplaceService.markSold).not.toHaveBeenCalled();
  });

  it('does not record audit event when on-chain transfer fails', async () => {
    vi.mocked(transferOwnership).mockRejectedValue(new Error('Simulated failure'));

    await POST(makeRequest(), makeContext());

    expect(appendAuditEvent).not.toHaveBeenCalled();
  });

  // ── Multiple preflight reasons ─────────────────────────────────────────────

  it('includes all preflight reason codes in the 409 message', async () => {
    vi.mocked(marketplaceService.getPurchasePreflight).mockResolvedValue({
      eligible: false,
      reasons: ['listing_inactive', 'non_transferable'],
    });

    it('rejects invalid JSON body', async () => {
      const req = createMockRequest(
        'http://localhost:3000/api/marketplace/listings/listing_1_123/purchase',
        { method: 'POST', headers: { authorization: 'Bearer valid-session' } },
      );
      // Force an invalid JSON body.
      Object.defineProperty(req, 'json', {
        value: () => Promise.reject(new Error('bad json')),
      });
      const response = await mockPOST(req, createMockRouteContext({ id: 'listing_1_123' }));
      const result = await parseResponse(response);

    expect(data.error.message).toContain('listing_inactive');
    expect(data.error.message).toContain('non_transferable');
  });

  // ── Response structure ────────────────────────────────────────────────────

  it('includes x-correlation-id header in 200 response', async () => {
    const res = await POST(makeRequest(), makeContext());

    expect(res.headers.get('x-correlation-id')).toBeTruthy();
  });
});
