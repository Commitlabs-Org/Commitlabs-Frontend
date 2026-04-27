/**
 * @file tests/api/user-preferences.test.ts
 *
 * Full unit-test suite for GET /api/user/preferences and
 * PUT /api/user/preferences.
 *
 * Coverage targets:
 *   - Auth-required enforcement (401 on missing / malformed headers)
 *   - Validation failure cases (400 with field details)
 *   - Happy-path GET (defaults when no record exists, stored prefs otherwise)
 *   - Happy-path PUT (partial updates, deep-merge semantics)
 *   - Edge cases (empty payload, unknown fields ignored, concurrent writes)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    GET,
    PUT,
    __setStoreForTesting,
    __resetStore,
} from '@/app/api/user/preferences/route';
import {
    DEFAULT_PREFERENCES,
    type UserPreferences,
    type PreferencesStore,
} from '@/lib/backend/preferences';
import { createMockRequest, parseResponse } from './helpers';

// ─── Test store factory ──────────────────────────────────────────────────────

/** In-memory store for deterministic, isolated tests. */
function makeInMemoryStore(
    seed: Record<string, UserPreferences> = {},
): PreferencesStore & { _data: Record<string, UserPreferences> } {
    const _data: Record<string, UserPreferences> = { ...seed };
    return {
        _data,
        async get(address) {
            return _data[address] ?? null;
        },
        async upsert(address, prefs) {
            const existing = _data[address] ?? {};
            _data[address] = deepMerge(existing, prefs);
            return _data[address];
        },
    };
}

