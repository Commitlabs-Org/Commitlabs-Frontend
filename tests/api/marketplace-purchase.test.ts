import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRequest, createMockRouteContext, parseResponse } from './helpers';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/backend/requireAuth', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/backend/services/marketplace', () => ({
  marketplaceService: {
    getListing: vi.fn(),
    getPurchasePreflight: vi.fn(),
  },
}));

vi.mock('@/lib/backend/services/contracts', () => ({
  transferOwnership: vi.fn(),
}));

vi.mock('@/lib/backend/auditLog', () => ({
  appendAuditEvent: vi.fn(),
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

const mockTransfer = {
  commitmentId: 'cm_abc',
  newOwner: BUYER,
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
    } as any);

    vi.mocked(marketplaceService.getListing).mockResolvedValue(mockListing as any);
    vi.mocked(marketplaceService.getPurchasePreflight).mockResolvedValue({
      eligible: true,
      reasons: [],
    });
    vi.mocked(transferOwnership).mockResolvedValue(mockTransfer);
    vi.mocked(appendAuditEvent).mockResolvedValue(undefined);
  });

  it('returns 200 with purchase details on success', async () => {
    const res = await POST(makeRequest(), makeContext());
    const { status, data } = await parseResponse(res);

    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.listingId).toBe('listing_1');
    expect(data.data.commitmentId).toBe('cm_abc');
    expect(data.data.buyerAddress).toBe(BUYER);
    expect(data.data.price).toBe('52000');
  });

  it('calls transferOwnership with correct params', async () => {
    await POST(makeRequest(), makeContext());

    expect(transferOwnership).toHaveBeenCalledWith({
      commitmentId: 'cm_abc',
      fromAddress: SELLER,
      toAddress: BUYER,
    });
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

  it('returns 401 when not authenticated', async () => {
    const { UnauthorizedError } = await import('@/lib/backend/errors');
    vi.mocked(requireAuth).mockImplementation(() => {
      throw new UnauthorizedError('No session token provided');
    });

    const res = await POST(makeRequest(), makeContext());
    const { status, data } = await parseResponse(res);

    expect(status).toBe(401);
    expect(data.success).toBe(false);
  });

  it('returns 404 when listing does not exist', async () => {
    vi.mocked(marketplaceService.getListing).mockResolvedValue(null);

    const res = await POST(makeRequest(), makeContext());
    const { status, data } = await parseResponse(res);

    expect(status).toBe(404);
    expect(data.success).toBe(false);
  });

  it('returns 409 when preflight fails (listing inactive)', async () => {
    vi.mocked(marketplaceService.getPurchasePreflight).mockResolvedValue({
      eligible: false,
      reasons: ['listing_inactive'],
    });

    const res = await POST(makeRequest(), makeContext());
    const { status, data } = await parseResponse(res);

    expect(status).toBe(409);
    expect(data.success).toBe(false);
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
    expect(data.success).toBe(false);
  });

  it('does not call transferOwnership when preflight fails', async () => {
    vi.mocked(marketplaceService.getPurchasePreflight).mockResolvedValue({
      eligible: false,
      reasons: ['listing_inactive'],
    });

    await POST(makeRequest(), makeContext());

    expect(transferOwnership).not.toHaveBeenCalled();
  });

  it('does not record audit event when preflight fails', async () => {
    vi.mocked(marketplaceService.getPurchasePreflight).mockResolvedValue({
      eligible: false,
      reasons: ['listing_inactive'],
    });

    await POST(makeRequest(), makeContext());

    expect(appendAuditEvent).not.toHaveBeenCalled();
  });

  it('returns 5xx when on-chain transfer fails', async () => {
    vi.mocked(transferOwnership).mockRejectedValue(
      new Error('Soroban RPC unreachable'),
    );

    const res = await POST(makeRequest(), makeContext());
    const { status, data } = await parseResponse(res);

    expect(status).toBeGreaterThanOrEqual(500);
    expect(data.success).toBe(false);
  });

  it('includes txHash in response when transfer returns one', async () => {
    vi.mocked(transferOwnership).mockResolvedValue({
      ...mockTransfer,
      txHash: 'abc123txhash',
      reference: undefined,
    });

    const res = await POST(makeRequest(), makeContext());
    const { data } = await parseResponse(res);

    expect(data.data.txHash).toBe('abc123txhash');
  });
});
