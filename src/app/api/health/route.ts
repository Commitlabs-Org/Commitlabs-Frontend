import { NextRequest, NextResponse } from 'next/server'

export async function GET(_request: NextRequest) {
  return NextResponse.json(
    {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
    },
    { status: 200 }
  )
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
