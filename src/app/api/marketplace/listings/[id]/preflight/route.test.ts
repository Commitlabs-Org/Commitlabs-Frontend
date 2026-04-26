import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { marketplaceService } from '@/lib/backend/services/marketplace';
import { NotFoundError } from '@/lib/backend/errors';
import * as validation from '@/lib/backend/validation';

vi.mock('@/lib/backend/services/marketplace', () => ({
  marketplaceService: {
    getPurchasePreflight: vi.fn(),
  },
}));

vi.mock('@/lib/backend/logger', () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
  getRequestId: vi.fn(() => 'test-request-id'),
}));

// Mock validation to avoid Stellar address checksum issues in tests
vi.mock('@/lib/backend/validation', async () => {
  const actual = await vi.importActual<typeof validation>('@/lib/backend/validation');
  return {
    ...actual,
    validateAddress: vi.fn((addr) => addr),
  };
});

describe('POST /api/marketplace/listings/[id]/preflight', () => {
  const listingId = 'listing_123';
  const buyerAddress = 'GBUYERXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 200 and preflight results on success', async () => {
    const mockResult = { eligible: true, reasons: [] };
    vi.mocked(marketplaceService.getPurchasePreflight).mockResolvedValue(mockResult);

    const req = new NextRequest(`http://localhost/api/marketplace/listings/${listingId}/preflight`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ buyerAddress }),
    });

    const response = await POST(req, { params: { id: listingId } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(mockResult);
    expect(marketplaceService.getPurchasePreflight).toHaveBeenCalledWith(listingId, buyerAddress);
  });

  it('should return 400 if buyerAddress is missing', async () => {
    const req = new NextRequest(`http://localhost/api/marketplace/listings/${listingId}/preflight`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await POST(req, { params: { id: listingId } });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.message).toContain('Missing buyerAddress');
  });

  it('should return 400 if JSON body is invalid', async () => {
    const req = new NextRequest(`http://localhost/api/marketplace/listings/${listingId}/preflight`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid-json',
    });

    const response = await POST(req, { params: { id: listingId } });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.message).toContain('Invalid JSON body');
  });

  it('should return 400 if buyerAddress is invalid format', async () => {
    // Make validateAddress throw for this test
    vi.mocked(validation.validateAddress).mockImplementationOnce(() => {
      throw new validation.ValidationError('Invalid Stellar address format', 'address');
    });

    const req = new NextRequest(`http://localhost/api/marketplace/listings/${listingId}/preflight`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ buyerAddress: 'invalid_address' }),
    });

    const response = await POST(req, { params: { id: listingId } });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.message).toContain('Invalid buyerAddress format');
  });

  it('should return 404 if listing is not found', async () => {
    vi.mocked(marketplaceService.getPurchasePreflight).mockRejectedValue(new NotFoundError('Listing'));

    const req = new NextRequest(`http://localhost/api/marketplace/listings/${listingId}/preflight`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ buyerAddress }),
    });

    const response = await POST(req, { params: { id: listingId } });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});
