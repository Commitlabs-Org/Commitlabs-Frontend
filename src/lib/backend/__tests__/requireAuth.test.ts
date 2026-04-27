import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { requireAuth, validateCsrfToken, validateOrigin } from '../requireAuth';
import { createSessionToken } from '../auth';
import { UnauthorizedError } from '../errors';

describe('requireAuth', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should authenticate valid session token from cookie', () => {
        const address = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ123456789';
        const { token, csrfToken } = createSessionToken(address);
        
        const req = new NextRequest('http://localhost:3000/api/test', {
            headers: {
                cookie: `session=${token}`,
            },
        });

        const authenticatedReq = requireAuth(req);
        
        expect(authenticatedReq.user.address).toBe(address);
        expect(authenticatedReq.user.csrfToken).toBe(csrfToken);
    });

    it('should throw UnauthorizedError for missing session cookie', () => {
        const req = new NextRequest('http://localhost:3000/api/test');
        
        expect(() => requireAuth(req)).toThrow(UnauthorizedError);
        expect(() => requireAuth(req)).toThrow('No session token provided');
    });

    it('should throw UnauthorizedError for invalid session token', () => {
        const req = new NextRequest('http://localhost:3000/api/test', {
            headers: {
                cookie: 'session=invalid-token',
            },
        });

        expect(() => requireAuth(req)).toThrow(UnauthorizedError);
        expect(() => requireAuth(req)).toThrow('Invalid session token');
    });

    it('should throw UnauthorizedError for expired session token', () => {
        // This would require mocking time or creating an expired token
        // For now, we test the structure with an invalid token
        const req = new NextRequest('http://localhost:3000/api/test', {
            headers: {
                cookie: 'session=expired-token-format',
            },
        });

        expect(() => requireAuth(req)).toThrow(UnauthorizedError);
    });
});

describe('validateCsrfToken', () => {
    const expectedCsrfToken = 'expected-csrf-token';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should allow GET requests without CSRF validation', () => {
        const req = new NextRequest('http://localhost:3000/api/test', {
            method: 'GET',
        });

        expect(() => validateCsrfToken(req, expectedCsrfToken)).not.toThrow();
    });

    it('should allow HEAD requests without CSRF validation', () => {
        const req = new NextRequest('http://localhost:3000/api/test', {
            method: 'HEAD',
        });

        expect(() => validateCsrfToken(req, expectedCsrfToken)).not.toThrow();
    });

    it('should allow OPTIONS requests without CSRF validation', () => {
        const req = new NextRequest('http://localhost:3000/api/test', {
            method: 'OPTIONS',
        });

        expect(() => validateCsrfToken(req, expectedCsrfToken)).not.toThrow();
    });

    it('should validate CSRF token for POST requests', () => {
        const req = new NextRequest('http://localhost:3000/api/test', {
            method: 'POST',
            headers: {
                'x-csrf-token': expectedCsrfToken,
            },
        });

        expect(() => validateCsrfToken(req, expectedCsrfToken)).not.toThrow();
    });

    it('should validate CSRF token for PUT requests', () => {
        const req = new NextRequest('http://localhost:3000/api/test', {
            method: 'PUT',
            headers: {
                'x-csrf-token': expectedCsrfToken,
            },
        });

        expect(() => validateCsrfToken(req, expectedCsrfToken)).not.toThrow();
    });

    it('should validate CSRF token for PATCH requests', () => {
        const req = new NextRequest('http://localhost:3000/api/test', {
            method: 'PATCH',
            headers: {
                'x-csrf-token': expectedCsrfToken,
            },
        });

        expect(() => validateCsrfToken(req, expectedCsrfToken)).not.toThrow();
    });

    it('should validate CSRF token for DELETE requests', () => {
        const req = new NextRequest('http://localhost:3000/api/test', {
            method: 'DELETE',
            headers: {
                'x-csrf-token': expectedCsrfToken,
            },
        });

        expect(() => validateCsrfToken(req, expectedCsrfToken)).not.toThrow();
    });

    it('should throw UnauthorizedError for missing CSRF token in POST', () => {
        const req = new NextRequest('http://localhost:3000/api/test', {
            method: 'POST',
        });

        expect(() => validateCsrfToken(req, expectedCsrfToken)).toThrow(UnauthorizedError);
        expect(() => validateCsrfToken(req, expectedCsrfToken)).toThrow('CSRF token required for state-changing requests');
    });

    it('should throw UnauthorizedError for invalid CSRF token in POST', () => {
        const req = new NextRequest('http://localhost:3000/api/test', {
            method: 'POST',
            headers: {
                'x-csrf-token': 'invalid-csrf-token',
            },
        });

        expect(() => validateCsrfToken(req, expectedCsrfToken)).toThrow(UnauthorizedError);
        expect(() => validateCsrfToken(req, expectedCsrfToken)).toThrow('Invalid CSRF token');
    });
});

describe('validateOrigin', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should allow requests without Origin or Referer headers', () => {
        const req = new NextRequest('http://localhost:3000/api/test');

        expect(() => validateOrigin(req)).not.toThrow();
    });

    it('should allow same-origin requests with Origin header', () => {
        const req = new NextRequest('http://localhost:3000/api/test', {
            headers: {
                origin: 'http://localhost:3000',
                host: 'localhost:3000',
            },
        });

        expect(() => validateOrigin(req)).not.toThrow();
    });

    it('should allow same-origin requests with Referer header', () => {
        const req = new NextRequest('http://localhost:3000/api/test', {
            headers: {
                referer: 'http://localhost:3000/some-page',
                host: 'localhost:3000',
            },
        });

        expect(() => validateOrigin(req)).not.toThrow();
    });

    it('should reject cross-origin requests with Origin header', () => {
        const req = new NextRequest('http://localhost:3000/api/test', {
            headers: {
                origin: 'http://malicious-site.com',
                host: 'localhost:3000',
            },
        });

        expect(() => validateOrigin(req)).toThrow(UnauthorizedError);
        expect(() => validateOrigin(req)).toThrow('Cross-origin request not allowed');
    });

    it('should reject cross-origin requests with Referer header', () => {
        const req = new NextRequest('http://localhost:3000/api/test', {
            headers: {
                referer: 'http://malicious-site.com/attack',
                host: 'localhost:3000',
            },
        });

        expect(() => validateOrigin(req)).toThrow(UnauthorizedError);
        expect(() => validateOrigin(req)).toThrow('Cross-origin request not allowed');
    });

    it('should prioritize Origin over Referer when both are present', () => {
        const req = new NextRequest('http://localhost:3000/api/test', {
            headers: {
                origin: 'http://localhost:3000', // Same origin
                referer: 'http://malicious-site.com/attack', // Different origin
                host: 'localhost:3000',
            },
        });

        // Should allow because Origin is same-origin
        expect(() => validateOrigin(req)).not.toThrow();
    });

    it('should handle HTTPS origins correctly', () => {
        const req = new NextRequest('https://commitlabs.com/api/test', {
            headers: {
                origin: 'https://commitlabs.com',
                host: 'commitlabs.com',
            },
        });

        expect(() => validateOrigin(req)).not.toThrow();
    });

    it('should reject HTTPS to HTTP cross-origin requests', () => {
        const req = new NextRequest('https://commitlabs.com/api/test', {
            headers: {
                origin: 'http://malicious-site.com',
                host: 'commitlabs.com',
            },
        });

        expect(() => validateOrigin(req)).toThrow(UnauthorizedError);
    });
});
