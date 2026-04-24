import { NextRequest, NextResponse } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    applyCorsPolicy,
    toCorsErrorResponse,
    createCorsOptionsHandler,
    enforceCorsRequestPolicy,
    type CorsRoutePolicy,
} from './cors';
import { ForbiddenError } from './errors';

const ORIGINAL_ENV = {
    firstParty: process.env.COMMITLABS_FIRST_PARTY_ORIGINS,
    publicApi: process.env.COMMITLABS_PUBLIC_API_ORIGINS,
};

afterEach(() => {
    process.env.COMMITLABS_FIRST_PARTY_ORIGINS = ORIGINAL_ENV.firstParty;
    process.env.COMMITLABS_PUBLIC_API_ORIGINS = ORIGINAL_ENV.publicApi;
    vi.restoreAllMocks();
});

describe('cors helper', () => {
    it('applies wildcard CORS headers to public responses', () => {
        const policy = {
            GET: { access: 'public' },
        } satisfies CorsRoutePolicy;

        const request = new NextRequest('http://localhost:3000/api/health', {
            method: 'GET',
            headers: { Origin: 'https://external.example' },
        });

        const response = applyCorsPolicy(
            request,
            NextResponse.json({ status: 'healthy' }),
            policy
        );

        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
        expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS');
        expect(response.headers.get('Access-Control-Allow-Credentials')).toBeNull();
        expect(response.headers.get('Vary')).toContain('Origin');
    });

    it('echoes allowed first-party origins and enables credentials', () => {
        process.env.COMMITLABS_FIRST_PARTY_ORIGINS = 'https://app.commitlabs.test';

        const policy = {
            POST: { access: 'first-party' },
        } satisfies CorsRoutePolicy;

        const request = new NextRequest('http://localhost:3000/api/auth', {
            method: 'POST',
            headers: { Origin: 'https://app.commitlabs.test' },
        });

        const response = applyCorsPolicy(
            request,
            NextResponse.json({ success: true }),
            policy
        );

        expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
            'https://app.commitlabs.test'
        );
        expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    });

    it('rejects disallowed first-party origins', () => {
        process.env.COMMITLABS_FIRST_PARTY_ORIGINS = 'https://app.commitlabs.test';

        const policy = {
            POST: { access: 'first-party' },
        } satisfies CorsRoutePolicy;

        const request = new NextRequest('http://localhost:3000/api/auth', {
            method: 'POST',
            headers: { Origin: 'https://evil.example' },
        });

        expect(() => enforceCorsRequestPolicy(request, policy)).toThrowError(
            /Origin is not allowed/
        );
    });

    it('builds method-aware preflight responses for mixed public and first-party routes', async () => {
        process.env.COMMITLABS_FIRST_PARTY_ORIGINS = 'https://app.commitlabs.test';

        const policy = {
            GET: { access: 'public' },
            POST: {
                access: 'first-party',
                allowHeaders: ['Authorization', 'Content-Type'],
            },
        } satisfies CorsRoutePolicy;

        const handler = createCorsOptionsHandler(policy);
        const request = new NextRequest('http://localhost:3000/api/marketplace/listings', {
            method: 'OPTIONS',
            headers: {
                Origin: 'https://app.commitlabs.test',
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'Authorization, Content-Type',
            },
        });

        const response = await handler(request);

        expect(response.status).toBe(204);
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
            'https://app.commitlabs.test'
        );
        expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
        expect(response.headers.get('Access-Control-Allow-Headers')).toBe(
            'Authorization, Content-Type'
        );
        expect(response.headers.get('Access-Control-Allow-Methods')).toBe(
            'GET, POST, OPTIONS'
        );
    });

    it('rejects preflight requests with headers outside the allowlist', async () => {
        process.env.COMMITLABS_FIRST_PARTY_ORIGINS = 'https://app.commitlabs.test';

        const policy = {
            POST: {
                access: 'first-party',
                allowHeaders: ['Content-Type'],
            },
        } satisfies CorsRoutePolicy;

        const handler = createCorsOptionsHandler(policy);
        const request = new NextRequest('http://localhost:3000/api/auth', {
            method: 'OPTIONS',
            headers: {
                Origin: 'https://app.commitlabs.test',
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'X-Custom-Header',
            },
        });

        const response = await handler(request);
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body.error.code).toBe('FORBIDDEN');
    });

    it('returns the original response when no policy exists for the method', () => {
        const request = new NextRequest('http://localhost:3000/api/health', {
            method: 'PATCH',
        });
        const response = NextResponse.json({ ok: true });

        const resolved = applyCorsPolicy(request, response, {
            GET: { access: 'public' },
        });

        expect(resolved).toBe(response);
        expect(resolved.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });

    it('supports public origin allowlists without credentials', () => {
        process.env.COMMITLABS_PUBLIC_API_ORIGINS =
            'https://docs.commitlabs.test,https://status.commitlabs.test';

        const policy = {
            GET: {
                access: 'public',
                exposeHeaders: ['X-Trace-Id'],
            },
        } satisfies CorsRoutePolicy;

        const request = new NextRequest('http://localhost:3000/api/metrics', {
            method: 'GET',
            headers: { Origin: 'https://docs.commitlabs.test' },
        });

        const response = applyCorsPolicy(
            request,
            NextResponse.json({ status: 'up' }),
            policy
        );

        expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
            'https://docs.commitlabs.test'
        );
        expect(response.headers.get('Access-Control-Allow-Credentials')).toBeNull();
        expect(response.headers.get('Access-Control-Expose-Headers')).toBe('X-Trace-Id');
    });

    it('rejects wildcard public origins when credentials are enabled', () => {
        process.env.COMMITLABS_PUBLIC_API_ORIGINS = '*';

        const policy = {
            GET: {
                access: 'public',
                allowCredentials: true,
            },
        } satisfies CorsRoutePolicy;

        const request = new NextRequest('http://localhost:3000/api/metrics', {
            method: 'GET',
            headers: { Origin: 'https://external.example' },
        });

        expect(() =>
            applyCorsPolicy(request, NextResponse.json({ status: 'up' }), policy)
        ).toThrow(/wildcard origins with credentials/i);
    });

    it('returns a 405 preflight response for unsupported methods', async () => {
        const handler = createCorsOptionsHandler({
            GET: { access: 'public' },
        });

        const request = new NextRequest('http://localhost:3000/api/health', {
            method: 'OPTIONS',
            headers: {
                Origin: 'https://external.example',
                'Access-Control-Request-Method': 'DELETE',
            },
        });

        const response = await handler(request);
        const body = await response.json();

        expect(response.status).toBe(405);
        expect(body.error.code).toBe('METHOD_NOT_ALLOWED');
    });

    it('converts unexpected CORS errors into internal error responses', async () => {
        process.env.COMMITLABS_PUBLIC_API_ORIGINS = '*';

        const handler = createCorsOptionsHandler({
            POST: { access: 'public', allowCredentials: true },
        });

        const request = new NextRequest('http://localhost:3000/api/broken', {
            method: 'OPTIONS',
            headers: {
                Origin: 'https://external.example',
                'Access-Control-Request-Method': 'POST',
            },
        });

        const response = await handler(request);
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body.error.code).toBe('INTERNAL_ERROR');
    });

    it('serializes generic errors through toCorsErrorResponse', async () => {
        const response = toCorsErrorResponse(new Error('boom'));
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body.error.code).toBe('INTERNAL_ERROR');
    });

    it('serializes api errors through toCorsErrorResponse', async () => {
        const response = toCorsErrorResponse(
            new ForbiddenError('Forbidden origin.', { origin: 'https://evil.example' })
        );
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body.error.code).toBe('FORBIDDEN');
        expect(body.error.details).toEqual({ origin: 'https://evil.example' });
    });

    it('rejects wildcard first-party origin configuration', () => {
        process.env.COMMITLABS_FIRST_PARTY_ORIGINS = '*';

        const policy = {
            POST: { access: 'first-party' },
        } satisfies CorsRoutePolicy;

        const request = new NextRequest('http://localhost:3000/api/auth', {
            method: 'POST',
            headers: { Origin: 'https://app.commitlabs.test' },
        });

        expect(() => enforceCorsRequestPolicy(request, policy)).toThrow(
            /cannot be "\*"/i
        );
    });

    it('ignores invalid origin headers when applying policy', () => {
        const policy = {
            GET: { access: 'first-party' },
        } satisfies CorsRoutePolicy;

        const request = new NextRequest('http://localhost:3000/api/auth', {
            method: 'GET',
            headers: { Origin: '   ' },
        });

        const response = applyCorsPolicy(
            request,
            NextResponse.json({ ok: true }),
            policy
        );

        expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
        expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    });

    it('appends origin to an existing vary header only once', () => {
        const policy = {
            GET: { access: 'public' },
        } satisfies CorsRoutePolicy;

        const request = new NextRequest('http://localhost:3000/api/health', {
            method: 'GET',
            headers: { Origin: 'https://external.example' },
        });

        const response = NextResponse.json({ ok: true });
        response.headers.set('Vary', 'Accept-Encoding');

        applyCorsPolicy(request, response, policy);
        applyCorsPolicy(request, response, policy);

        expect(response.headers.get('Vary')).toBe('Accept-Encoding, Origin');
    });
});