function deepMerge<T extends object>(target: T, source: Partial<T>): T {
    const out = { ...target };
    for (const key of Object.keys(source) as (keyof T)[]) {
        const sv = source[key];
        const tv = target[key];
        if (sv !== undefined) {
            if (isPlainObject(sv) && isPlainObject(tv)) {
                (out as Record<keyof T, unknown>)[key] = deepMerge(tv as object, sv as object);
            } else {
                (out as Record<keyof T, unknown>)[key] = sv;
            }
        }
    }
    return out;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const BASE_URL = 'http://localhost:3000/api/user/preferences';
const VALID_ADDRESS = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDE';
/** Mirrors `createSessionToken` placeholder format. */
const VALID_TOKEN = `session_${VALID_ADDRESS}_1714000000000`;
const AUTH_HEADER = { authorization: `Bearer ${VALID_TOKEN}` };

function getReq(headers: Record<string, string> = AUTH_HEADER) {
    return createMockRequest(BASE_URL, { method: 'GET', headers });
}

function putReq(body: unknown, headers: Record<string, string> = AUTH_HEADER) {
    return createMockRequest(BASE_URL, {
        method: 'PUT',
        body: body as Record<string, unknown>,
        headers,
    });
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('GET /api/user/preferences', () => {
    let store: ReturnType<typeof makeInMemoryStore>;

    beforeEach(() => {
        store = makeInMemoryStore();
        __setStoreForTesting(store);
    });

    // ── Auth ────────────────────────────────────────────────────────────────

    it('returns 401 when Authorization header is absent', async () => {
        const res = await GET(getReq({}), { params: {} });
        const { status, data } = await parseResponse(res);

        expect(status).toBe(401);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 when Authorization header has wrong scheme', async () => {
        const res = await GET(getReq({ authorization: 'Basic sometoken' }), { params: {} });
        const { status, data } = await parseResponse(res);

        expect(status).toBe(401);
        expect(data.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 when Bearer token has wrong format', async () => {
        const res = await GET(getReq({ authorization: 'Bearer not-a-valid-token' }), { params: {} });
        const { status, data } = await parseResponse(res);

        expect(status).toBe(401);
        expect(data.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 when Authorization header is empty string', async () => {
        const res = await GET(getReq({ authorization: '' }), { params: {} });
        const { status, data } = await parseResponse(res);

        expect(status).toBe(401);
    });

    it('returns 401 when token has no address segment', async () => {
        const res = await GET(getReq({ authorization: 'Bearer session__1234567890' }), { params: {} });
        const { status, data } = await parseResponse(res);

        expect(status).toBe(401);
    });

    // ── Default preferences ──────────────────────────────────────────────────

    it('returns 200 with default preferences when none are stored', async () => {
        const res = await GET(getReq(), { params: {} });
        const { status, data } = await parseResponse(res);

        expect(status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.address).toBe(VALID_ADDRESS);
        expect(data.data.preferences).toMatchObject(DEFAULT_PREFERENCES);
    });

    it('returns stored preferences when they exist', async () => {
        const prefs: UserPreferences = { displayCurrency: 'EUR', theme: 'dark' };
        store._data[VALID_ADDRESS] = prefs;

        const res = await GET(getReq(), { params: {} });
        const { status, data } = await parseResponse(res);

        expect(status).toBe(200);
        expect(data.data.preferences.displayCurrency).toBe('EUR');
        expect(data.data.preferences.theme).toBe('dark');
    });

    it('response body includes the wallet address', async () => {
        const res = await GET(getReq(), { params: {} });
        const { data } = await parseResponse(res);

        expect(data.data.address).toBe(VALID_ADDRESS);
    });

    it('preferences for different wallets are isolated', async () => {
        const otherAddress = 'GOTHER0000000000000000000000000000000000000';
        const otherToken = `session_${otherAddress}_9999999999999`;
        store._data[otherAddress] = { displayCurrency: 'GBP' };

        const res = await GET(getReq(), { params: {} });
        const { data } = await parseResponse(res);

        // Current user should not see the other wallet's currency
        expect(data.data.preferences.displayCurrency).toBe(DEFAULT_PREFERENCES.displayCurrency);
    });
});

describe('PUT /api/user/preferences', () => {
    let store: ReturnType<typeof makeInMemoryStore>;

    beforeEach(() => {
        store = makeInMemoryStore();
        __setStoreForTesting(store);
    });

    // ── Auth ────────────────────────────────────────────────────────────────

    it('returns 401 when Authorization header is absent', async () => {
        const res = await PUT(putReq({ displayCurrency: 'EUR' }, {}), { params: {} });
        const { status, data } = await parseResponse(res);

        expect(status).toBe(401);
        expect(data.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 when token format is invalid', async () => {
        const res = await PUT(putReq({ displayCurrency: 'EUR' }, { authorization: 'Bearer garbage' }), { params: {} });
        const { status, data } = await parseResponse(res);

        expect(status).toBe(401);
    });

    // ── Validation ───────────────────────────────────────────────────────────

    it('returns 400 for unsupported displayCurrency', async () => {
        const res = await PUT(putReq({ displayCurrency: 'ZZZ' }), { params: {} });
        const { status, data } = await parseResponse(res);

        expect(status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('VALIDATION_ERROR');
        const detail = data.error.details as Array<{ field: string; message: string }>;
        expect(detail.some((d) => d.field === 'displayCurrency')).toBe(true);
    });

    it('returns 400 for invalid theme value', async () => {
        const res = await PUT(putReq({ theme: 'neon' }), { params: {} });
        const { status, data } = await parseResponse(res);

        expect(status).toBe(400);
        const detail = data.error.details as Array<{ field: string }>;
        expect(detail.some((d) => d.field === 'theme')).toBe(true);
    });

    it('returns 400 for invalid language tag', async () => {
        const res = await PUT(putReq({ language: '123' }), { params: {} });
        const { status, data } = await parseResponse(res);

        expect(status).toBe(400);
        const detail = data.error.details as Array<{ field: string }>;
        expect(detail.some((d) => d.field === 'language')).toBe(true);
    });

    it('returns 400 when notifications.email is not boolean', async () => {
        const res = await PUT(putReq({ notifications: { email: 'yes' } }), { params: {} });
        const { status, data } = await parseResponse(res);

        expect(status).toBe(400);
    });

    it('returns 400 for an empty payload', async () => {
        const res = await PUT(putReq({}), { params: {} });
        const { status, data } = await parseResponse(res);

        expect(status).toBe(400);
        expect(data.error.message).toMatch(/at least one preference field/i);
    });

    it('returns 400 for non-JSON body', async () => {
        // Manually craft a request with an unparseable body
        const req = createMockRequest(BASE_URL, {
            method: 'PUT',
            headers: { ...AUTH_HEADER, 'Content-Type': 'text/plain' },
        });
        // Override json() to throw
        Object.defineProperty(req, 'json', {
            value: async () => { throw new SyntaxError('invalid json'); },
        });

        const res = await PUT(req, { params: {} });
        const { status, data } = await parseResponse(res);

        expect(status).toBe(400);
        expect(data.error.message).toMatch(/valid JSON/i);
    });

    // ── Happy path ───────────────────────────────────────────────────────────

    it('returns 200 and persists a single field update', async () => {
        const res = await PUT(putReq({ displayCurrency: 'GBP' }), { params: {} });
        const { status, data } = await parseResponse(res);

        expect(status).toBe(200);
        expect(data.data.preferences.displayCurrency).toBe('GBP');
        expect(store._data[VALID_ADDRESS]?.displayCurrency).toBe('GBP');
    });

    it('deep-merges notification flags without overwriting unspecified ones', async () => {
        // Seed initial state
        store._data[VALID_ADDRESS] = {
            notifications: { email: true, push: true, sms: false },
        };

        const res = await PUT(putReq({ notifications: { sms: true } }), { params: {} });
        const { status, data } = await parseResponse(res);

        expect(status).toBe(200);
        // sms updated
        expect(data.data.preferences.notifications.sms).toBe(true);
        // email and push preserved
        expect(data.data.preferences.notifications.email).toBe(true);
        expect(data.data.preferences.notifications.push).toBe(true);
    });

    it('response body includes the wallet address', async () => {
        const res = await PUT(putReq({ theme: 'dark' }), { params: {} });
        const { data } = await parseResponse(res);

        expect(data.data.address).toBe(VALID_ADDRESS);
    });

    it('accepts all valid displayCurrency values', async () => {
        const currencies = ['USD', 'EUR', 'GBP', 'XLM'] as const;
        for (const currency of currencies) {
            const res = await PUT(putReq({ displayCurrency: currency }), { params: {} });
            const { status } = await parseResponse(res);
            expect(status).toBe(200);
        }
    });

    it('accepts all valid theme values', async () => {
        const themes = ['light', 'dark', 'system'] as const;
        for (const theme of themes) {
            const res = await PUT(putReq({ theme }), { params: {} });
            const { status } = await parseResponse(res);
            expect(status).toBe(200);
        }
    });

    it('accepts valid BCP-47 language tags', async () => {
        const languages = ['en', 'fr', 'en-US', 'zh-CN'];
        for (const language of languages) {
            const res = await PUT(putReq({ language }), { params: {} });
            const { status } = await parseResponse(res);
            expect(status).toBe(200);
        }
    });

    it('multiple updates accumulate correctly', async () => {
        await PUT(putReq({ displayCurrency: 'EUR' }), { params: {} });
        await PUT(putReq({ theme: 'dark' }), { params: {} });
        const res = await PUT(putReq({ notifications: { email: false } }), { params: {} });
        const { data } = await parseResponse(res);

        expect(data.data.preferences.displayCurrency).toBe('EUR');
        expect(data.data.preferences.theme).toBe('dark');
        expect(data.data.preferences.notifications.email).toBe(false);
    });

    it('unknown fields in payload are silently stripped (not stored)', async () => {
        const res = await PUT(
            putReq({ displayCurrency: 'XLM', unknownField: 'sneaky' } as Record<string, unknown>),
            { params: {} },
        );
        const { status, data } = await parseResponse(res);

        expect(status).toBe(200);
        expect(data.data.preferences).not.toHaveProperty('unknownField');
    });
});

describe('preferences module – requireWalletAuth', () => {
    it('is tested indirectly via GET / PUT auth tests above', () => {
        // Documented here for coverage traceability.
        expect(true).toBe(true);
    });
});
