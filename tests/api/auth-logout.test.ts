import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '@/app/api/auth/logout/route';
import { createMockRequest, parseResponse } from './helpers';
import { AUTH_COOKIE_NAME, COOKIE_OPTIONS } from '@/lib/backend/auth';
import { _clearStores, createSessionToken } from '@/lib/backend/auth';

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    _clearStores();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should clear the session cookie and return success when a valid session exists', async () => {
    // Arrange: create a session
    const token = createSessionToken('GB3D...WALLET');
    const req = createMockRequest('http://localhost/api/auth/logout', {
      method: 'POST',
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${token}`,
      },
    });

    // Act
    const response = await POST(req, { params: {} });
    const result = await parseResponse(response);

    // Assert: response envelope
    expect(result.status).toBe(200);
    expect(result.data).toEqual({
      success: true,
      data: { message: 'Logged out successfully' },
    });

    // Assert: cookie is cleared (empty value + expired)
    const setCookie = response.headers.get('set-cookie');
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain(`${AUTH_COOKIE_NAME}=`);
    expect(setCookie).toContain('Expires=');
    expect(setCookie).toContain('Max-Age=0');

    // Assert: cookie attributes match COOKIE_OPTIONS
    if (COOKIE_OPTIONS.httpOnly) {
      expect(setCookie).toContain('HttpOnly');
    }
    if (COOKIE_OPTIONS.secure) {
      expect(setCookie).toContain('Secure');
    }
    if (COOKIE_OPTIONS.sameSite) {
      expect(setCookie).toContain(`SameSite=${COOKIE_OPTIONS.sameSite}`);
    }
    if (COOKIE_OPTIONS.path) {
      expect(setCookie).toContain(`Path=${COOKIE_OPTIONS.path}`);
    }
  });

  it('should return success even when no session cookie is present (idempotent)', async () => {
    // Arrange: no cookie
    const req = createMockRequest('http://localhost/api/auth/logout', {
      method: 'POST',
    });

    // Act
    const response = await POST(req, { params: {} });
    const result = await parseResponse(response);

    // Assert
    expect(result.status).toBe(200);
    expect(result.data).toEqual({
      success: true,
      data: { message: 'Logged out successfully' },
    });

    // Cookie should still be cleared defensively
    const setCookie = response.headers.get('set-cookie');
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain(`${AUTH_COOKIE_NAME}=`);
    expect(setCookie).toContain('Max-Age=0');
  });

  it('should return success when session cookie is present but invalid/expired', async () => {
    // Arrange: cookie with non-existent token
    const req = createMockRequest('http://localhost/api/auth/logout', {
      method: 'POST',
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=invalid_token_12345`,
      },
    });

    // Act
    const response = await POST(req, { params: {} });
    const result = await parseResponse(response);

    // Assert: still returns 200 (idempotent)
    expect(result.status).toBe(200);
    expect(result.data.success).toBe(true);
  });

  it('should revoke the session in the backend store when token exists', async () => {
    // Arrange: create a session and verify it exists
    const token = createSessionToken('GB3D...WALLET');
    const { verifySessionToken } = await import('@/lib/backend/auth');
    expect(verifySessionToken(token).valid).toBe(true);

    const req = createMockRequest('http://localhost/api/auth/logout', {
      method: 'POST',
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${token}`,
      },
    });

    // Act
    await POST(req, { params: {} });

    // Assert: session is revoked
    const after = verifySessionToken(token);
    expect(after.valid).toBe(false);
    expect(after.error).toBe('Session not found');
  });

  it('should include correlation-id headers in the response', async () => {
    const req = createMockRequest('http://localhost/api/auth/logout', {
      method: 'POST',
    });

    const response = await POST(req, { params: {} });

    expect(response.headers.get('x-correlation-id')).toBeDefined();
    expect(response.headers.get('x-request-id')).toBeDefined();
  });
});