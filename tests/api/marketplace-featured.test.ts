import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRequest, parseResponse } from './helpers';

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn(),
}));

vi.mock('@/lib/backend/services/marketplace', () => ({
  FEATURED_MARKETPLACE_CACHE_CONTROL:
    'public, max-age=300, s-maxage=300, stale-while-revalidate=600',
  marketplaceService: {
    getFeaturedListings: vi.fn(),
  },
}));

import { GET } from '@/app/api/marketplace/featured/route';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import {
  FEATURED_MARKETPLACE_CACHE_CONTROL,
  marketplaceService,
} from '@/lib/backend/services/marketplace';

const featuredListing = {
  listingId: 'LST-001',
  commitmentId: 'CMT-001',
  type: 'Safe',
  amount: 50000,
  remainingDays: 25,
  maxLoss: 2,
  currentYield: 5.2,
  complianceScore: 95,
  price: 52000,
};

function makeRequest(ip = '203.0.113.10') {
  return createMockRequest('http://localhost:3000/api/marketplace/featured', {
    headers: {
      'x-forwarded-for': ip,
    },
  });
}

describe('GET /api/marketplace/featured', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkRateLimit).mockResolvedValue(true);
    vi.mocked(marketplaceService.getFeaturedListings).mockResolvedValue([
      featuredListing as any,
    ]);
  });

  it('returns featured listings with total count and cache/security headers', async () => {
    const res = await GET(makeRequest(), { params: {} }, 'corr-featured');
    const { status, data, headers } = await parseResponse(res);

    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual({
      listings: [featuredListing],
      total: 1,
    });
    expect(headers.get('Cache-Control')).toBe(FEATURED_MARKETPLACE_CACHE_CONTROL);
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('X-Frame-Options')).toBe('DENY');
    expect(checkRateLimit).toHaveBeenCalledWith(
      '203.0.113.10',
      'api/marketplace/featured',
    );
  });

  it('returns an empty featured set with a zero total', async () => {
    vi.mocked(marketplaceService.getFeaturedListings).mockResolvedValue([]);

    const res = await GET(makeRequest(), { params: {} }, 'corr-featured-empty');
    const { status, data } = await parseResponse(res);

    expect(status).toBe(200);
    expect(data.data).toEqual({
      listings: [],
      total: 0,
    });
  });

  it('returns 429 when the route is rate limited', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(false);

    const res = await GET(makeRequest(), { params: {} }, 'corr-featured-limit');
    const { status, data, headers } = await parseResponse(res);

    expect(status).toBe(429);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('TOO_MANY_REQUESTS');
    expect(headers.get('Retry-After')).toBe('60');
    expect(marketplaceService.getFeaturedListings).not.toHaveBeenCalled();
  });
});
