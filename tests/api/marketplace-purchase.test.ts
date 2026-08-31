/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockRequest, parseResponse } from './helpers';
import type { NextRequest } from 'next/server';

vi.mock('@/lib/backend/csrf', () => ({
  assertMutationCsrf: vi.fn(),
}));

vi.mock('@/lib/backend/config', () => ({
  isFeatureEnabled: vi.fn(() => true),
}));

vi.mock('@/lib/backend/getClientIp', () => ({
  getClientIp: vi.fn(() => '192.168.1.100'),
}));

vi.mock('@/lib/marketplace/rate-limit', () => ({
  enforceMarketplaceRateLimit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/marketplace/telemetry', () => ({
  emitMarketplaceTelemetry: vi.fn(),
}));

vi.mock('@/lib/marketplace', () => ({
  marketplaceService: {
    purchaseListing: vi.fn(),
  },
}));

import { POST, GET as GET_405, OPTIONS } from '@/app/api/marketplace/listings/[id]/purchase/route';
import { assertMutationCsrf } from '@/lib/backend/csrf';
import { isFeatureEnabled } from '@/lib/backend/config';
import { enforceMarketplaceRateLimit } from '@/lib/marketplace/rate-limit';
import { emitMarketplaceTelemetry } from '@/lib/marketplace/telemetry';
import { marketplaceService } from '@/lib/marketplace';
import {
  CsrfValidationError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
  TooManyRequestsError,
} from '@/lib/backend/errors';

const mockedAssertCsrf = vi.mocked(assertMutationCsrf);
const mockedIsFeatureEnabled = vi.mocked(isFeatureEnabled);
const mockedRateLimit = vi.mocked(enforceMarketplaceRateLimit);
const mockedTelemetry = vi.mocked(emitMarketplaceTelemetry);
const mockedPurchaseListing = vi.mocked(marketplaceService.purchaseListing);

const mockPOST = POST as (
  req: NextRequest,
  context: { params: Record<string, string> },
) => Promise<Response>;

const SELLER_ADDRESS = `G${'A'.repeat(55)}`;
const BUYER_ADDRESS = `G${'B'.repeat(55)}`;
const LISTING_ID = 'listing_1_123';

