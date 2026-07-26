import { NextRequest } from "next/server";
import { ok, methodNotAllowed, attachSecurityHeaders } from "@/lib/backend/apiResponse";
import { createCorsOptionsHandler, type CorsRoutePolicy } from "@/lib/backend/cors";
import { logInfo } from "@/lib/backend/logger";
import { withApiHandler } from "@/lib/backend/withApiHandler";
import { getSupportedConfig } from "@/lib/backend/config";

const SUPPORTED_CONFIG_CORS_POLICY = {
  GET: { access: 'public' },
} satisfies CorsRoutePolicy;

export const OPTIONS = createCorsOptionsHandler(SUPPORTED_CONFIG_CORS_POLICY);

/**
 * @swagger
 * /api/config/supported:
 *   get:
 *     summary: Get supported config parameters
 *     description: Returns supported assets, risk profiles, and bounds so UI can avoid hardcoding parameter ranges.
 *     tags:
 *       - Config
 *     responses:
 *       200:
 *         description: Supported config parameters
 */
export const GET = withApiHandler(async (req: NextRequest, _context, correlationId) => {
  logInfo(req, 'Supported config requested');

  const config = getSupportedConfig();

  const response = ok(
    config,
    undefined,
    200,
    correlationId,
  );

  attachSecurityHeaders(response);
  return response;
}, { cors: SUPPORTED_CONFIG_CORS_POLICY });

const _405 = methodNotAllowed(['GET']);
export { _405 as POST, _405 as PUT, _405 as PATCH, _405 as DELETE };
