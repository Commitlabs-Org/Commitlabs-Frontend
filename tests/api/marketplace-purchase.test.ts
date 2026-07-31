/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockRequest, parseResponse, createMockRouteContext } from './helpers';

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn(),
  getRateLimitWindowSeconds: vi.fn(() => 60),
}));

vi.mock('@/lib/backend/csrf', () => ({
  assertMutationCsrf: vi.fn(),
}));

vi.mock('@/lib/backend/services/contracts', () => ({
  transferOwnership: vi.fn(),
}));

vi.mock('@/lib/backend/services/marketplace', () => ({
  marketplaceService: {
    getListing: vi.fn(),
    completePurchase: vi.fn(),
  },
}));

vi.mock('@/lib/backend/getClientIp', () => ({
  getClientIp: vi.fn(() => '192.168.1.100'),
}));

import { POST, GET, PUT, PATCH, DELETE } from '@/app/api/marketplace/listings/[id]/purchase/route';
import type { NextRequest } from 'next/server';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { assertMutationCsrf } from '@/lib/backend/csrf';
import { transferOwnership } from '@/lib/backend/services/contracts';
import { marketplaceService } from '@/lib/backend/services/marketplace';
import { CsrfValidationError } from '@/lib/backend/errors';

const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedAssertMutationCsrf = vi.mocked(assertMutationCsrf);
const mockedTransferOwnership = vi.mocked(transferOwnership);
const mockedGetListing = vi.mocked(marketplaceService.getListing);
const mockedCompletePurchase = vi.mocked(marketplaceService.completePurchase);

const mockPOST = POST as (
  req: NextRequest,
  context: { params: Record<string, string> },
) => Promise<Response>;

const SELLER_ADDRESS = 'GSELLERADDRESS000000000000000000000000000000000000000';
const BUYER_ADDRESS = 'GBUYERADDRESS0000000000000000000000000000000000000000';

