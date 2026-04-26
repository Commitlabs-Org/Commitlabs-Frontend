import { NextRequest, type NextResponse } from 'next/server';
import { ok } from '@/lib/backend/apiResponse';
import { TooManyRequestsError } from '@/lib/backend/errors';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import {
  FEATURED_MARKETPLACE_CACHE_CONTROL,
  marketplaceService,
  type MarketplacePublicListing,
} from '@/lib/backend/services/marketplace';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { attachSecurityHeaders } from '@/utils/response';

interface FeaturedMarketplaceResponse {
  listings: MarketplacePublicListing[];
  total: number;
}

function withFeaturedResponseHeaders(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', FEATURED_MARKETPLACE_CACHE_CONTROL);
  return attachSecurityHeaders(response) as NextResponse;
}

export const GET = withApiHandler(async (req: NextRequest) => {
  const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'anonymous';
  const isAllowed = await checkRateLimit(ip, 'api/marketplace/featured');

  if (!isAllowed) {
    throw new TooManyRequestsError();
  }

  const listings = await marketplaceService.getFeaturedListings();
  const response = ok<FeaturedMarketplaceResponse>({
    listings,
    total: listings.length,
  });

  return withFeaturedResponseHeaders(response);
});
