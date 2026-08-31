import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ok, methodNotAllowed } from '@/lib/backend/apiResponse';
import { assertMutationCsrf } from '@/lib/backend/csrf';
import { isFeatureEnabled } from '@/lib/backend/config';
import { createCorsOptionsHandler, type CorsRoutePolicy } from '@/lib/backend/cors';
import { ValidationError } from '@/lib/backend/errors';
import { getClientIp } from '@/lib/backend/getClientIp';
import { parseJsonWithLimit } from '@/lib/backend/jsonBodyLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { marketplaceService } from '@/lib/marketplace';
import {
  MARKETPLACE_PURCHASE_JSON_BODY_LIMIT_BYTES,
  MARKETPLACE_RATE_LIMIT_ACTIONS,
} from '@/lib/marketplace/constants';
import { enforceMarketplaceRateLimit } from '@/lib/marketplace/rate-limit';
import { emitMarketplaceTelemetry } from '@/lib/marketplace/telemetry';
import { validateListingId } from '@/lib/marketplace/validation';

const PurchaseRequestSchema = z.object({
  buyerAddress: z.string().min(1, 'buyerAddress is required').trim(),
});

const MARKETPLACE_PURCHASE_CORS_POLICY = {
  POST: { access: 'first-party' },
} satisfies CorsRoutePolicy;

const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';
const MAX_IDEMPOTENCY_KEY_LENGTH = 128;
const CACHE_CONTROL_NO_STORE = 'no-store';
const MAX_CONCURRENT_PURCHASES = 10;
const PURCHASE_PATH = '/api/marketplace/listings/[id]/purchase';

let activePurchases = 0;

export const OPTIONS = createCorsOptionsHandler(MARKETPLACE_PURCHASE_CORS_POLICY);

export const POST = withApiHandler(
  async (req: NextRequest, { params }, correlationId) => {
    const startedAt = Date.now();
    let effectiveCorrelationId = correlationId;

    // Bound the number of in-flight purchase operations to protect the chain
    // gateway and the marketplace lock table under load.
    if (activePurchases >= MAX_CONCURRENT_PURCHASES) {
      emitMarketplaceTelemetry({
        event: 'marketplace.purchase.api.saturated',
        correlationId: effectiveCorrelationId,
        method: 'POST',
        path: PURCHASE_PATH,
        statusCode: 429,
        latencyMs: Date.now() - startedAt,
        details: { retryable: true },
      });
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'TOO_MANY_REQUESTS',
            message: 'Too many concurrent purchase requests. Please retry.',
          },
        },
        { status: 429 },
      );
    }
    activePurchases++;
    try {
      if (!isFeatureEnabled('marketplace')) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Marketplace feature is disabled.',
              details: { feature: 'marketplace' },
            },
          },
          { status: 404 },
        );
      }

      assertMutationCsrf(req);

      const ip = getClientIp(req);
      await enforceMarketplaceRateLimit(ip, MARKETPLACE_RATE_LIMIT_ACTIONS.PURCHASE);

      const listingId = validateListingId(params.id ?? '');

      const body = await parseJsonWithLimit(req, {
        limitBytes: MARKETPLACE_PURCHASE_JSON_BODY_LIMIT_BYTES,
      });

      const validation = PurchaseRequestSchema.safeParse(body);
      if (!validation.success) {
        throw new ValidationError('Invalid request data', validation.error.issues);
      }

      const buyerAddress = validation.data.buyerAddress;

      // Idempotency-Key is accepted as a correlation handle for retry-friendly
      // telemetry and logging. Undertaking deduplication itself is delegated to
      // the marketplace service's per-listing purchase lock.
      const idempotencyKey = req.headers.get(IDEMPOTENCY_KEY_HEADER);
      if (idempotencyKey !== null && idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
        throw new ValidationError('Idempotency-Key header is too long', [
          {
            path: ['idempotencyKey'],
            message: `Maximum length is ${MAX_IDEMPOTENCY_KEY_LENGTH}`,
          },
        ]);
      }
      if (idempotencyKey !== null) {
        effectiveCorrelationId = idempotencyKey;
      }

      const {
        listing: purchasedListing,
        transfer,
        commitmentId,
        sellerAddress,
      } = await marketplaceService.purchaseListing({
        listingId,
        buyerAddress,
        correlationId: effectiveCorrelationId,
      });

      const responseData = {
        listingId: purchasedListing.id,
        commitmentId,
        buyerAddress,
        sellerAddress,
        txHash: transfer.txHash,
        purchasedAt: purchasedListing.updatedAt,
      };

      const response = ok(responseData, undefined, 200, effectiveCorrelationId);
      response.headers.set('Cache-Control', CACHE_CONTROL_NO_STORE);
      emitMarketplaceTelemetry({
        event: 'marketplace.purchase.api.succeeded',
        correlationId: effectiveCorrelationId,
        method: 'POST',
        path: PURCHASE_PATH,
        statusCode: 200,
        latencyMs: Date.now() - startedAt,
        details: { listingId: purchasedListing.id },
      });
      return response;
    } catch (error) {
      const err = error as { code?: string; status?: number };
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      const statusCode = err.status ?? 500;
      const retryable = statusCode === 429 || statusCode >= 500;
      emitMarketplaceTelemetry({
        event: 'marketplace.purchase.api.failed',
        correlationId,
        method: 'POST',
        path: PURCHASE_PATH,
        errorCode: err.code ?? errorName,
        statusCode,
        latencyMs: Date.now() - startedAt,
        details: { retryable },
      });
      throw error;
    } finally {
      activePurchases--;
    }
  },
  { cors: MARKETPLACE_PURCHASE_CORS_POLICY },
);

const _405 = methodNotAllowed(['POST']);
export { _405 as GET, _405 as PUT, _405 as PATCH, _405 as DELETE };
