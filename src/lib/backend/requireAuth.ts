import { NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/backend/auth";
import { ForbiddenError, UnauthorizedError } from "@/lib/backend/errors";

const ADMIN_ADDRESSES = new Set(
  process.env.ADMIN_ADDRESSES?.split(",").map((value) => value.trim()).filter(Boolean) ?? [],
);

export interface AuthenticatedRequest extends NextRequest {
  user: {
    address: string;
    csrfToken?: string;
  };
}

export interface VerifiedAuth {
  address: string;
  isAdmin: boolean;
}

export function verifyAuth(req: NextRequest): VerifiedAuth {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Bearer token required");
  }

  const token = authHeader.slice(7);
  const session = verifySessionToken(token);

  if (!session.valid || !session.address) {
    throw new UnauthorizedError("Invalid or expired session");
  }

  return {
    address: session.address,
    isAdmin: ADMIN_ADDRESSES.has(session.address),
  };
}

export function requireAdmin(req: NextRequest): VerifiedAuth {
  const auth = verifyAuth(req);

  if (!auth.isAdmin) {
    throw new ForbiddenError("Admin access required");
  }

  return auth;
}

export function requireAuth(req: NextRequest): AuthenticatedRequest {
  const sessionToken = req.cookies.get("session")?.value;
  if (!sessionToken) {
    throw new UnauthorizedError("No session token provided");
  }

  const verification = verifySessionToken(sessionToken);
  if (!verification.valid || !verification.address) {
    throw new UnauthorizedError(verification.error || "Invalid session token");
  }

  const authenticatedReq = req as AuthenticatedRequest;
  authenticatedReq.user = {
    address: verification.address,
    csrfToken: verification.csrfToken,
  };
  return authenticatedReq;
}
