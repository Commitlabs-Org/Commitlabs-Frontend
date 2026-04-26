import { NextRequest } from 'next/server';
import { withApiHandler } from "@/lib/backend/withApiHandler";
import { ok, fail } from "@/lib/backend/apiResponse";
import { marketplaceService } from "@/lib/backend/services/marketplace";
import { validateAddress, ValidationError as ValidationUtilError } from "@/lib/backend/validation";
import { logInfo } from "@/lib/backend/logger";
import { BadRequestError } from "@/lib/backend/errors";

export const POST = withApiHandler(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const listingId = params.id;
  
  let body;
  try {
    body = await req.json();
  } catch (error) {
    throw new BadRequestError("Invalid JSON body");
  }

  const { buyerAddress } = body;

  if (!buyerAddress) {
    throw new BadRequestError("Missing buyerAddress");
  }

  try {
    validateAddress(buyerAddress);
  } catch (error) {
    if (error instanceof ValidationUtilError) {
      throw new BadRequestError(`Invalid buyerAddress format: ${error.message}`);
    }
    throw error;
  }

  logInfo(req, "Marketplace purchase preflight request", { listingId, buyerAddress });

  const result = await marketplaceService.getPurchasePreflight(listingId, buyerAddress);
  
  return ok(result);
});
