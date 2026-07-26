import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getSiteUrl,
  resolveSiteUrl,
  __resetSiteUrlForTests,
} from '@/lib/site';

describe('resolveSiteUrl', () => {
  it('returns NEXT_PUBLIC_SITE_URL when set', () => {
    expect(
      resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: 'https://app.example.com' }),
    ).toBe('https://app.example.com');
  });

  it('falls back to SITE_URL when NEXT_PUBLIC_SITE_URL is unset', () => {
    expect(
      resolveSiteUrl({ SITE_URL: 'https://staging.example.com' }),
    ).toBe('https://staging.example.com');
  });

  it('falls back to APP_URL', () => {
    expect(resolveSiteUrl({ APP_URL: 'https://app2.example.com' })).toBe(
      'https://app2.example.com',
    );
  });

  it('falls back to NEXT_PUBLIC_APP_URL', () => {
    expect(
      resolveSiteUrl({ NEXT_PUBLIC_APP_URL: 'https://app3.example.com' }),
    ).toBe('https://app3.example.com');
  });

  it('falls back to VERCEL_PROJECT_PRODUCTION_URL', () => {
    expect(
      resolveSiteUrl({ VERCEL_PROJECT_PRODUCTION_URL: 'commitlabs.vercel.app' }),
    ).toBe('https://commitlabs.vercel.app');
  });

  it('falls back to VERCEL_URL', () => {
    expect(
      resolveSiteUrl({ VERCEL_URL: 'commitlabs-pr-1.vercel.app' }),
    ).toBe('https://commitlabs-pr-1.vercel.app');
  });

  it('returns the production fallback when no env vars are set', () => {
    expect(resolveSiteUrl({})).toBe('https://commitlabs.com');
  });

  it('prefers NEXT_PUBLIC_SITE_URL over other keys', () => {
    expect(
      resolveSiteUrl({
        NEXT_PUBLIC_SITE_URL: 'https://primary.example.com',
        SITE_URL: 'https://secondary.example.com',
        VERCEL_URL: 'vercel.example.com',
      }),
    ).toBe('https://primary.example.com');
  });

  it('skips empty strings', () => {
    expect(
      resolveSiteUrl({
        NEXT_PUBLIC_SITE_URL: '',
        SITE_URL: 'https://app.example.com',
      }),
    ).toBe('https://app.example.com');
  });

  it('skips whitespace-only strings', () => {
    expect(
      resolveSiteUrl({
        NEXT_PUBLIC_SITE_URL: '   ',
        SITE_URL: 'https://app.example.com',
      }),
    ).toBe('https://app.example.com');
  });

  it('falls back to the default when every configured value is invalid', () => {
    expect(
      resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: 'http://[invalid' }),
    ).toBe('https://commitlabs.com');
  });

  it('strips trailing slashes from the origin', () => {
    expect(
      resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: 'https://app.example.com/' }),
    ).toBe('https://app.example.com');
  });

  it('prepends https:// when no scheme is provided', () => {
    expect(
      resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: 'app.example.com' }),
    ).toBe('https://app.example.com');
  });
});

describe('getSiteUrl', () => {
  const ORIGINAL_ENV = { ...process.env };
  beforeEach(() => {
    __resetSiteUrlForTests();
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.SITE_URL;
    delete process.env.APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    delete process.env.VERCEL_URL;
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    __resetSiteUrlForTests();
  });

  it('returns the resolved value', () => {
    expect(getSiteUrl()).toBe('https://commitlabs.com');
  });

  it('memoizes the resolved value across calls', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://first.example.com';
    __resetSiteUrlForTests();
    expect(getSiteUrl()).toBe('https://first.example.com');

    process.env.NEXT_PUBLIC_SITE_URL = 'https://second.example.com';
    // No reset — still cached
    expect(getSiteUrl()).toBe('https://first.example.com');
  });

  it('picks up changes after the cache is reset', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://first.example.com';
    __resetSiteUrlForTests();
    expect(getSiteUrl()).toBe('https://first.example.com');

    process.env.NEXT_PUBLIC_SITE_URL = 'https://second.example.com';
    __resetSiteUrlForTests();
    expect(getSiteUrl()).toBe('https://second.example.com');
  });
});