import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { marketplaceService } from '@/lib/backend/services/marketplace';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import type { MarketplacePublicListing } from '@/lib/backend/services/marketplace';

vi.mock('@/lib/backend/services/marketplace', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/backend/services/marketplace')
  >('@/lib/backend/services/marketplace');

  return {
    ...actual,
    marketplaceService: {
      ...actual.marketplaceService,
      getFeaturedListings: vi.fn(),
    },
  };
});

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn(),
}));

const FEATURED_LISTINGS: MarketplacePublicListing[] = [
  {
    listingId: 'LST-001',
    commitmentId: 'CMT-001',
    type: 'Safe',
    amount: 50000,
    remainingDays: 25,
    maxLoss: 2,
    currentYield: 5.2,
    complianceScore: 95,
    price: 52000,
  },
  {
    listingId: 'LST-004',
    commitmentId: 'CMT-004',
    type: 'Safe',
    amount: 75000,
    remainingDays: 15,
    maxLoss: 2,
    currentYield: 4.8,
    complianceScore: 92,
    price: 76500,
  },
];

describe('GET /api/marketplace/featured', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkRateLimit).mockResolvedValue(true);
  });

  it('returns featured listings using the public response envelope', async () => {
    vi.mocked(marketplaceService.getFeaturedListings).mockResolvedValue(
      FEATURED_LISTINGS,
    );

    const request = new NextRequest(
      'http://localhost:3000/api/marketplace/featured',
      { method: 'GET' },
    );

    const response = await GET(request, { params: {} });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      data: {
        listings: FEATURED_LISTINGS,
        total: FEATURED_LISTINGS.length,
      },
    });
    expect(checkRateLimit).toHaveBeenCalledWith(
      'anonymous',
      'api/marketplace/featured',
    );
  });

  it('keeps ordering stable across calls', async () => {
    vi.mocked(marketplaceService.getFeaturedListings).mockResolvedValue(
      FEATURED_LISTINGS,
    );

    const requestA = new NextRequest(
      'http://localhost:3000/api/marketplace/featured',
      { method: 'GET' },
    );
    const requestB = new NextRequest(
      'http://localhost:3000/api/marketplace/featured',
      { method: 'GET' },
    );

    const responseA = await GET(requestA, { params: {} });
    const responseB = await GET(requestB, { params: {} });
    const dataA = await responseA.json();
    const dataB = await responseB.json();

    expect(dataA.data.listings).toEqual(dataB.data.listings);
    expect(dataA.data.listings.map((listing: MarketplacePublicListing) => listing.listingId)).toEqual([
      'LST-001',
      'LST-004',
    ]);
  });

  it('returns an empty list safely when no listings are eligible', async () => {
    vi.mocked(marketplaceService.getFeaturedListings).mockResolvedValue([]);

    const request = new NextRequest(
      'http://localhost:3000/api/marketplace/featured',
      { method: 'GET' },
    );

    const response = await GET(request, { params: {} });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.listings).toEqual([]);
    expect(data.data.total).toBe(0);
  });

  it('applies cache and security headers', async () => {
    vi.mocked(marketplaceService.getFeaturedListings).mockResolvedValue(
      FEATURED_LISTINGS,
    );

    const request = new NextRequest(
      'http://localhost:3000/api/marketplace/featured',
      { method: 'GET' },
    );

    const response = await GET(request, { params: {} });

    expect(response.headers.get('Cache-Control')).toBe(
      'public, max-age=300, s-maxage=300, stale-while-revalidate=600',
    );
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
  });

  it('matches the existing public marketplace auth posture', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(false);

    const request = new NextRequest(
      'http://localhost:3000/api/marketplace/featured',
      { method: 'GET' },
    );

    const response = await GET(request, { params: {} });
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('TOO_MANY_REQUESTS');
    expect(marketplaceService.getFeaturedListings).not.toHaveBeenCalled();
  });
});
