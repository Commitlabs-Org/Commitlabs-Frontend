import { NextRequest, NextResponse } from 'next/server';
import {
  applyCorsPolicy,
  createCorsOptionsHandler,
  enforceCorsRequestPolicy,
  toCorsErrorResponse,
  type CorsRoutePolicy,
} from '@/lib/backend/cors';
import { attachSecurityHeaders } from '@/utils/response';
import { methodNotAllowed } from '@/lib/backend/apiResponse';

const LOGIN_CORS_POLICY = {
  POST: { access: 'first-party' },
} satisfies CorsRoutePolicy;

export const OPTIONS = createCorsOptionsHandler(LOGIN_CORS_POLICY);

export async function POST(request: NextRequest) {
  try {
    enforceCorsRequestPolicy(request, LOGIN_CORS_POLICY);
  } catch (error) {
    return toCorsErrorResponse(error);
  }

  const response = NextResponse.json({ 
    success: true, 
    message: 'Login successful (mock)' 
  });
  
  // Example with custom CSP: Allow 'unsafe-inline' for scripts (just as an example of override)
  attachSecurityHeaders(response, "default-src 'self'; script-src 'self' 'unsafe-inline'");
  return applyCorsPolicy(request, response, LOGIN_CORS_POLICY);
}

const _405 = methodNotAllowed(['POST']);
export { _405 as GET, _405 as PUT, _405 as PATCH, _405 as DELETE };
