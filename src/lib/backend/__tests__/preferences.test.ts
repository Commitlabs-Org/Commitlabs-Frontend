import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PreferencesStore, UserPreferences } from '../preferences';

/** Build an isolated in-memory PreferencesStore for unit testing. */
function createMemoryStore(): PreferencesStore {
    const store = new Map<string, UserPreferences>();
    return {
        async get(address: string): Promise<UserPreferences | null> {
            return store.get(address) ?? null;
        },
        async upsert(address: string, prefs: UserPreferences): Promise<UserPreferences> {
            const existing = store.get(address) ?? {};
            const merged = deepMerge(existing, prefs);
            store.set(address, merged);
            return merged;
        },
    };
}

function deepMerge<T extends object>(target: T, source: Partial<T>): T {
    const out = { ...target };
    for (const key of Object.keys(source) as (keyof T)[]) {
        const sv = source[key];
        const tv = target[key];
        if (sv !== undefined) {
            if (isPlain(sv) && isPlain(tv)) {
                (out as Record<keyof T, unknown>)[key] = deepMerge(tv as object, sv as object);
            } else {
                (out as Record<keyof T, unknown>)[key] = sv;
            }
        }
    }
    return out;
}

function isPlain(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

describe('preferences store', () => {
    let store: PreferencesStore;

    beforeEach(() => {
        store = createMemoryStore();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns null for a new user with no stored preferences', async () => {
        const result = await store.get('GNEWUSER');
        expect(result).toBeNull();
    });

    it('persists preferences set for a user', async () => {
        const prefs: UserPreferences = { theme: 'dark', language: 'en' };
        await store.upsert('GADDR1', prefs);
        const result = await store.get('GADDR1');
        expect(result).toMatchObject({ theme: 'dark', language: 'en' });
    });

    it('merges partial updates rather than overwriting existing preferences', async () => {
        await store.upsert('GADDR2', { theme: 'dark', language: 'fr' });
        await store.upsert('GADDR2', { language: 'de' });
        const result = await store.get('GADDR2');
        expect(result?.theme).toBe('dark');
        expect(result?.language).toBe('de');
    });

    it('merges nested notification objects on partial update', async () => {
        await store.upsert('GADDR3', { notifications: { email: true, push: false, sms: false } });
        await store.upsert('GADDR3', { notifications: { push: true } });
        const result = await store.get('GADDR3');
        expect(result?.notifications?.email).toBe(true);
        expect(result?.notifications?.push).toBe(true);
        expect(result?.notifications?.sms).toBe(false);
    });

    it('isolates preferences between two distinct users', async () => {
        await store.upsert('GUSER_A', { theme: 'dark' });
        await store.upsert('GUSER_B', { theme: 'light' });
        const a = await store.get('GUSER_A');
        const b = await store.get('GUSER_B');
        expect(a?.theme).toBe('dark');
        expect(b?.theme).toBe('light');
    });

    it('updating one user does not affect another', async () => {
        await store.upsert('GUSER_X', { theme: 'dark', language: 'en' });
        await store.upsert('GUSER_Y', { theme: 'light' });
        await store.upsert('GUSER_X', { language: 'ja' });
        const y = await store.get('GUSER_Y');
        expect(y?.language).toBeUndefined();
        expect(y?.theme).toBe('light');
    });

    it('upsert returns the merged preferences', async () => {
        await store.upsert('GADDR4', { theme: 'system', seenWizardTour: false });
        const updated = await store.upsert('GADDR4', { seenWizardTour: true });
        expect(updated.seenWizardTour).toBe(true);
        expect(updated.theme).toBe('system');
    });

    it('supports all valid displayCurrency values', async () => {
        for (const currency of ['USD', 'EUR', 'GBP', 'XLM'] as const) {
            await store.upsert(`GCURR_${currency}`, { displayCurrency: currency });
            const result = await store.get(`GCURR_${currency}`);
            expect(result?.displayCurrency).toBe(currency);
        }
    });

    it('merges notificationCategories on partial update', async () => {
        await store.upsert('GNOTIF', {
            notificationCategories: { expiry: true, violation: true, health_check: false },
        });
        await store.upsert('GNOTIF', { notificationCategories: { health_check: true } });
        const result = await store.get('GNOTIF');
        expect(result?.notificationCategories?.expiry).toBe(true);
        expect(result?.notificationCategories?.violation).toBe(true);
        expect(result?.notificationCategories?.health_check).toBe(true);
    });
});

describe('DEFAULT_PREFERENCES', () => {
    it('exports expected default values', async () => {
        const { DEFAULT_PREFERENCES } = await import('../preferences');
        expect(DEFAULT_PREFERENCES.displayCurrency).toBe('USD');
        expect(DEFAULT_PREFERENCES.theme).toBe('system');
        expect(DEFAULT_PREFERENCES.language).toBe('en');
        expect(DEFAULT_PREFERENCES.seenWizardTour).toBe(false);
        expect(DEFAULT_PREFERENCES.notifications).toEqual({ email: true, push: true, sms: false });
        expect(DEFAULT_PREFERENCES.notificationCategories).toEqual({
            expiry: true,
            violation: true,
            health_check: true,
        });
    });
});

describe('isNotificationCategoryEnabled', () => {
    it('returns true for a category enabled in preferences', async () => {
        const { isNotificationCategoryEnabled } = await import('../preferences');
        const prefs: UserPreferences = {
            notificationCategories: { expiry: true, violation: false, health_check: true },
        };
        expect(isNotificationCategoryEnabled('expiry', prefs)).toBe(true);
        expect(isNotificationCategoryEnabled('violation', prefs)).toBe(false);
    });

    it('falls back to default when category is not set in preferences', async () => {
        const { isNotificationCategoryEnabled } = await import('../preferences');
        expect(isNotificationCategoryEnabled('expiry', null)).toBe(true);
        expect(isNotificationCategoryEnabled('health_check', {})).toBe(true);
    });

    it('returns true for an unknown category (safe-by-default)', async () => {
        const { isNotificationCategoryEnabled } = await import('../preferences');
        expect(isNotificationCategoryEnabled('unknown_category', null)).toBe(true);
    });
});

describe('filterNotificationsByPreferences', () => {
    it('filters out notifications for disabled categories', async () => {
        const { filterNotificationsByPreferences } = await import('../preferences');
        const prefs: UserPreferences = {
            notificationCategories: { expiry: false, violation: true, health_check: true },
        };
        const notifications = [
            { type: 'expiry', id: 1 },
            { type: 'violation', id: 2 },
            { type: 'health_check', id: 3 },
        ];
        const result = filterNotificationsByPreferences(notifications, prefs);
        expect(result).toHaveLength(2);
        expect(result.map((n) => n.type)).toEqual(['violation', 'health_check']);
    });

    it('returns all notifications when preferences are null', async () => {
        const { filterNotificationsByPreferences } = await import('../preferences');
        const notifications = [
            { type: 'expiry', id: 1 },
            { type: 'violation', id: 2 },
        ];
        expect(filterNotificationsByPreferences(notifications, null)).toHaveLength(2);
    });
});
