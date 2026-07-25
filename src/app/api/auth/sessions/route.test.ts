import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/backend/rateLimit', () => ({
    checkRateLimit: vi.fn(),
}));

vi.mock('@/lib/backend/auth', () => ({
    AUTH_COOKIE_NAME: 'session',
    verifySessionToken: vi.fn(),
    listOtherSessions: vi.fn(),
}));

import { checkRateLimit } from '@/lib/backend/rateLimit';
import { verifySessionToken, listOtherSessions } from '@/lib/backend/auth';

const VALID_TOKEN = 'valid-session-token';

const makeRequest = (opts: { token?: string; ip?: string; ua?: string } = {}) => {
    const { token = VALID_TOKEN, ip = '127.0.0.1', ua = 'TestUserAgent' } = opts;
    const req = new NextRequest('http://localhost:3000/api/auth/sessions', {
        method: 'GET',
        headers: {
            ...(ip ? { 'x-forwarded-for': ip } : {}),
            ...(ua ? { 'user-agent': ua } : {}),
            Cookie: token ? `session=${token}` : '',
        },
    });
    return req;
};

describe('GET /api/auth/sessions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(checkRateLimit).mockResolvedValue(true);
        vi.mocked(verifySessionToken).mockReturnValue({
            valid: true,
            address: 'GABC',
            createdAt: new Date('2023-01-01T00:00:00Z'),
        });
        vi.mocked(listOtherSessions).mockReturnValue([
            {
                id: 'other-session-1',
                address: 'GABC',
                createdAt: new Date('2023-01-02T00:00:00Z').toISOString(),
                expiresAt: new Date('2023-02-02T00:00:00Z').toISOString(),
            }
        ]);
    });

    it('returns the current session with correct createdAt from store and other sessions', async () => {
        const res = await GET(makeRequest(), { params: {} });
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);

        const sessions = body.data.sessions;
        expect(sessions).toHaveLength(2);

        // Current session
        expect(sessions[0]).toEqual({
            id: VALID_TOKEN,
            userAgent: 'TestUserAgent',
            ipAddress: '127.0.0.1',
            createdAt: '2023-01-01T00:00:00.000Z',
            isCurrent: true,
        });

        // Other session
        expect(sessions[1]).toEqual({
            id: 'other-session-1',
            userAgent: 'Unknown',
            ipAddress: 'Unknown',
            createdAt: '2023-01-02T00:00:00.000Z',
            isCurrent: false,
        });
    });

    it('returns 401 when no session cookie is present', async () => {
        const req = new NextRequest('http://localhost:3000/api/auth/sessions', {
            method: 'GET',
            headers: { 'x-forwarded-for': '127.0.0.1' },
        });

        const res = await GET(req, { params: {} });
        const body = await res.json();

        expect(res.status).toBe(401);
        expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 when session token is invalid', async () => {
        vi.mocked(verifySessionToken).mockReturnValue({ valid: false, error: 'Token expired' });

        const res = await GET(makeRequest(), { params: {} });
        const body = await res.json();

        expect(res.status).toBe(401);
        expect(body.error.code).toBe('UNAUTHORIZED');
        expect(body.error.message).toBe('Token expired');
    });
});
