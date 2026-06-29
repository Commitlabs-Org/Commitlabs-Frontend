import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GET } from '@/app/api/auth/csrf/route';
import { createMockRequest, parseResponse } from './helpers';
import {
  SESSION_COOKIE_NAME,
  createBrowserSession,
  __resetSessionStoreForTests,
} from '@/lib/backend/session';

describe('GET /api/auth/csrf', () => {
  beforeEach(() => {
    __resetSessionStoreForTests();
  });

  afterEach(() => {
    __resetSessionStoreForTests();
  });

  it('should return the CSRF token for a valid active session', async () => {
    // Arrange: create a browser session
    const { sessionId, csrfToken } = createBrowserSession('GB3D...WALLET');

    const req = createMockRequest('http://localhost/api/auth/csrf', {
      method: 'GET',
      headers: {
        Cookie: `${SESSION_COOKIE_NAME}=${sessionId}`,
      },
    });

    // Act
    const response = await GET(req, { params: {} });
    const result = await parseResponse(response);

    // Assert
    expect(result.status).toBe(200);
    expect(result.data.success).toBe(true);
    expect(result.data.data).toEqual({ csrfToken });
  });

  it('should reject with 401 when no session cookie is present', async () => {
    // Arrange: no cookie
    const req = createMockRequest('http://localhost/api/auth/csrf', {
      method: 'GET',
    });

    // Act
    const response = await GET(req, { params: {} });
    const result = await parseResponse(response);

    // Assert
    expect(result.status).toBe(401);
    expect(result.data.success).toBe(false);
    expect(result.data.error.code).toBe('UNAUTHORIZED');
    expect(result.data.error.message).toBe('No active session.');
  });

  it('should reject with 401 when session cookie is present but session does not exist', async () => {
    // Arrange: cookie with non-existent session
    const req = createMockRequest('http://localhost/api/auth/csrf', {
      method: 'GET',
      headers: {
        Cookie: `${SESSION_COOKIE_NAME}=nonexistent_session_id`,
      },
    });

    // Act
    const response = await GET(req, { params: {} });
    const result = await parseResponse(response);

    // Assert
    expect(result.status).toBe(401);
    expect(result.data.success).toBe(false);
    expect(result.data.error.code).toBe('UNAUTHORIZED');
    expect(result.data.error.message).toBe('Session is invalid or expired.');
  });

  it('should reject with 401 when session cookie value is empty', async () => {
    const req = createMockRequest('http://localhost/api/auth/csrf', {
      method: 'GET',
      headers: {
        Cookie: `${SESSION_COOKIE_NAME}=`,
      },
    });

    const response = await GET(req, { params: {} });
    const result = await parseResponse(response);

    expect(result.status).toBe(401);
    expect(result.data.error.code).toBe('UNAUTHORIZED');
  });

  it('should include correlation-id headers in the response', async () => {
    const { sessionId } = createBrowserSession('GB3D...WALLET');
    const req = createMockRequest('http://localhost/api/auth/csrf', {
      method: 'GET',
      headers: {
        Cookie: `${SESSION_COOKIE_NAME}=${sessionId}`,
      },
    });

    const response = await GET(req, { params: {} });

    expect(response.headers.get('x-correlation-id')).toBeDefined();
    expect(response.headers.get('x-request-id')).toBeDefined();
  });

  it('should return consistent csrfToken for the same session across repeated calls', async () => {
    const { sessionId, csrfToken } = createBrowserSession('GB3D...WALLET');

    const req = createMockRequest('http://localhost/api/auth/csrf', {
      method: 'GET',
      headers: {
        Cookie: `${SESSION_COOKIE_NAME}=${sessionId}`,
      },
    });

    const response1 = await GET(req, { params: {} });
    const result1 = await parseResponse(response1);

    const response2 = await GET(req, { params: {} });
    const result2 = await parseResponse(response2);

    expect(result1.data.data.csrfToken).toBe(csrfToken);
    expect(result2.data.data.csrfToken).toBe(csrfToken);
    expect(result1.data.data.csrfToken).toBe(result2.data.data.csrfToken);
  });
});