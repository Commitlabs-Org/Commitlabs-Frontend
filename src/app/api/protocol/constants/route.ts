import { NextRequest } from "next/server";
import { withApiHandler } from "@/lib/backend/withApiHandler";
import { ok } from "@/lib/backend/apiResponse";
import { logInfo } from "@/lib/backend/logger";
import { attachSecurityHeaders } from "@/utils/response";
import { getProtocolConstants } from "@/lib/backend/services/protocolConstants";

/**
 * GET /api/protocol/constants
 *
 * Returns the public protocol constants used by UX copy and calculations,
 * including fee parameters, penalty tiers, and commitment limits.
 *
 * This endpoint is public (no authentication required) because all returned
 * values are non-sensitive protocol parameters.
 *
 * Caching guidance:
 *  - The response includes a `cachedAt` timestamp so clients can tell how
 *    fresh the data is.
 *  - A `Cache-Control` header is set to allow browsers / CDNs to cache the
 *    response for up to 5 minutes, with a stale-while-revalidate window of
 *    60 seconds.
 *  - Server-side, the constants are cached in-memory for the lifetime of
 *    the process (see `getProtocolConstants()`).
 */
export const GET = withApiHandler(async (req: NextRequest) => {
  logInfo(req, "Protocol constants requested");

  const constants = getProtocolConstants();
  const response = ok(constants);

  // Cache for 5 minutes, allow stale for 60 s while revalidating
  response.headers.set(
    "Cache-Control",
    "public, max-age=300, stale-while-revalidate=60",
  );

  return attachSecurityHeaders(response);
});