import { describe, expect, it } from 'vitest';

import { buildCsp, toOriginOrNull } from '@/lib/security/csp';

const NONCE = 'abc123+/==';

function directivesOf(csp: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const part of csp.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const [name, ...sources] = trimmed.split(/\s+/);
    out[name] = sources;
  }
  return out;
}

describe('buildCsp', () => {
  const base = {
    nonce: NONCE,
    horizonUrl: 'https://horizon-testnet.stellar.org',
    rpcUrl: 'https://soroban-testnet.stellar.org',
    isDev: false,
  };

  it('includes the nonce in script-src', () => {
    const csp = buildCsp(base);
    expect(csp).toContain(`'nonce-${NONCE}'`);
    expect(csp).toContain(`'strict-dynamic'`);
    expect(directivesOf(csp)['script-src']).toContain(`'nonce-${NONCE}'`);
  });

  it('produces no unsafe-eval in production', () => {
    expect(buildCsp({ ...base, isDev: false })).not.toContain("'unsafe-eval'");
  });

  it('adds unsafe-eval only in development', () => {
    expect(buildCsp({ ...base, isDev: true })).toContain("'unsafe-eval'");
  });

  it('adds upgrade-insecure-requests only in production', () => {
    expect(buildCsp({ ...base, isDev: false })).toContain(
      'upgrade-insecure-requests',
    );
    expect(buildCsp({ ...base, isDev: true })).not.toContain(
      'upgrade-insecure-requests',
    );
  });

  it('restricts connect-src to self plus the exact Horizon and RPC origins', () => {
    const directives = directivesOf(buildCsp(base));
    expect(directives['connect-src']).toEqual([
      "'self'",
      'https://horizon-testnet.stellar.org',
      'https://soroban-testnet.stellar.org',
    ]);
  });

  it('updates connect-src when the Soroban RPC URL changes', () => {
    const csp = buildCsp({ ...base, rpcUrl: 'https://rpc.example.com:8443' });
    expect(csp).toContain('https://rpc.example.com:8443');
    expect(csp).not.toContain('https://soroban-testnet.stellar.org');
  });

  it('never allows * or scheme-only sources in connect-src', () => {
    const directives = directivesOf(
      buildCsp({ ...base, horizonUrl: '*', rpcUrl: 'https:' }),
    );
    expect(directives['connect-src']).toEqual(["'self'"]);
  });

  it('falls back safely when an env URL is invalid', () => {
    const directives = directivesOf(
      buildCsp({
        ...base,
        horizonUrl: 'not a url',
        rpcUrl: 'ftp://files.example.com',
      }),
    );
    expect(directives['connect-src']).toEqual(["'self'"]);
  });

  it('deduplicates connect-src origins when both services share an origin', () => {
    const directives = directivesOf(
      buildCsp({ ...base, rpcUrl: base.horizonUrl }),
    );
    expect(directives['connect-src']).toEqual([
      "'self'",
      'https://horizon-testnet.stellar.org',
    ]);
  });

  it('has no duplicate directives', () => {
    const csp = buildCsp({ ...base, isDev: true });
    const names = csp
      .split(';')
      .map((part) => part.trim().split(/\s+/)[0])
      .filter(Boolean);
    expect(new Set(names).size).toBe(names.length);
  });

  it('keeps frame-ancestors, base-uri, form-action and object-src locked down', () => {
    const directives = directivesOf(buildCsp(base));
    expect(directives['frame-ancestors']).toEqual(["'none'"]);
    expect(directives['base-uri']).toEqual(["'self'"]);
    expect(directives['form-action']).toEqual(["'self'"]);
    expect(directives['object-src']).toEqual(["'none'"]);
    expect(directives['default-src']).toEqual(["'self'"]);
  });
});

describe('toOriginOrNull', () => {
  it('strips paths, query strings and fragments', () => {
    expect(
      toOriginOrNull('https://horizon.example.com/api/ledgers?limit=10#x'),
    ).toBe('https://horizon.example.com');
  });

  it('keeps explicit ports', () => {
    expect(toOriginOrNull('https://rpc.example.com:8443/v1')).toBe(
      'https://rpc.example.com:8443',
    );
  });

  it('rejects wildcards, scheme-only and unparseable values', () => {
    expect(toOriginOrNull('*')).toBeNull();
    expect(toOriginOrNull('https:')).toBeNull();
    expect(toOriginOrNull('')).toBeNull();
    expect(toOriginOrNull('   ')).toBeNull();
    expect(toOriginOrNull('not a url')).toBeNull();
  });

  it('rejects non-http(s) schemes', () => {
    expect(toOriginOrNull('ftp://files.example.com')).toBeNull();
    expect(toOriginOrNull('ws://localhost:1234')).toBeNull();
  });
});