const PURCHASED_LISTING = {
  id: LISTING_ID,
  commitmentId: 'commitment_123',
  price: '1000.50',
  currencyAsset: 'USDC',
  sellerAddress: SELLER_ADDRESS,
  status: 'Sold' as const,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

const TRANSFER_RESULT = {
  txHash: '0xabc123',
  reference: null,
};

function makeRequest(
  listingId: string,
  body: Record<string, unknown> = { buyerAddress: BUYER_ADDRESS },
  method = 'POST',
  headers: Record<string, string> = {},
): [NextRequest, { params: { id: string } }] {
  return [
    createMockRequest(`http://localhost:3000/api/marketplace/listings/${listingId}/purchase`, {
      method,
      body,
      headers,
    }),
    { params: { id: listingId } },
  ];
}

async function expectError(
  req: NextRequest,
  ctx: { params: { id: string } },
  status: number,
  code?: string,
): Promise<void> {
  const res = await mockPOST(req as any, ctx as any);
  const body = await res.json();
  expect(res.status).toBe(status);
  expect(body.success).toBe(false);
  expect(body.error).toBeDefined();
  if (code) expect(body.error.code).toBe(code);
}

describe('POST /api/marketplace/listings/[id]/purchase - Contract & Invariants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAssertCsrf.mockImplementation(() => undefined);
    mockedIsFeatureEnabled.mockReturnValue(true);
    mockedRateLimit.mockResolvedValue(undefined);
    mockedPurchaseListing.mockResolvedValue({
      listing: PURCHASED_LISTING,
      transfer: TRANSFER_RESULT,
      commitmentId: 'commitment_123',
      sellerAddress: SELLER_ADDRESS,
    } as any);
  });

  // ── Success ────────────────────────────────────────────────────────────────

  it('purchases an active listing', async () => {
    const [req, ctx] = makeRequest(LISTING_ID);
    const res = await mockPOST(req as any, ctx as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.listingId).toBe(LISTING_ID);
    expect(body.data.commitmentId).toBe('commitment_123');
    expect(body.data.buyerAddress).toBe(BUYER_ADDRESS);
    expect(body.data.sellerAddress).toBe(SELLER_ADDRESS);
    expect(body.data.txHash).toBe('0xabc123');
    expect(body.data.purchasedAt).toBe(PURCHASED_LISTING.updatedAt);
    expect(mockedPurchaseListing).toHaveBeenCalledWith({
      listingId: LISTING_ID,
      buyerAddress: BUYER_ADDRESS,
      correlationId: expect.any(String),
    });
  });

  it('sets Cache-Control: no-store on success', async () => {
    const [req, ctx] = makeRequest(LISTING_ID);
    const res = await mockPOST(req as any, ctx as any);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('uses the Idempotency-Key as the correlation id for the purchase', async () => {
    const [req, ctx] = makeRequest(LISTING_ID, { buyerAddress: BUYER_ADDRESS }, 'POST', {
      'idempotency-key': 'purchase-abc',
    });
    const res = await mockPOST(req as any, ctx as any);

    expect(mockedPurchaseListing).toHaveBeenCalledWith(
      expect.objectContaining({ correlationId: 'purchase-abc' }),
    );
    expect(res.headers.get('x-correlation-id')).toBe('purchase-abc');
  });

  it('emits success telemetry', async () => {
    const [req, ctx] = makeRequest(LISTING_ID);
    await mockPOST(req as any, ctx as any);
    expect(mockedTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'marketplace.purchase.api.succeeded', statusCode: 200 }),
    );
  });

  // ── Boundary & Validation ─────────────────────────────────────────────────

  it('rejects an empty listing ID', async () => {
    const [req, ctx] = makeRequest('   ');
    await expectError(req, ctx, 400, 'VALIDATION_ERROR');
  });

  it('rejects a listing ID with invalid characters', async () => {
    const [req, ctx] = makeRequest('../listing_id');
    await expectError(req, ctx, 400, 'VALIDATION_ERROR');
  });

  it('rejects a request body missing buyerAddress', async () => {
    const [req, ctx] = makeRequest(LISTING_ID, {});
    await expectError(req, ctx, 400, 'VALIDATION_ERROR');
  });

  it('rejects an over-long Idempotency-Key header', async () => {
    const [req, ctx] = makeRequest(LISTING_ID, { buyerAddress: BUYER_ADDRESS }, 'POST', {
      'idempotency-key': 'x'.repeat(129),
    });
    const res = await mockPOST(req as any, ctx as any);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  // ── Invariant failures surfaced by the service ────────────────────────────

  it('returns 409 when the listing is no longer active', async () => {
    mockedPurchaseListing.mockRejectedValue(
      new ConflictError('Only active listings can be purchased', { listingId: LISTING_ID }),
    );
    const [req, ctx] = makeRequest(LISTING_ID);
    await expectError(req, ctx, 409, 'CONFLICT');
  });

  it('returns 403 when the buyer is the seller', async () => {
    mockedPurchaseListing.mockRejectedValue(
      new ForbiddenError('Cannot purchase your own listing', { listingId: LISTING_ID }),
    );
    const [req, ctx] = makeRequest(LISTING_ID);
    await expectError(req, ctx, 403, 'FORBIDDEN');
  });

  it('returns 404 when the listing does not exist', async () => {
    mockedPurchaseListing.mockRejectedValue(
      new NotFoundError('Listing', { listingId: LISTING_ID }),
    );
    const [req, ctx] = makeRequest('listing_missing');
    await expectError(req, ctx, 404, 'NOT_FOUND');
  });

  // ── Governance: CSRF, rate limit, feature flag ────────────────────────────

  it('returns 403 CSRF_INVALID when CSRF validation fails', async () => {
    mockedAssertCsrf.mockImplementation(() => {
      throw new CsrfValidationError('Missing CSRF token.');
    });
    const [req, ctx] = makeRequest(LISTING_ID);
    const res = await mockPOST(req as any, ctx as any);
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.error.code).toBe('CSRF_INVALID');
    expect(mockedPurchaseListing).not.toHaveBeenCalled();
  });

  it('returns 429 when the rate limit is exceeded', async () => {
    mockedRateLimit.mockRejectedValue(new TooManyRequestsError());
    const [req, ctx] = makeRequest(LISTING_ID);
    const res = await mockPOST(req as any, ctx as any);
    const body = await res.json();
    expect(res.status).toBe(429);
    expect(body.error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('returns 404 when the marketplace feature is disabled', async () => {
    mockedIsFeatureEnabled.mockReturnValue(false);
    const [req, ctx] = makeRequest(LISTING_ID);
    const res = await mockPOST(req as any, ctx as any);
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(mockedPurchaseListing).not.toHaveBeenCalled();
  });

  // ── Method & Preflight ────────────────────────────────────────────────────

  it('returns 204 for OPTIONS preflight', async () => {
    const req = createMockRequest(
      `http://localhost:3000/api/marketplace/listings/${LISTING_ID}/purchase`,
      {
        method: 'OPTIONS',
        headers: {
          origin: 'http://localhost:3000',
          'access-control-request-method': 'POST',
        },
      },
    );
    const res = await OPTIONS(req as any);
    expect(res.status).toBe(204);
  });

  it('rejects GET with 405', async () => {
    const [req, ctx] = makeRequest(LISTING_ID, null as any, 'GET');
    const res = await GET_405(req as any, ctx as any);
    const body = await res.json();
    expect(res.status).toBe(405);
    expect(body.error.code).toBe('METHOD_NOT_ALLOWED');
  });
});
