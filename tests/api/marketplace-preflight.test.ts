import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRequest, createMockRouteContext, parseResponse } from './helpers';

vi.mock('@/lib/backend/services/marketplace', () => ({
  marketplaceService: {
    getPurchasePreflight: vi.fn(),
  },
}));

vi.mock('@/lib/backend/validation', () => {
  class ValidationError extends Error {
    constructor(
      message: string,
      public field?: string,
    ) {
      super(message);
      this.name = 'ValidationError';
    }
  }

  return {
    ValidationError,
    validateAddress: vi.fn((address: string) => {
      if (address === 'not-a-stellar-address') {
        throw new ValidationError('Invalid Stellar address format', 'address');
      }

      return address;
    }),
  };
});

import { POST } from '@/app/api/marketplace/listings/[id]/preflight/route';
import { marketplaceService } from '@/lib/backend/services/marketplace';
import { validateAddress } from '@/lib/backend/validation';

const BUYER_ADDRESS = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

function makeRequest(body: Record<string, unknown>) {
  return createMockRequest(
    'http://localhost:3000/api/marketplace/listings/listing_1/preflight',
    {
      method: 'POST',
      body,
    },
  );
}

function makeContext(id = 'listing_1') {
  return createMockRouteContext({ id });
}

describe('POST /api/marketplace/listings/[id]/preflight', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(marketplaceService.getPurchasePreflight).mockResolvedValue({
      eligible: true,
      reasons: [],
    });
  });

  it('returns an eligible preflight result for a valid buyer', async () => {
    const res = await POST(
      makeRequest({ buyerAddress: BUYER_ADDRESS }),
      makeContext(),
      'corr-preflight-eligible',
    );
    const { status, data } = await parseResponse(res);

    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual({ eligible: true, reasons: [] });
    expect(validateAddress).toHaveBeenCalledWith(BUYER_ADDRESS);
    expect(marketplaceService.getPurchasePreflight).toHaveBeenCalledWith(
      'listing_1',
      BUYER_ADDRESS,
    );
  });

  it('returns an ineligible result for a sold-out or inactive listing', async () => {
    vi.mocked(marketplaceService.getPurchasePreflight).mockResolvedValue({
      eligible: false,
      reasons: ['listing_inactive'],
    });

    const res = await POST(
      makeRequest({ buyerAddress: BUYER_ADDRESS }),
      makeContext('sold_out_listing'),
      'corr-preflight-inactive',
    );
    const { status, data } = await parseResponse(res);

    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual({
      eligible: false,
      reasons: ['listing_inactive'],
    });
    expect(marketplaceService.getPurchasePreflight).toHaveBeenCalledWith(
      'sold_out_listing',
      BUYER_ADDRESS,
    );
  });

  it('returns an ineligible result when the buyer is the seller', async () => {
    vi.mocked(marketplaceService.getPurchasePreflight).mockResolvedValue({
      eligible: false,
      reasons: ['buyer_is_seller'],
    });

    const res = await POST(
      makeRequest({ buyerAddress: BUYER_ADDRESS }),
      makeContext(),
      'corr-preflight-seller',
    );
    const { status, data } = await parseResponse(res);

    expect(status).toBe(200);
    expect(data.data.eligible).toBe(false);
    expect(data.data.reasons).toContain('buyer_is_seller');
  });

  it('returns 400 when buyerAddress is missing', async () => {
    const res = await POST(makeRequest({}), makeContext(), 'corr-preflight-missing');
    const { status, data } = await parseResponse(res);

    expect(status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('BAD_REQUEST');
    expect(data.error.message).toBe('Missing buyerAddress');
    expect(marketplaceService.getPurchasePreflight).not.toHaveBeenCalled();
  });

  it('returns 400 when buyerAddress is malformed', async () => {
    const res = await POST(
      makeRequest({ buyerAddress: 'not-a-stellar-address' }),
      makeContext(),
      'corr-preflight-invalid',
    );
    const { status, data } = await parseResponse(res);

    expect(status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('BAD_REQUEST');
    expect(data.error.message).toContain('Invalid buyerAddress format');
    expect(marketplaceService.getPurchasePreflight).not.toHaveBeenCalled();
  });
});
