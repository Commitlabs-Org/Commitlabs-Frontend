import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { middleware } from '@/middleware';

function run(pathname = '/'): { csp: string; nonce: string } {
  const request = new NextRequest(`http://localhost:3000${pathname}`);
  const response = middleware(request);
  const csp = response.headers.get('Content-Security-Policy');
  if (!csp) throw new Error('response is missing the Content-Security-Policy header');
  const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
  if (!nonce) throw new Error('CSP header contains no nonce');
  return { csp, nonce };
}

describe('middleware', () => {
  it('sets a CSP header containing a nonce on the response', () => {
    const { csp, nonce } = run();
    expect(csp).toContain(`'nonce-${nonce}'`);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('generates a different nonce for each request', () => {
    const first = run();
    const second = run();
    expect(first.nonce).not.toBe(second.nonce);
  });

  it('generates base64 nonces from 16 random bytes', () => {
    const { nonce } = run();
    expect(nonce).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    expect(nonce.length).toBe(24);
  });

  it('forwards the CSP on the request headers so Next.js can pick up the nonce', () => {
    const response = middleware(new NextRequest('http://localhost:3000/'));
    const csp = response.headers.get('Content-Security-Policy');
    // NextResponse.next({ request: { headers } }) surfaces overridden request
    // headers as x-middleware-request-*; Next.js then parses the nonce from
    // this incoming CSP header (getScriptNonceFromHeader) for its own scripts.
    expect(
      response.headers.get('x-middleware-request-content-security-policy'),
    ).toBe(csp);
    expect(response.headers.get('x-middleware-override-headers')).toContain(
      'content-security-policy',
    );
  });

  it('exposes the nonce to the layout via the x-nonce request header', () => {
    const response = middleware(new NextRequest('http://localhost:3000/'));
    const forwardedNonce = response.headers.get(
      'x-middleware-request-x-nonce',
    );
    expect(forwardedNonce).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    expect(response.headers.get('x-middleware-override-headers')).toContain(
      'x-nonce',
    );
  });

  it('allows the configured Horizon and RPC origins in connect-src', () => {
    const { csp } = run();
    expect(csp).toContain('https://horizon-testnet.stellar.org');
    expect(csp).toContain('https://soroban-testnet.stellar.org');
  });
});
