import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { getClientIp } from '@/lib/backend/getClientIp';

function createMockReq(opts: { ip?: string; xForwardedFor?: string }): NextRequest {
  const headers = new Headers();

  if (opts.xForwardedFor !== undefined) {
    headers.set('x-forwarded-for', opts.xForwardedFor);
  }

  const req = new NextRequest('http://localhost/test', { headers });

  if (opts.ip !== undefined) {
    Object.defineProperty(req, 'ip', { value: opts.ip, writable: false });
  }

  return req;
}

describe('getClientIp', () => {
  describe('default mode', () => {
    it('returns req.ip when available', () => {
      const req = createMockReq({
        ip: '203.0.113.9',
        xForwardedFor: '1.2.3.4, 5.6.7.8',
      });

      expect(getClientIp(req)).toBe('203.0.113.9');
    });

    it('returns anonymous when req.ip is missing', () => {
      const req = createMockReq({});

      expect(getClientIp(req)).toBe('anonymous');
    });

    it('ignores x-forwarded-for entirely in default mode', () => {
      const req = createMockReq({
        xForwardedFor: '198.51.100.10, 198.51.100.11',
      });

      expect(getClientIp(req)).toBe('anonymous');
    });

    it('does not use spoofed single-entry x-forwarded-for in default mode', () => {
      const req = createMockReq({
        xForwardedFor: 'spoofed-ip',
      });

      expect(getClientIp(req)).toBe('anonymous');
    });

    it('returns anonymous when req.ip is invalid', () => {
      const req = createMockReq({
        ip: 'not-an-ip',
      });

      expect(getClientIp(req)).toBe('anonymous');
    });
  });

  describe('trusted proxy mode', () => {
    it('returns the client IP with one trusted proxy', () => {
      const req = createMockReq({
        xForwardedFor: '203.0.113.5, 198.51.100.2',
      });

      expect(getClientIp(req, { trustedProxyCount: 1 })).toBe('203.0.113.5');
    });

    it('returns the client IP with two trusted proxies', () => {
      const req = createMockReq({
        xForwardedFor: '10.0.0.1, 203.0.113.8, 198.51.100.2, 198.51.100.3',
      });

      expect(getClientIp(req, { trustedProxyCount: 2 })).toBe('203.0.113.8');
    });

    it('trims whitespace in x-forwarded-for', () => {
      const req = createMockReq({
        xForwardedFor: ' 1.2.3.4 , 5.6.7.8 ',
      });

      expect(getClientIp(req, { trustedProxyCount: 1 })).toBe('1.2.3.4');
    });

    it('falls back to req.ip when x-forwarded-for has fewer entries than trusted proxy count', () => {
      const req = createMockReq({
        ip: '192.0.2.44',
        xForwardedFor: '203.0.113.5, 198.51.100.2',
      });

      expect(getClientIp(req, { trustedProxyCount: 2 })).toBe('192.0.2.44');
    });

    it('falls back to anonymous when x-forwarded-for is missing and req.ip is undefined', () => {
      const req = createMockReq({});

      expect(getClientIp(req, { trustedProxyCount: 1 })).toBe('anonymous');
    });

    it('does not return a spoofed leftmost entry when proxies are trusted', () => {
      const req = createMockReq({
        xForwardedFor: '10.0.0.1, 203.0.113.9, 198.51.100.10',
      });

      expect(getClientIp(req, { trustedProxyCount: 1 })).toBe('203.0.113.9');
    });

    it('falls back to req.ip when the selected forwarded entry is invalid', () => {
      const req = createMockReq({
        ip: '192.0.2.12',
        xForwardedFor: '203.0.113.5, garbage, 198.51.100.20',
      });

      expect(getClientIp(req, { trustedProxyCount: 1 })).toBe('192.0.2.12');
    });
  });

  describe('ip validation and normalization', () => {
    it('passes through valid IPv4 addresses', () => {
      const req = createMockReq({
        ip: '8.8.8.8',
      });

      expect(getClientIp(req)).toBe('8.8.8.8');
    });

    it('passes through valid IPv6 addresses', () => {
      const req = createMockReq({
        ip: '2001:db8::42',
      });

      expect(getClientIp(req)).toBe('2001:db8::42');
    });

    it('strips IPv6 zone IDs', () => {
      const req = createMockReq({
        ip: 'fe80::1%eth0',
      });

      expect(getClientIp(req)).toBe('fe80::1');
    });

    it('falls back to anonymous for invalid req.ip when no valid fallback exists', () => {
      const req = createMockReq({
        ip: '999.999.999.999',
      });

      expect(getClientIp(req)).toBe('anonymous');
    });
  });

  describe('edge cases', () => {
    it('falls back when x-forwarded-for header is empty', () => {
      const req = createMockReq({
        ip: '192.0.2.7',
        xForwardedFor: '',
      });

      expect(getClientIp(req, { trustedProxyCount: 1 })).toBe('192.0.2.7');
    });

    it('falls back when x-forwarded-for has a single entry', () => {
      const req = createMockReq({
        ip: '192.0.2.8',
        xForwardedFor: '203.0.113.5',
      });

      expect(getClientIp(req, { trustedProxyCount: 1 })).toBe('192.0.2.8');
    });

    it('ignores empty segments after splitting x-forwarded-for', () => {
      const req = createMockReq({
        xForwardedFor: ' , 203.0.113.5 , 198.51.100.10 , ',
      });

      expect(getClientIp(req, { trustedProxyCount: 1 })).toBe('203.0.113.5');
    });

    it('normalizes negative and fractional trusted proxy counts to default behavior', () => {
      const req = createMockReq({
        ip: '192.0.2.9',
        xForwardedFor: '203.0.113.5, 198.51.100.10',
      });

      expect(getClientIp(req, { trustedProxyCount: -2 })).toBe('192.0.2.9');
      expect(getClientIp(req, { trustedProxyCount: 1.9 })).toBe('203.0.113.5');
    });
  });
});
