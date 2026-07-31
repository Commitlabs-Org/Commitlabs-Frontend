import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GET, PUT, __setStoreForTesting, __resetStore } from './route';
import {
  DEFAULT_PREFERENCES,
  type PreferencesStore,
  type UserPreferences,
  isNotificationCategoryEnabled,
  filterNotificationsByPreferences,
  requireWalletAuth,
  jsonFilePreferencesStore,
} from '@/lib/backend/preferences';
import { createMockRequest, parseResponse } from '../../../../../tests/api/helpers';

const BASE_URL = 'http://localhost:3000/api/user/preferences';
const VALID_ADDRESS = 'GAAA1111111111111111111111111111111111111';
const VALID_TOKEN = `session_${VALID_ADDRESS}_1700000000000`;
const AUTH_HEADER = { authorization: `Bearer ${VALID_TOKEN}` };

function makeInMemoryStore(): PreferencesStore & { _data: Record<string, UserPreferences> } {
  const _data: Record<string, UserPreferences> = {};
  return {
    _data,
    async get(address: string): Promise<UserPreferences | null> {
      return _data[address] ?? null;
    },
    async upsert(address: string, prefs: UserPreferences): Promise<UserPreferences> {
      const existing = _data[address] ?? {};
      const merged: UserPreferences = { ...existing, ...prefs };
      if (prefs.notifications && existing.notifications) {
        merged.notifications = { ...existing.notifications, ...prefs.notifications };
      }
      if (prefs.notificationCategories && existing.notificationCategories) {
        merged.notificationCategories = {
          ...existing.notificationCategories,
          ...prefs.notificationCategories,
        };
      }
      _data[address] = merged;
      return merged;
    },
  };
}

function getReq(headers: Record<string, string> = AUTH_HEADER) {
  return createMockRequest(BASE_URL, { method: 'GET', headers });
}

function putReq(body: unknown, headers: Record<string, string> = AUTH_HEADER) {
  return createMockRequest(BASE_URL, { method: 'PUT', body, headers });
}

describe('GET /api/user/preferences', () => {
  let store: ReturnType<typeof makeInMemoryStore>;

  beforeEach(() => {
    store = makeInMemoryStore();
    __setStoreForTesting(store);
  });

  afterEach(() => {
    __resetStore();
  });

  it('returns 401 when Authorization header is absent', async () => {
    const res = await GET(getReq({}), { params: {} });
    const { status, data } = await parseResponse(res);
    expect(status).toBe(401);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns default preferences when no preferences are stored', async () => {
    const res = await GET(getReq(), { params: {} });
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.address).toBe(VALID_ADDRESS);
    expect(data.data.preferences).toEqual(DEFAULT_PREFERENCES);
  });

  it('returns stored preferences when available', async () => {
    store._data[VALID_ADDRESS] = { displayCurrency: 'EUR', theme: 'dark' };
    const res = await GET(getReq(), { params: {} });
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.data.preferences.displayCurrency).toBe('EUR');
    expect(data.data.preferences.theme).toBe('dark');
  });

  it('preferences for different wallets are isolated', async () => {
    const otherAddress = 'GBBB2222222222222222222222222222222222222';
    store._data[otherAddress] = { displayCurrency: 'GBP' };
    const res = await GET(getReq(), { params: {} });
    const { data } = await parseResponse(res);
    expect(data.data.preferences.displayCurrency).toBe(DEFAULT_PREFERENCES.displayCurrency);
  });
});

