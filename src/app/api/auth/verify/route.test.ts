import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn(),
}));

vi.mock('@/lib/backend/auth', () => ({
  verifySignatureWithNonce: vi.fn(),
  createSessionToken: vi.fn(),
}));

import { checkRateLimit } from '@/lib/backend/rateLimit';
import { verifySignatureWithNonce, createSessionToken } from '@/lib/backend/auth';

const VALID_BODY = {
  address: 'GABC',
  signature: 'sig123',
  message: 'Sign in to CommitLabs: abc123nonce',
};

const makeRequest = (body: unknown) =>
  new NextRequest('http://localhost:3000/api/auth/verify', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'x-forwarded-for': '127.0.0.1' },
  });

describe('POST /api/auth/verify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkRateLimit).mockResolvedValue(true);
    vi.mocked(verifySignatureWithNonce).mockReturnValue({ valid: true, address: 'GABC' });
    vi.mocked(createSessionToken).mockReturnValue('session_GABC_1234567890');
  });

  it('returns verified true and sessionToken on success', async () => {
    const res = await POST(makeRequest(VALID_BODY), { params: {} });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.verified).toBe(true);
    expect(body.data.address).toBe('GABC');
    expect(body.data.sessionToken).toBe('session_GABC_1234567890');
    expect(verifySignatureWithNonce).toHaveBeenCalledWith(VALID_BODY);
  });

  it('returns 429 when rate limited', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(false);

    const res = await POST(makeRequest(VALID_BODY), { params: {} });
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/verify', {
      method: 'POST',
      body: 'not-json',
      headers: { 'x-forwarded-for': '127.0.0.1' },
    });

    const res = await POST(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when address is missing', async () => {
    const res = await POST(makeRequest({ signature: 'sig', message: 'msg' }), { params: {} });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when signature is missing', async () => {
    const res = await POST(makeRequest({ address: 'GABC', message: 'msg' }), { params: {} });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when message is missing', async () => {
    const res = await POST(makeRequest({ address: 'GABC', signature: 'sig' }), { params: {} });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 on invalid signature', async () => {
    vi.mocked(verifySignatureWithNonce).mockReturnValue({ valid: false, error: 'Invalid signature' });

    const res = await POST(makeRequest(VALID_BODY), { params: {} });
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(body.error.message).toBe('Invalid signature');
  });

  it('returns 401 on nonce mismatch', async () => {
    vi.mocked(verifySignatureWithNonce).mockReturnValue({ valid: false, error: 'Nonce address mismatch' });

    const res = await POST(makeRequest(VALID_BODY), { params: {} });
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(body.error.message).toBe('Nonce address mismatch');
  });

  it('returns 401 when nonce is expired or already consumed', async () => {
    vi.mocked(verifySignatureWithNonce).mockReturnValue({ valid: false, error: 'Invalid or expired nonce' });

    const res = await POST(makeRequest(VALID_BODY), { params: {} });
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(body.error.message).toBe('Invalid or expired nonce');
  });

  it('returns 401 with default message when verificationResult has no error string', async () => {
    vi.mocked(verifySignatureWithNonce).mockReturnValue({ valid: false });

    const res = await POST(makeRequest(VALID_BODY), { params: {} });
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('falls back to anonymous when no ip headers present', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify(VALID_BODY),
    });

    const res = await POST(req, { params: {} });
    expect(res.status).toBe(200);
    expect(checkRateLimit).toHaveBeenCalledWith('anonymous', 'api/auth/verify');
  });

  it('returns 500 on unexpected handler error', async () => {
    vi.mocked(verifySignatureWithNonce).mockImplementation(() => { throw new Error('boom'); });

    const res = await POST(makeRequest(VALID_BODY), { params: {} });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });
});