const ACTIVE_LISTING = {
  id: 'listing_1_123',
  commitmentId: 'commitment_123',
  price: '1000.50',
  currencyAsset: 'USDC',
  sellerAddress: SELLER_ADDRESS,
  status: 'Active' as const,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const SOLD_LISTING = {
  ...ACTIVE_LISTING,
  status: 'Sold' as const,
  updatedAt: '2026-01-02T00:00:00.000Z',
};

const TRANSFER_RESULT = {
  commitmentId: 'commitment_123',
  fromAddress: SELLER_ADDRESS,
  toAddress: BUYER_ADDRESS,
  txHash: '0xabc123',
};

function purchaseRequest(listingId: string, body?: Record<string, unknown>) {
  return [
    createMockRequest(`http://localhost:3000/api/marketplace/listings/${listingId}/purchase`, {
      method: 'POST',
      body,
    }),
    createMockRouteContext({ id: listingId }),
  ] as const;
}

describe('POST /api/marketplace/listings/[id]/purchase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCheckRateLimit.mockResolvedValue(true);
    mockedAssertMutationCsrf.mockImplementation(() => {});
    mockedGetListing.mockResolvedValue(ACTIVE_LISTING as any);
    mockedTransferOwnership.mockResolvedValue(TRANSFER_RESULT);
    mockedCompletePurchase.mockResolvedValue(SOLD_LISTING as any);
  });

  describe('successful purchase — end to end', () => {
    it('transfers ownership on-chain and completes the listing purchase', async () => {
      const [req, ctx] = purchaseRequest('listing_1_123', { buyerAddress: BUYER_ADDRESS });
      const response = await mockPOST(req, ctx);
      const result = await parseResponse(response);

      expect(result.status).toBe(200);
      expect(result.data.success).toBe(true);
      expect(result.data.data).toMatchObject({
        listingId: 'listing_1_123',
        commitmentId: 'commitment_123',
        buyerAddress: BUYER_ADDRESS,
        sellerAddress: SELLER_ADDRESS,
        txHash: '0xabc123',
      });

      // The listing is looked up, ownership is transferred on-chain for the
      // underlying commitment, and the listing is then marked Sold — in
      // that order.
      expect(mockedGetListing).toHaveBeenCalledWith('listing_1_123');
      expect(mockedTransferOwnership).toHaveBeenCalledWith({
        commitmentId: 'commitment_123',
        fromAddress: SELLER_ADDRESS,
        toAddress: BUYER_ADDRESS,
      });
      expect(mockedCompletePurchase).toHaveBeenCalledWith('listing_1_123', BUYER_ADDRESS);

      const getListingOrder = mockedGetListing.mock.invocationCallOrder[0];
      const transferOrder = mockedTransferOwnership.mock.invocationCallOrder[0];
      const completeOrder = mockedCompletePurchase.mock.invocationCallOrder[0];
      expect(getListingOrder).toBeLessThan(transferOrder);
      expect(transferOrder).toBeLessThan(completeOrder);
    });

    it('enforces CSRF protection for the mutation', async () => {
      const [req, ctx] = purchaseRequest('listing_1_123', { buyerAddress: BUYER_ADDRESS });
      await mockPOST(req, ctx);

      expect(mockedAssertMutationCsrf).toHaveBeenCalledWith(req);
    });

    it('applies per-IP rate limiting', async () => {
      const [req, ctx] = purchaseRequest('listing_1_123', { buyerAddress: BUYER_ADDRESS });
      await mockPOST(req, ctx);

      expect(mockedCheckRateLimit).toHaveBeenCalledWith(
        expect.any(String),
        'api/marketplace/listings/purchase',
      );
    });
  });

  describe('400 - validation errors', () => {
    it('rejects a missing buyerAddress', async () => {
      const [req, ctx] = purchaseRequest('listing_1_123', {});
      const response = await mockPOST(req, ctx);
      const result = await parseResponse(response);

      expect(result.status).toBe(400);
      expect(result.data.error.code).toBe('VALIDATION_ERROR');
      expect(mockedTransferOwnership).not.toHaveBeenCalled();
    });

    it('rejects invalid JSON body', async () => {
      const req = createMockRequest(
        'http://localhost:3000/api/marketplace/listings/listing_1_123/purchase',
        { method: 'POST' },
      );
      // Force an invalid JSON body.
      Object.defineProperty(req, 'json', {
        value: () => Promise.reject(new Error('bad json')),
      });
      const response = await mockPOST(req, createMockRouteContext({ id: 'listing_1_123' }));
      const result = await parseResponse(response);

      expect(result.status).toBe(400);
      expect(result.data.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('403 - forbidden', () => {
    it('rejects CSRF violations', async () => {
      mockedAssertMutationCsrf.mockImplementation(() => {
        throw new CsrfValidationError('Missing CSRF token.');
      });

      const [req, ctx] = purchaseRequest('listing_1_123', { buyerAddress: BUYER_ADDRESS });
      const response = await mockPOST(req, ctx);
      const result = await parseResponse(response);

      expect(result.status).toBe(403);
      expect(result.data.error.code).toBe('CSRF_INVALID');
    });

    it('rejects a buyer purchasing their own listing', async () => {
      const [req, ctx] = purchaseRequest('listing_1_123', { buyerAddress: SELLER_ADDRESS });
      const response = await mockPOST(req, ctx);
      const result = await parseResponse(response);

      expect(result.status).toBe(403);
      expect(result.data.error.code).toBe('FORBIDDEN');
      expect(mockedTransferOwnership).not.toHaveBeenCalled();
    });
  });

  describe('404 - not found', () => {
    it('returns 404 when the listing does not exist', async () => {
      mockedGetListing.mockResolvedValue(null);

      const [req, ctx] = purchaseRequest('nonexistent', { buyerAddress: BUYER_ADDRESS });
      const response = await mockPOST(req, ctx);
      const result = await parseResponse(response);

      expect(result.status).toBe(404);
      expect(result.data.error.code).toBe('NOT_FOUND');
    });
  });

  describe('409 - conflict', () => {
    it('rejects purchasing a non-Active listing', async () => {
      mockedGetListing.mockResolvedValue({ ...ACTIVE_LISTING, status: 'Sold' } as any);

      const [req, ctx] = purchaseRequest('listing_1_123', { buyerAddress: BUYER_ADDRESS });
      const response = await mockPOST(req, ctx);
      const result = await parseResponse(response);

      expect(result.status).toBe(409);
      expect(result.data.error.code).toBe('CONFLICT');
      expect(mockedTransferOwnership).not.toHaveBeenCalled();
    });
  });

  describe('429 - rate limited', () => {
    it('returns 429 when the rate limit is exceeded', async () => {
      mockedCheckRateLimit.mockResolvedValue(false);

      const [req, ctx] = purchaseRequest('listing_1_123', { buyerAddress: BUYER_ADDRESS });
      const response = await mockPOST(req, ctx);
      const result = await parseResponse(response);

      expect(result.status).toBe(429);
      expect(result.data.error.code).toBe('TOO_MANY_REQUESTS');
    });
  });

  describe('blockchain failure', () => {
    it('propagates a failure from the on-chain transfer without marking the listing sold', async () => {
      mockedTransferOwnership.mockRejectedValue(
        new Error('Soroban simulation failed for transfer_ownership.'),
      );

      const [req, ctx] = purchaseRequest('listing_1_123', { buyerAddress: BUYER_ADDRESS });
      const response = await mockPOST(req, ctx);
      const result = await parseResponse(response);

      expect(result.status).toBe(500);
      expect(result.data.error.code).toBe('INTERNAL_ERROR');
      expect(mockedCompletePurchase).not.toHaveBeenCalled();
    });
  });

  describe('405 - method not allowed', () => {
    it('rejects GET requests', async () => {
      const [req, ctx] = purchaseRequest('listing_1_123');
      const response = await GET(req as unknown as NextRequest, ctx);
      expect(response.status).toBe(405);
    });

    it('rejects PUT requests', async () => {
      const [req, ctx] = purchaseRequest('listing_1_123');
      const response = await PUT(req as unknown as NextRequest, ctx);
      expect(response.status).toBe(405);
    });

    it('rejects PATCH requests', async () => {
      const [req, ctx] = purchaseRequest('listing_1_123');
      const response = await PATCH(req as unknown as NextRequest, ctx);
      expect(response.status).toBe(405);
    });

    it('rejects DELETE requests', async () => {
      const [req, ctx] = purchaseRequest('listing_1_123');
      const response = await DELETE(req as unknown as NextRequest, ctx);
      expect(response.status).toBe(405);
    });
  });
});
