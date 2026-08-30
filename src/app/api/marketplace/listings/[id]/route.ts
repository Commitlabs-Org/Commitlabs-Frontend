import { NextRequest, NextResponse } from 'next/server';
import { ok, methodNotAllowed } from '@/lib/backend/apiResponse';
import { createCorsOptionsHandler, type CorsRoutePolicy } from '@/lib/backend/cors';
import { NotFoundError } from '@/lib/backend/errors';
import { getClientIp } from '@/lib/backend/getClientIp';
import { isFeatureEnabled } from '@/lib/backend/config';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { marketplaceService } from '@/lib/marketplace';
import { validateListingId } from '@/lib/marketplace/validation';
import { enforceMarketplaceRateLimit } from '@/lib/marketplace/rate-limit';
import { emitMarketplaceTelemetry } from '@/lib/marketplace/telemetry';
import { MARKETPLACE_RATE_LIMIT_ACTIONS } from '@/lib/marketplace/constants';

const MARKETPLACE_LISTING_DETAIL_TIMEOUT_MS = 5000; // Explicit bound for listing detail fetch to prevent unbounded latency.

const MARKETPLACE_LISTING_DETAIL_CORS_POLICY = {
  GET: { access: 'public' },
} satisfies CorsRoutePolicy;

export const OPTIONS = createCorsOptionsHandler(MARKETPLACE_LISTING_DETAIL_CORS_POLICY);

export const GET = withApiHandler(
  async (req: NextRequest, { params }, correlationId) => {
    const startedAt = Date.now();
    const rawListingId = params.id;
    try {
      if (!isFeatureEnabled('marketplace')) {
        return NextResponse.json(
          {
            error: {
              code: 'NOT_FOUND',
              message: 'Marketplace feature is disabled.',
              details: { feature: 'marketplace' },
            },
          },
          { status: 404 },
        );
      }

      const ip = getClientIp(req);
      await enforceMarketplaceRateLimit(ip, MARKETPLACE_RATE_LIMIT_ACTIONS.DETAIL);

      const listingId = validateListingId(params.id);
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const listingPromise = marketplaceService.getListing(listingId);
      listingPromise.catch(() => {});
      const listing = await Promise.race([
        listingPromise,
        new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            const err = new Error('Marketplace listing fetch timed out');
            (err as any).code = 'MARKETPLACE_LISTING_TIMEOUT';
            (err as any).status = 504;
            reject(err);
          }, MARKETPLACE_LISTING_DETAIL_TIMEOUT_MS);
        }),
      ]).finally(() => {
        if (timeoutId) clearTimeout(timeoutId);
      });
      if (!listing) {
        throw new NotFoundError('Listing', { listingId });
      }

      const response = ok({ listing }, undefined, 200, correlationId);
      emitMarketplaceTelemetry({
        event: 'marketplace.listing.get.success',
        correlationId,
        method: 'GET',
        listingId,
        path: `/api/marketplace/listings/${listingId}`,
        statusCode: 200,
        latencyMs: Date.now() - startedAt,
      });
      return response;
    } catch (error) {
      const err = error as { code?: string; status?: number };
      emitMarketplaceTelemetry({
        event: 'marketplace.listing.get.failed',
        correlationId,
        method: 'GET',
        listingId: rawListingId,
        path: '/api/marketplace/listings/[id]',
        errorCode: err.code,
        statusCode: err.status ?? 500,
        latencyMs: Date.now() - startedAt,
      });
      throw error;
    }
  },
  { cors: MARKETPLACE_LISTING_DETAIL_CORS_POLICY, enableETag: true },
);

const _405 = methodNotAllowed(['GET']);
export { _405 as POST, _405 as PUT, _405 as PATCH, _405 as DELETE };