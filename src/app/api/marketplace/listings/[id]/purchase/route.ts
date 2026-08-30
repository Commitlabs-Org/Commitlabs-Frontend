import { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok } from '@/lib/backend/apiResponse';
import { requireAuth } from '@/lib/backend/requireAuth';
import { marketplaceService } from '@/lib/backend/services/marketplace';
import { transferOwnership } from '@/lib/backend/services/contracts';
import { appendAuditEvent } from '@/lib/backend/auditLog';
import { BadRequestError, ConflictError, NotFoundError } from '@/lib/backend/errors';
import { logInfo } from '@/lib/backend/logger';

export const POST = withApiHandler(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const authReq = requireAuth(req);
  const buyerAddress = authReq.user.address;
  const listingId = params.id;

  if (!listingId) {
    throw new BadRequestError('Missing listing ID');
  }

  // 1. Load listing — verifies it exists before any preflight or chain work.
  const listing = await marketplaceService.getListing(listingId);
  if (!listing) {
    throw new NotFoundError('Listing', { listingId });
  }

  // 2. Preflight eligibility check — validates Active status, buyer ≠ seller,
  //    non-transferable commitment guard, etc. before touching the chain.
  const preflight = await marketplaceService.getPurchasePreflight(listingId, buyerAddress);
  if (!preflight.eligible) {
    throw new ConflictError(
      `Purchase not eligible: ${preflight.reasons.join(', ')}`,
      { listingId, reasons: preflight.reasons },
    );
  }

  logInfo(req, 'Marketplace purchase initiated', { listingId, buyerAddress });

  // 3. On-chain ownership transfer.
  const transfer = await transferOwnership({
    commitmentId: listing.commitmentId,
    fromAddress: listing.sellerAddress,
    toAddress: buyerAddress,
  });

  // 4. Atomically mark the listing as Sold in persistent storage.
  //    This step re-validates Active status (guards concurrent purchases) and
  //    is the definitive record that the listing has been fulfilled. If this
  //    step fails after a successful chain transfer, the route returns 5xx,
  //    allowing the caller to retry — markSold is idempotent-safe: a second
  //    attempt on an already-Sold listing throws ConflictError (409).
  await marketplaceService.markSold(listingId, buyerAddress);

  // 5. Audit log — fire after all state mutations succeed.
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
      txHash: transfer.txHash,
      reference: transfer.reference,
    },
  });

  return ok({
    listingId,
    commitmentId: listing.commitmentId,
    buyerAddress,
    price: listing.price,
    currencyAsset: listing.currencyAsset,
    txHash: transfer.txHash,
    reference: transfer.reference,
  });
});
