import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/backend/rateLimit', () => ({
    checkRateLimit: vi.fn(),
}));

vi.mock('@/lib/backend/auth', () => ({
    AUTH_COOKIE_NAME: 'session',
    verifySessionToken: vi.fn(),
    revokeOtherSessions: vi.fn(),
}));

import { checkRateLimit } from '@/lib/backend/rateLimit';
import { verifySessionToken, revokeOtherSessions } from '@/lib/backend/auth';

const VALID_TOKEN = 'valid-session-token';

const makeRequest = (opts: { token?: string; ip?: string } = {}) => {
    const { token = VALID_TOKEN, ip = '127.0.0.1' } = opts;
    const req = new NextRequest('http://localhost:3000/api/auth/sessions/revoke-others', {
        method: 'POST',
        headers: {
            ...(ip ? { 'x-forwarded-for': ip } : {}),
            Cookie: token ? `session=${token}` : '',
        },
    });
    return req;
};

describe('POST /api/auth/sessions/revoke-others', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(checkRateLimit).mockResolvedValue(true);
        vi.mocked(verifySessionToken).mockReturnValue({ valid: true, address: 'GABC' });
        vi.mocked(revokeOtherSessions).mockReturnValue(2);
    });

    it('revokes other sessions and returns count on success', async () => {
        const res = await POST(makeRequest(), { params: {} });
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
        expect(body.data.revokedCount).toBe(2);
        expect(body.data.message).toBe('Revoked 2 other sessions.');
        expect(revokeOtherSessions).toHaveBeenCalledWith(VALID_TOKEN);
    });

    it('returns 429 when rate limited', async () => {
        vi.mocked(checkRateLimit).mockResolvedValue(false);

        const res = await POST(makeRequest(), { params: {} });
        const body = await res.json();

        expect(res.status).toBe(429);
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('TOO_MANY_REQUESTS');
        expect(checkRateLimit).toHaveBeenCalledWith('anonymous', 'api/auth/sessions/revoke-others');
        expect(revokeOtherSessions).not.toHaveBeenCalled();
    });

    it('returns 401 when no session cookie is present', async () => {
        const req = new NextRequest('http://localhost:3000/api/auth/sessions/revoke-others', {
            method: 'POST',
            headers: { 'x-forwarded-for': '127.0.0.1' },
        });

        const res = await POST(req, { params: {} });
        const body = await res.json();

        expect(res.status).toBe(401);
        expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 when session token is invalid', async () => {
        vi.mocked(verifySessionToken).mockReturnValue({ valid: false, error: 'Token expired' });

        const res = await POST(makeRequest(), { params: {} });
        const body = await res.json();

        expect(res.status).toBe(401);
        expect(body.error.code).toBe('UNAUTHORIZED');
        expect(body.error.message).toBe('Token expired');
    });

    it('uses singular "session" when exactly one session is revoked', async () => {
        vi.mocked(revokeOtherSessions).mockReturnValue(1);

        const res = await POST(makeRequest(), { params: {} });
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data.revokedCount).toBe(1);
        expect(body.data.message).toBe('Revoked 1 other session.');
    });

    it('falls back to anonymous IP when no forwarding headers present', async () => {
        const req = new NextRequest('http://localhost:3000/api/auth/sessions/revoke-others', {
            method: 'POST',
            headers: { Cookie: `session=${VALID_TOKEN}` },
        });

        const res = await POST(req, { params: {} });
        expect(res.status).toBe(200);
        expect(checkRateLimit).toHaveBeenCalledWith('anonymous', 'api/auth/sessions/revoke-others');
    });

    it('returns 500 on unexpected handler error', async () => {
        vi.mocked(revokeOtherSessions).mockImplementation(() => { throw new Error('db error'); });

        const res = await POST(makeRequest(), { params: {} });
        const body = await res.json();

        expect(res.status).toBe(500);
        expect(body.error.code).toBe('INTERNAL_ERROR');
    });
});
