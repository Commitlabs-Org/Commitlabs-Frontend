import { NextRequest, NextResponse } from 'next/server';

import { HORIZON_URL, SOROBAN_RPC_URL } from '@/lib/config';
import { buildCsp } from '@/lib/security/csp';

/**
 * Generate a cryptographically random, base64-encoded nonce for this request.
 * Runs on the Edge runtime, where `crypto.getRandomValues` is available.
 */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/**
 * Set a strict, nonce-based Content-Security-Policy on every page response.
 *
 * The CSP goes out on the *response* headers so the browser enforces it, and
 * is also mirrored onto the *request* headers together with `x-nonce`, which
 * `src/app/layout.tsx` reads to stamp the nonce onto the rendered scripts
 * (Next.js additionally auto-detects the nonce from the request CSP header
 * for its own bootstrap/inline scripts — see `getScriptNonceFromHeader`).
 */
export function middleware(request: NextRequest): NextResponse {
  const nonce = generateNonce();
  const csp = buildCsp({
    nonce,
    horizonUrl: HORIZON_URL,
    rpcUrl: SOROBAN_RPC_URL,
    isDev: process.env.NODE_ENV === 'development',
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('Content-Security-Policy', csp);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  // Skip Next.js build assets and the static icon; CSP is a document-level
  // policy and those responses are never documents.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
