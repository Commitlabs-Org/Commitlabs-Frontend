import { NextRequest } from "next/server";
import { ok, methodNotAllowed, attachSecurityHeaders } from "@/lib/backend/apiResponse";
import { logInfo } from "@/lib/backend/logger";
import { withApiHandler } from "@/lib/backend/withApiHandler";

export const GET = withApiHandler(async (req: NextRequest) => {
  logInfo(req, "Healthcheck requested");
  const response = ok({
    status: "healthy",
    uptime: process.uptime(),
    version: "0.1.0",
  });
  return attachSecurityHeaders(response);
});

const _405 = methodNotAllowed(["GET"]);
export { _405 as POST, _405 as PUT, _405 as PATCH, _405 as DELETE };
