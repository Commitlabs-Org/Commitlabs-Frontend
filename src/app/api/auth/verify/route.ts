import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok } from '@/lib/backend/apiResponse';
import { ApiError, TooManyRequestsError, ValidationError, UnauthorizedError } from '@/lib/backend/errors';
import { parseJsonWithLimit, JSON_BODY_LIMITS } from '@/lib/backend/jsonBodyLimit';
import { verifySignatureWithNonce, createSessionToken } from '@/lib/backend/auth';
import { getClientIp } from '@/lib/backend/getClientIp';

const VerifyRequestSchema = z.object({
  address: z.string().min(1, "Address is required"),
  signature: z.string().min(1, "Signature is required"),
  message: z.string().min(1, "Message is required"),
});

export const POST = withApiHandler(async (req: NextRequest) => {
    const ip = getClientIp(req);

  // Rate limiting
  const isAllowed = await checkRateLimit(ip, "api/auth/verify");
  if (!isAllowed) {
    throw new TooManyRequestsError(
      "Rate limit exceeded. Please try again later.",
    );
  }

  // Parse and validate request body (with payload size enforcement)
  let body: unknown;
  try {
    body = await parseJsonWithLimit(req, {
      limitBytes: JSON_BODY_LIMITS.authVerify,
    });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ValidationError("Invalid JSON in request body");
  }

  const validation = VerifyRequestSchema.safeParse(body);
  if (!validation.success) {
    throw new ValidationError("Invalid request data", validation.error.errors);
  }

  const { address, signature, message } = validation.data;

  // Verify the signature and nonce (async)
  const verificationResult = await verifySignatureWithNonce({
    address,
    signature,
    message,
  });

  if (!verificationResult.valid) {
    throw new UnauthorizedError(
      verificationResult.error || "Signature verification failed",
    );
  }

  // Create a proper session token
  const sessionToken = createSessionToken(address);

  // Prepare success response
  const response = ok({
    verified: true,
    address: verificationResult.address,
    message: "Signature verified successfully",
    sessionToken,
  });

  // Set session cookie
  response.cookies.set(AUTH_COOKIE_NAME, sessionToken, COOKIE_OPTIONS);

  return response;
});

const _405 = methodNotAllowed(["POST"]);
export { _405 as GET, _405 as PUT, _405 as PATCH, _405 as DELETE };
