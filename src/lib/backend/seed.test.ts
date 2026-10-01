import { describe, it, expect, afterEach, vi } from 'vitest';
import { isSeedAllowed, isSeedSecretValid, seedMockData } from './seed';

const SECRET = 'not-a-real-seed-secret';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('isSeedSecretValid', () => {
  it('accepts any caller while no SEED_SECRET is configured', () => {
    vi.stubEnv('SEED_SECRET', '');

    expect(isSeedSecretValid('anything')).toBe(true);
    expect(isSeedSecretValid(null)).toBe(true);
  });

  it('accepts an exactly matching secret', () => {
    vi.stubEnv('SEED_SECRET', SECRET);

    expect(isSeedSecretValid(SECRET)).toBe(true);
  });

  it('rejects a missing secret header instead of treating it as a match', () => {
    vi.stubEnv('SEED_SECRET', SECRET);

    expect(isSeedSecretValid(null)).toBe(false);
  });

  it('rejects an empty secret header', () => {
    vi.stubEnv('SEED_SECRET', SECRET);

    expect(isSeedSecretValid('')).toBe(false);
  });

  it('rejects a wrong secret without throwing on a length mismatch', () => {
    vi.stubEnv('SEED_SECRET', SECRET);

    // timingSafeEqual throws a RangeError on unequal buffer lengths; a
    // length mismatch must be handled as "not equal", not surfaced as a crash.
    expect(() => isSeedSecretValid('short')).not.toThrow();
    expect(isSeedSecretValid('short')).toBe(false);
    expect(() => isSeedSecretValid(SECRET + SECRET)).not.toThrow();
    expect(isSeedSecretValid(SECRET + SECRET)).toBe(false);
  });

  it('rejects a same-length guess that differs only in the last byte', () => {
    vi.stubEnv('SEED_SECRET', SECRET);
    const almost = SECRET.slice(0, -1) + (SECRET.endsWith('a') ? 'b' : 'a');

    expect(almost).toHaveLength(SECRET.length);
    expect(isSeedSecretValid(almost)).toBe(false);
  });
});

describe('isSeedAllowed', () => {
  it('is disabled outside development and test', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SEED_ROUTE_ENABLED', 'true');

    expect(isSeedAllowed()).toBe(false);
  });

  it('is disabled when the route flag is not exactly "true"', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('SEED_ROUTE_ENABLED', '1');

    expect(isSeedAllowed()).toBe(false);
  });

  it('is enabled in development when the route flag is true', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('SEED_ROUTE_ENABLED', 'true');

    expect(isSeedAllowed()).toBe(true);
  });
});

describe('seedMockData', () => {
  it('refuses to seed when the route is disabled', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SEED_ROUTE_ENABLED', 'true');

    const result = await seedMockData(null);

    expect(result.seeded).toBe(false);
    expect(result.message).toContain('disabled');
  });

  it('refuses to seed when the configured secret does not match', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('SEED_ROUTE_ENABLED', 'true');
    vi.stubEnv('SEED_SECRET', SECRET);

    const result = await seedMockData('not-the-secret');

    expect(result.seeded).toBe(false);
    expect(result.message).toBe('Invalid seed secret.');
  });
});
