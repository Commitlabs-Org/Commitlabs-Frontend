import { NextRequest, NextResponse } from "next/server";
import { logInfo } from "@/lib/backend/logger";
import { attachSecurityHeaders } from "@/utils/response";

export async function GET(req: NextRequest) {
  logInfo(req, "Healthcheck requested");
  const response = NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
  return attachSecurityHeaders(response);
}
