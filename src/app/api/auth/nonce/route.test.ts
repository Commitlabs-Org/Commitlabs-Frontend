import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn(),
}));

vi.mock('@/lib/backend/auth', () => ({
  generateNonce: vi.fn(),
  storeNonce: vi.fn(),
  generateChallengeMessage: vi.fn(),
}));

import { checkRateLimit } from '@/lib/backend/rateLimit';
import { generateNonce, storeNonce, generateChallengeMessage } from '@/lib/backend/auth';

const makeRequest = (body: unknown) =>
  new NextRequest('http://localhost:3000/api/auth/nonce', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'x-forwarded-for': '127.0.0.1' },
  });

describe('POST /api/auth/nonce', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkRateLimit).mockResolvedValue(true);
    vi.mocked(generateNonce).mockReturnValue('abc123nonce');
    vi.mocked(storeNonce).mockReturnValue({
      nonce: 'abc123nonce',
      address: 'GABC',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      expiresAt: new Date('2026-01-01T00:05:00Z'),
    });
    vi.mocked(generateChallengeMessage).mockReturnValue('Sign in to CommitLabs: abc123nonce');
  });

  it('returns nonce, message, and expiresAt on success', async () => {
    const res = await POST(makeRequest({ address: 'GABC' }), { params: {} });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.nonce).toBe('abc123nonce');
    expect(body.data.message).toBe('Sign in to CommitLabs: abc123nonce');
    expect(body.data.expiresAt).toBe('2026-01-01T00:05:00.000Z');
    expect(storeNonce).toHaveBeenCalledWith('GABC', 'abc123nonce');
  });

  it('returns 429 when rate limited', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(false);

    const res = await POST(makeRequest({ address: 'GABC' }), { params: {} });
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/nonce', {
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
    const res = await POST(makeRequest({}), { params: {} });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when address is empty string', async () => {
    const res = await POST(makeRequest({ address: '' }), { params: {} });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when body is null', async () => {
    const res = await POST(makeRequest(null), { params: {} });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('falls back to anonymous when no ip headers present', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/nonce', {
      method: 'POST',
      body: JSON.stringify({ address: 'GABC' }),
    });

    const res = await POST(req, { params: {} });
    expect(res.status).toBe(200);
    expect(checkRateLimit).toHaveBeenCalledWith('anonymous', 'api/auth/nonce');
  });

  it('returns 500 on unexpected handler error', async () => {
    vi.mocked(generateNonce).mockImplementation(() => { throw new Error('boom'); });

    const res = await POST(makeRequest({ address: 'GABC' }), { params: {} });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });
});
