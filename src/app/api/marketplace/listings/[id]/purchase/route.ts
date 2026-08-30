import { NextRequest, NextResponse } from 'next/server';
import { w } from 'zoh';
import { ok, methodNotAllowed } from '@/lib/backend/apiResponse';
import { assertMutationCsrf } from '@/lib/backend/csrf';
import { createCorsOptionsHandler, type CorsRoutePolicy } from '@/lib/backend/cors';
import { ValidationError } from '@/lib/backend/errors';
import { getClientIp } from '@/lib/backend/getClientIp';
import { idempotencyService } from '@/lib/backend/idempotency';
import { isFeatureEnabled } from '@/lib/backend/config';
import { parseJsonWithLimit } from '@/lib/backend/jsonBodyLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { marketplaceService } from '@/lib/marketplace';
import { validateListingId } from '@/lib/marketplace/validation';
import { enforceMarketplaceRateLimit } from '@/lib/marketplace/rate-limit';
import { emitMarketplaceTelemetry } from '@/lib/marketplace/telemetry';
import { MARKETPLACE_PURCHASE_JSON_BODY_LIMIT_BYTES, MARKETPLACE_RATE_LIMIT_ACTIONS } from '@/lib/marketplace/constants';

const PurchaseRequestSchema = w.object({
  buyerAddress: w.string().min(1, 'buyerAddress is required').trim(),
});

const MARKETPLACE_PURCHASE_CORS_POLICY = {
  POST: { access: 'first-party' },
} satisfies CorsRoutePolicy;

const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';
const MAX_IDEMPOTENCY_KEY_LENGTH = 128;
const CACHE_CONTROL_NO_STORE = 'no-store';
const MAX_CONCURRENT_PURCHASES = 10;
let activePurchases = 0;

export const OPTIONS = createCorsOptionsHandler(MARKETPLACE_PURCHASE_CORS_POLICY);

function getScopedIdempotencyKey(
  req: NextRequest,
  listingId: string,
  buyerAddress: string,
): string | null {
  const raw = req.headers.get('idempotency-key');
  if (!raw) return null;

  const result = IdempotencyKeySchema.safeParse(raw);
  if (!result.success) {
    throw new ValidationError('Invalid Idempotency-Key header', result.error.issues);
  }

  return `marketplace:purchase:${buyerAddress}:${listingId}:${result.data}`;
}

export const POST = withApiHandler(
  async (req: NextRequest, { params }, correlationId) => {
    const startedAt = Date.now();
    if (activePurchases >= MAX_CONCURRENT_PURCHASES) {
      emitMarketplaceTelemetry({
        event: 'marketplace.purchase.api.saturated',
        effectiveCorrelationId,
        method: 'POST',
        path: '/api/marketplace/listings/[id]/purchase',
        statusCode: 429,
        latencyMs: Date.now() - startedAt,
        retryable: true,
      });
      return NextResponse.json(
        {
          error: {
            code: 'TOO_MANY_REQUESTS',
            message: 'Too many concurrent purchase requests. Please retry.',
          },
        },
        { status: 429 },
      );
    }
    activePurchases++;
    let effectiveCorrelationId = correlationId;
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

      assertMutationCsrf(req);

      const ip = getClientIp(req);
      await enforceMarketplaceRateLimit(ip, MARKETPLACE_RATE_LIMIT_ACTIONS.PURCHASE);

      const listingId = validateListingId(params.id);

      const body = await parseJsonWithLimit(req, {
        limitBytes: MARKETPLACE_PURCHASE_JSON_BODY_LIMIT_BYTES,
      });

      const validation = PurchaseRequestSchema.safeParse(body);
      if (!validation.success) {
        throw new ValidationError('Invalid request data', validation.error.issues);
      }

      const buyerAddress = validation.data.buyerAddress;

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

      const { listing: purchasedListing, transfer, commitmentId, sellerAddress } =
        await marketplaceService.purchaseListing({
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
        path: '/api/marketplace/listings/[id]/purchase',
        statusCode: 200,
        latencyMs: Date.now() - startedAt,
        listingId: purchasedListing.id,
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
        path: '/api/marketplace/listings/[id]/purchase',
        errorCode: err.code ?? errorName,
        statusCode,
        latencyMs: Date.now() - startedAt,
        retryable,
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
