import { NextResponse } from 'next/server';
import { attachSecurityHeaders } from '@/utils/response';
import { methodNotAllowed } from '@/lib/backend/apiResponse';

export async function POST() {
  const response = NextResponse.json({ 
    success: true, 
    message: 'Login successful (mock)' 
  });
  
  // Example with custom CSP: Allow 'unsafe-inline' for scripts (just as an example of override)
  return attachSecurityHeaders(response, "default-src 'self'; script-src 'self' 'unsafe-inline'");
}

const _405 = methodNotAllowed(['POST']);
export { _405 as GET, _405 as PUT, _405 as PATCH, _405 as DELETE };
