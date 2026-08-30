import { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok } from '@/lib/backend/apiResponse';
import { requireAuth } from '@/lib/backend/requireAuth';
import { marketplaceService } from '@/lib/backend/services/marketplace';
import { transferOwnership } from '@/lib/backend/services/contracts';
import { appendAuditEvent } from '@/lib/backend/auditLog';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { BadRequestError, TooManyRequestsError } from '@/lib/backend/errors';
import { logInfo } from '@/lib/backend/logger';

export const POST = withApiHandler(async (req: NextRequest, { params }: { params: { id: string } }) => {
  // 0. Rate-limit guard (keyed per buyer session after auth resolves below)
  const authReq = requireAuth(req);
  const buyerAddress = authReq.user.address;

  if (!(await checkRateLimit(buyerAddress, 'api/marketplace/purchase'))) {
    throw new TooManyRequestsError();
  }

  const listingId = params.id;

  if (!listingId) {
    throw new BadRequestError('Missing listing ID');
  }

  // 1. Load listing — NotFoundError if absent
  const listing = await marketplaceService.getListing(listingId);
  if (!listing) {
    const { NotFoundError } = await import('@/lib/backend/errors');
    throw new NotFoundError('Listing', { listingId });
  }

  // 2. Atomic availability re-check via preflight:
  //    - listing must be Active (not Sold, not Cancelled)
  //    - buyer cannot be the seller
  //    - commitment must not be non-transferable
  const preflight = await marketplaceService.getPurchasePreflight(listingId, buyerAddress);
  if (!preflight.eligible) {
    const { ConflictError } = await import('@/lib/backend/errors');
    throw new ConflictError(
      `Purchase not eligible: ${preflight.reasons.join(', ')}`,
      { listingId, reasons: preflight.reasons },
    );
  }

  logInfo(req, 'Marketplace purchase initiated', { listingId, buyerAddress });

  // 3. On-chain ownership transfer
  const transfer = await transferOwnership({
    commitmentId: listing.commitmentId,
    fromAddress: listing.sellerAddress,
    toAddress: buyerAddress,
  });

  // 4. Atomically mark the listing as Sold so concurrent purchasers get a 409.
  //    ConflictError here means a concurrent purchase won the race — surface it.
  await marketplaceService.markSold(listingId, buyerAddress);

  // 5. Audit log (best-effort, after state mutation)
  await appendAuditEvent({
    category: 'marketplace',
    action: 'marketplace.purchase',
    severity: 'info',
    actor: buyerAddress,
    resourceId: listingId,
    metadata: {
      listingId,
      commitmentId: listing.commitmentId,
      price: listing.price,
      currencyAsset: listing.currencyAsset,
      txHash: transfer.txHash ?? null,
      reference: transfer.reference ?? null,
    },
  });

  return ok({
    listingId,
    commitmentId: listing.commitmentId,
    buyerAddress,
    price: listing.price,
    currencyAsset: listing.currencyAsset,
    txHash: transfer.txHash ?? null,
    reference: transfer.reference ?? null,
  });
});