describe('PUT /api/user/preferences', () => {
  let store: ReturnType<typeof makeInMemoryStore>;

  beforeEach(() => {
    store = makeInMemoryStore();
    __setStoreForTesting(store);
  });

  afterEach(() => {
    __resetStore();
  });

  it('returns 401 when Authorization header is absent', async () => {
    const res = await PUT(putReq({ displayCurrency: 'EUR' }, {}), { params: {} });
    const { status, data } = await parseResponse(res);
    expect(status).toBe(401);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when token format is invalid', async () => {
    const res = await PUT(
      putReq({ displayCurrency: 'EUR' }, { authorization: 'Bearer invalid_token' }),
      { params: {} },
    );
    const { status } = await parseResponse(res);
    expect(status).toBe(401);
  });

  it('returns 400 for unsupported displayCurrency', async () => {
    const res = await PUT(putReq({ displayCurrency: 'ZZZ' }), { params: {} });
    const { status, data } = await parseResponse(res);
    expect(status).toBe(400);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for invalid theme value', async () => {
    const res = await PUT(putReq({ theme: 'neon' }), { params: {} });
    const { status } = await parseResponse(res);
    expect(status).toBe(400);
  });

  it('returns 400 for invalid language tag', async () => {
    const res = await PUT(putReq({ language: '123' }), { params: {} });
    const { status } = await parseResponse(res);
    expect(status).toBe(400);
  });

  it('returns 400 for empty payload', async () => {
    const res = await PUT(putReq({}), { params: {} });
    const { status, data } = await parseResponse(res);
    expect(status).toBe(400);
    expect(data.error.message).toMatch(/at least one preference field/i);
  });

  it('returns 400 for invalid JSON request body', async () => {
    const req = createMockRequest(BASE_URL, {
      method: 'PUT',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
    });
    Object.defineProperty(req, 'json', {
      value: async () => {
        throw new SyntaxError('Invalid JSON');
      },
    });

    const res = await PUT(req, { params: {} });
    const { status, data } = await parseResponse(res);
    expect(status).toBe(400);
    expect(data.error.message).toMatch(/valid JSON/i);
  });

  it('returns 200 and persists a single field update', async () => {
    const res = await PUT(putReq({ displayCurrency: 'GBP' }), { params: {} });
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.data.preferences.displayCurrency).toBe('GBP');
  });

  it('performs round-trip PUT and GET for savedMarketplaceSearches', async () => {
    const sampleSavedSearches = [
      {
        id: 'search-1',
        name: 'Low Risk Preset',
        filters: {
          sortBy: 'compliance',
          commitmentType: ['conservative', 'balanced'],
          priceRange: [0, 50000] as [number, number],
          durationRange: [0, 30] as [number, number],
          minCompliance: 85,
          maxLoss: 10,
        },
        createdAt: '2026-07-30T00:00:00.000Z',
      },
    ];

    // 1. PUT savedMarketplaceSearches
    const putRes = await PUT(putReq({ savedMarketplaceSearches: sampleSavedSearches }), {
      params: {},
    });
    const putParsed = await parseResponse(putRes);
    expect(putParsed.status).toBe(200);
    expect(putParsed.data.data.preferences.savedMarketplaceSearches).toEqual(sampleSavedSearches);

    // 2. GET user preferences and confirm round-trip persistence
    const getRes = await GET(getReq(), { params: {} });
    const getParsed = await parseResponse(getRes);
    expect(getParsed.status).toBe(200);
    expect(getParsed.data.data.preferences.savedMarketplaceSearches).toEqual(sampleSavedSearches);
  });

  it('strips unknown payload fields', async () => {
    const res = await PUT(putReq({ displayCurrency: 'XLM', unexpectedProp: 'test' }), {
      params: {},
    });
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.data.preferences).not.toHaveProperty('unexpectedProp');
  });
});

describe('preferences helpers & store', () => {
  it('requireWalletAuth throws on null or invalid format', () => {
    expect(() => requireWalletAuth(null)).toThrow('Authorization header is required.');
    expect(() => requireWalletAuth('Basic token')).toThrow(
      'Authorization header must be in format: Bearer <token>',
    );
    expect(() => requireWalletAuth('Bearer invalid_token_str')).toThrow(
      'Invalid or expired session token.',
    );
  });

  it('isNotificationCategoryEnabled evaluates categories correctly', () => {
    expect(isNotificationCategoryEnabled('expiry', null)).toBe(true);
    expect(
      isNotificationCategoryEnabled('violation', {
        notificationCategories: { violation: false },
      }),
    ).toBe(false);
    expect(isNotificationCategoryEnabled('unknown', null)).toBe(true);
  });

  it('filterNotificationsByPreferences filters array based on preferences', () => {
    const notifications = [
      { id: '1', type: 'expiry' },
      { id: '2', type: 'violation' },
    ];
    const filtered = filterNotificationsByPreferences(notifications, {
      notificationCategories: { violation: false },
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('1');
  });

  it('jsonFilePreferencesStore reads and writes preferences', async () => {
    const testAddress = 'GTESTSTORE123456789';
    const prefs = { displayCurrency: 'GBP' as const };
    await jsonFilePreferencesStore.upsert(testAddress, prefs);
    const retrieved = await jsonFilePreferencesStore.get(testAddress);
    expect(retrieved?.displayCurrency).toBe('GBP');
  });
});
