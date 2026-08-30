import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createMockRequest, createMockRouteContext, parseResponse } from './helpers';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/backend/requireAuth', () => ({
  requireAuth: vi.fn(),
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

vi.mock('@/lib/backend/auditLog', () => ({
  appendAuditEvent: vi.fn(),
}));

vi.mock('@/lib/backend/logger', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { POST } from '@/app/api/marketplace/listings/[id]/purchase/route';
import { requireAuth } from '@/lib/backend/requireAuth';
import { marketplaceService } from '@/lib/backend/services/marketplace';
import { transferOwnership } from '@/lib/backend/services/contracts';
import { appendAuditEvent } from '@/lib/backend/auditLog';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BUYER = 'GBUYERADDRESS000000000000000000000000000000000000000000000';
const SELLER = 'GSELLERADDRESS00000000000000000000000000000000000000000000';

const mockListing = {
  id: 'listing_1',
  commitmentId: 'cm_abc',
  price: '52000',
  currencyAsset: 'USDC',
  sellerAddress: SELLER,
  status: 'Active',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const soldListing = {
  ...mockListing,
  status: 'Sold',
  updatedAt: '2026-08-30T08:00:00.000Z',
};

const mockTransfer = {
  commitmentId: 'cm_abc',
  fromAddress: SELLER,
  toAddress: BUYER,
  txHash: undefined as string | undefined,
  reference: 'TODO_CHAIN_CALL_TRANSFER_OWNERSHIP',
};

function makeRequest(listingId = 'listing_1') {
  return createMockRequest(
    `http://localhost:3000/api/marketplace/listings/${listingId}/purchase`,
    { method: 'POST' },
  );
}

function makeContext(id = 'listing_1') {
  return createMockRouteContext({ id });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/marketplace/listings/[id]/purchase', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: authenticated buyer
    vi.mocked(requireAuth).mockReturnValue({
      user: { address: BUYER, csrfToken: 'tok' },
    } as ReturnType<typeof requireAuth>);

    vi.mocked(marketplaceService.getListing).mockResolvedValue(mockListing as unknown as Awaited<ReturnType<typeof marketplaceService.getListing>>);
    vi.mocked(marketplaceService.getPurchasePreflight).mockResolvedValue({
      eligible: true,
      reasons: [],
    });
    vi.mocked(marketplaceService.markSold).mockResolvedValue(soldListing as unknown as Awaited<ReturnType<typeof marketplaceService.markSold>>);
    vi.mocked(transferOwnership).mockResolvedValue(mockTransfer as unknown as Awaited<ReturnType<typeof transferOwnership>>);
    vi.mocked(appendAuditEvent).mockResolvedValue(undefined);
  });

  // ─── Success ────────────────────────────────────────────────────────────────

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

  it('includes reference in response when no txHash', async () => {
    const res = await POST(makeRequest(), makeContext());
    const { data } = await parseResponse(res);

    expect(data.data.reference).toBe('TODO_CHAIN_CALL_TRANSFER_OWNERSHIP');
  });

  it('includes txHash in response when transfer returns one', async () => {
    vi.mocked(transferOwnership).mockResolvedValue({
      ...mockTransfer,
      txHash: 'abc123txhash',
      reference: undefined,
    } as unknown as Awaited<ReturnType<typeof transferOwnership>>);

    const res = await POST(makeRequest(), makeContext());
    const { data } = await parseResponse(res);

    expect(data.data.txHash).toBe('abc123txhash');
  });

  it('calls transferOwnership with the correct commitment and address params', async () => {
    await POST(makeRequest(), makeContext());

    expect(transferOwnership).toHaveBeenCalledWith({
      commitmentId: 'cm_abc',
      fromAddress: SELLER,
      toAddress: BUYER,
    });
  });

  it('calls markSold after a successful on-chain transfer', async () => {
    await POST(makeRequest(), makeContext());

    expect(marketplaceService.markSold).toHaveBeenCalledWith('listing_1', BUYER);
  });

  it('calls markSold after transferOwnership, not before', async () => {
    const order: string[] = [];
    vi.mocked(transferOwnership).mockImplementation(async () => {
      order.push('transfer');
      return mockTransfer as unknown as Awaited<ReturnType<typeof transferOwnership>>;
    });
    vi.mocked(marketplaceService.markSold).mockImplementation(async () => {
      order.push('markSold');
      return soldListing as unknown as Awaited<ReturnType<typeof marketplaceService.markSold>>;
    });

    await POST(makeRequest(), makeContext());

    expect(order).toEqual(['transfer', 'markSold']);
  });

  it('records an audit event on success', async () => {
    await POST(makeRequest(), makeContext());

    expect(appendAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'marketplace',
        action: 'marketplace.purchase',
        severity: 'info',
        actor: BUYER,
        resourceId: 'listing_1',
      }),
    );
  });

  it('audit event metadata contains listing and commitment details', async () => {
    vi.mocked(transferOwnership).mockResolvedValue({
      ...mockTransfer,
      txHash: 'tx_hash_xyz',
    } as unknown as Awaited<ReturnType<typeof transferOwnership>>);

    await POST(makeRequest(), makeContext());

    expect(appendAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          listingId: 'listing_1',
          commitmentId: 'cm_abc',
          price: '52000',
          currencyAsset: 'USDC',
          txHash: 'tx_hash_xyz',
        }),
      }),
    );
  });

  it('includes correlation ID header in response', async () => {
    const res = await POST(makeRequest(), makeContext());
    expect(
      res.headers.get('x-correlation-id') || res.headers.get('x-request-id'),
    ).toBeTruthy();
  });

  // ─── Authentication ─────────────────────────────────────────────────────────

  it('returns 401 when not authenticated (no session cookie)', async () => {
    const { UnauthorizedError } = await import('@/lib/backend/errors');
    vi.mocked(requireAuth).mockImplementation(() => {
      throw new UnauthorizedError('No session token provided');
    });

    const res = await POST(makeRequest(), makeContext());
    const { status, data } = await parseResponse(res);

    expect(status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when session token is invalid or expired', async () => {
    const { UnauthorizedError } = await import('@/lib/backend/errors');
    vi.mocked(requireAuth).mockImplementation(() => {
      throw new UnauthorizedError('Invalid session token');
    });

    const res = await POST(makeRequest(), makeContext());
    const { status, data } = await parseResponse(res);

    expect(status).toBe(401);
    expect(data.success).toBe(false);
  });

  it('does not call getListing when authentication fails', async () => {
    const { UnauthorizedError } = await import('@/lib/backend/errors');
    vi.mocked(requireAuth).mockImplementation(() => {
      throw new UnauthorizedError();
    });

    await POST(makeRequest(), makeContext());

    expect(marketplaceService.getListing).not.toHaveBeenCalled();
  });

  // ─── Not found ──────────────────────────────────────────────────────────────

  it('returns 404 when listing does not exist', async () => {
    vi.mocked(marketplaceService.getListing).mockResolvedValue(null);

    const res = await POST(makeRequest('nonexistent'), makeContext('nonexistent'));
    const { status, data } = await parseResponse(res);

    expect(status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('NOT_FOUND');
  });

  it('does not call preflight when listing is not found', async () => {
    vi.mocked(marketplaceService.getListing).mockResolvedValue(null);

    await POST(makeRequest(), makeContext());

    expect(marketplaceService.getPurchasePreflight).not.toHaveBeenCalled();
  });

  // ─── Preflight / availability invariants ────────────────────────────────────

  it('returns 409 when listing is inactive (already sold)', async () => {
    vi.mocked(marketplaceService.getPurchasePreflight).mockResolvedValue({
      eligible: false,
      reasons: ['listing_inactive'],
    });

    const res = await POST(makeRequest(), makeContext());
    const { status, data } = await parseResponse(res);

    expect(status).toBe(409);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('CONFLICT');
    expect(data.error.message).toContain('listing_inactive');
  });

  it('returns 409 when buyer is the seller', async () => {
    vi.mocked(marketplaceService.getPurchasePreflight).mockResolvedValue({
      eligible: false,
      reasons: ['buyer_is_seller'],
    });

    const res = await POST(makeRequest(), makeContext());
    const { status, data } = await parseResponse(res);

    expect(status).toBe(409);
    expect(data.error.message).toContain('buyer_is_seller');
  });

  it('returns 409 when commitment is non-transferable', async () => {
    vi.mocked(marketplaceService.getPurchasePreflight).mockResolvedValue({
      eligible: false,
      reasons: ['non_transferable'],
    });

    const res = await POST(makeRequest(), makeContext());
    const { status, data } = await parseResponse(res);

    expect(status).toBe(409);
    expect(data.error.message).toContain('non_transferable');
  });

  it('returns 409 when multiple preflight reasons are present', async () => {
    vi.mocked(marketplaceService.getPurchasePreflight).mockResolvedValue({
      eligible: false,
      reasons: ['listing_inactive', 'buyer_is_seller'],
    });

    const res = await POST(makeRequest(), makeContext());
    const { data } = await parseResponse(res);

    expect(data.error.message).toContain('listing_inactive');
    expect(data.error.message).toContain('buyer_is_seller');
  });

  it('does not call transferOwnership when preflight fails', async () => {
    vi.mocked(marketplaceService.getPurchasePreflight).mockResolvedValue({
      eligible: false,
      reasons: ['listing_inactive'],
    });

    await POST(makeRequest(), makeContext());

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

    await POST(makeRequest(), makeContext());

    expect(appendAuditEvent).not.toHaveBeenCalled();
  });

  // ─── Idempotency / concurrent purchase guard ─────────────────────────────────

  it('returns 409 when markSold detects a concurrent sale (listing already Sold)', async () => {
    const { ConflictError } = await import('@/lib/backend/errors');
    vi.mocked(marketplaceService.markSold).mockRejectedValue(
      new ConflictError('Listing has already been sold.', {
        listingId: 'listing_1',
        currentStatus: 'Sold',
      }),
    );

    const res = await POST(makeRequest(), makeContext());
    const { status, data } = await parseResponse(res);

    expect(status).toBe(409);
    expect(data.error.message).toContain('already been sold');
  });

  it('returns 409 when markSold detects listing was cancelled concurrently', async () => {
    const { ConflictError } = await import('@/lib/backend/errors');
    vi.mocked(marketplaceService.markSold).mockRejectedValue(
      new ConflictError('Only active listings can be marked as sold.', {
        listingId: 'listing_1',
        currentStatus: 'Cancelled',
      }),
    );

    const res = await POST(makeRequest(), makeContext());
    const { status, data } = await parseResponse(res);

    expect(status).toBe(409);
    expect(data.success).toBe(false);
  });

  it('does not record audit event when markSold fails', async () => {
    const { ConflictError } = await import('@/lib/backend/errors');
    vi.mocked(marketplaceService.markSold).mockRejectedValue(
      new ConflictError('Listing has already been sold.'),
    );

    await POST(makeRequest(), makeContext());

    expect(appendAuditEvent).not.toHaveBeenCalled();
  });

  // ─── On-chain transfer failures ──────────────────────────────────────────────

  it('returns 5xx when on-chain transfer fails with a generic error', async () => {
    vi.mocked(transferOwnership).mockRejectedValue(
      new Error('Soroban RPC unreachable'),
    );

    const res = await POST(makeRequest(), makeContext());
    const { status, data } = await parseResponse(res);

    expect(status).toBeGreaterThanOrEqual(500);
    expect(data.success).toBe(false);
  });

  it('does not call markSold when on-chain transfer fails', async () => {
    vi.mocked(transferOwnership).mockRejectedValue(new Error('RPC error'));

    await POST(makeRequest(), makeContext());

    expect(marketplaceService.markSold).not.toHaveBeenCalled();
  });

  it('does not record audit event when on-chain transfer fails', async () => {
    vi.mocked(transferOwnership).mockRejectedValue(new Error('RPC error'));

    await POST(makeRequest(), makeContext());

    expect(appendAuditEvent).not.toHaveBeenCalled();
  });

  // ─── Retry safety ────────────────────────────────────────────────────────────

  it('on retry after partial failure: markSold re-validates Active state before Sold transition', async () => {
    // Simulate a retry: the listing is now Sold from the first attempt
    // markSold should surface a 409 to the caller so they can reconcile
    const { ConflictError } = await import('@/lib/backend/errors');
    vi.mocked(marketplaceService.markSold).mockRejectedValue(
      new ConflictError('Listing has already been sold.', { listingId: 'listing_1' }),
    );

    const res = await POST(makeRequest(), makeContext());
    const { status } = await parseResponse(res);

    // The retry attempt fails with 409 — prevents double-transfer
    expect(status).toBe(409);
    // transferOwnership was called (on-chain part ran), but not again for the listing store
    expect(transferOwnership).toHaveBeenCalledTimes(1);
  });

  // ─── Service errors ───────────────────────────────────────────────────────────

  it('returns 500 when getListing throws unexpectedly', async () => {
    vi.mocked(marketplaceService.getListing).mockRejectedValue(
      new Error('Database connection lost'),
    );

    const res = await POST(makeRequest(), makeContext());
    const { status, data } = await parseResponse(res);

    expect(status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('INTERNAL_ERROR');
  });

  it('returns 500 when getPurchasePreflight throws unexpectedly', async () => {
    vi.mocked(marketplaceService.getPurchasePreflight).mockRejectedValue(
      new Error('Preflight service crash'),
    );

    const res = await POST(makeRequest(), makeContext());
    const { status, data } = await parseResponse(res);

    expect(status).toBe(500);
    expect(data.success).toBe(false);
  });

  it('returns 500 when appendAuditEvent throws unexpectedly', async () => {
    vi.mocked(appendAuditEvent).mockRejectedValue(new Error('Audit log unavailable'));

    const res = await POST(makeRequest(), makeContext());
    const { status, data } = await parseResponse(res);

    expect(status).toBe(500);
    expect(data.success).toBe(false);
  });

  it('surfaces InternalError from marketplaceService.getListing as 500', async () => {
    const { InternalError } = await import('@/lib/backend/errors');
    vi.mocked(marketplaceService.getListing).mockRejectedValue(
      new InternalError('Marketplace storage is temporarily unavailable. Please try again later.'),
    );

    const res = await POST(makeRequest(), makeContext());
    const { status, data } = await parseResponse(res);

    expect(status).toBe(500);
    expect(data.error.code).toBe('INTERNAL_ERROR');
  });

  // ─── Parameter handling ───────────────────────────────────────────────────────

  it('uses the listing ID from route params, not from body', async () => {
    await POST(makeRequest('listing_999'), makeContext('listing_999'));

    expect(marketplaceService.getListing).toHaveBeenCalledWith('listing_999');
  });

  it('passes buyer address from authenticated session to preflight', async () => {
    await POST(makeRequest(), makeContext());

    expect(marketplaceService.getPurchasePreflight).toHaveBeenCalledWith(
      'listing_1',
      BUYER,
    );
  });

  it('passes seller address from listing to transferOwnership', async () => {
    await POST(makeRequest(), makeContext());

    expect(transferOwnership).toHaveBeenCalledWith(
      expect.objectContaining({ fromAddress: SELLER }),
    );
  });

  it('passes buyer address from session to transferOwnership', async () => {
    await POST(makeRequest(), makeContext());

    expect(transferOwnership).toHaveBeenCalledWith(
      expect.objectContaining({ toAddress: BUYER }),
    );
  });
});
