import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/backend/withApiHandler";
import { ok, methodNotAllowed } from "@/lib/backend/apiResponse";
import { logInfo } from "@/lib/backend/logger";
import { ok } from "@/lib/backend/apiResponse";

export const GET = withApiHandler(async (req: NextRequest) => {
  logInfo(req, "Healthcheck requested");
  const response = NextResponse.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "0.1.0",
  });
  return attachSecurityHeaders(response);
});

const _405 = methodNotAllowed(["GET"]);
export { _405 as POST, _405 as PUT, _405 as PATCH, _405 as DELETE };
