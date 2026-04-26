import { NextRequest } from 'next/server';

export interface GetClientIpOptions {
  trustedProxyCount?: number;
}

const IPV4_OCTET = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';
const IPV4_REGEX = new RegExp(`^(?:${IPV4_OCTET}\\.){3}${IPV4_OCTET}$`);
const IPV6_REGEX =
  /^(?:[A-Fa-f0-9]{1,4}(?::[A-Fa-f0-9]{1,4}){7}|(?:[A-Fa-f0-9]{1,4}:){1,7}:|(?:[A-Fa-f0-9]{1,4}:){1,6}:[A-Fa-f0-9]{1,4}|(?:[A-Fa-f0-9]{1,4}:){1,5}(?::[A-Fa-f0-9]{1,4}){1,2}|(?:[A-Fa-f0-9]{1,4}:){1,4}(?::[A-Fa-f0-9]{1,4}){1,3}|(?:[A-Fa-f0-9]{1,4}:){1,3}(?::[A-Fa-f0-9]{1,4}){1,4}|(?:[A-Fa-f0-9]{1,4}:){1,2}(?::[A-Fa-f0-9]{1,4}){1,5}|[A-Fa-f0-9]{1,4}:(?:(?::[A-Fa-f0-9]{1,4}){1,6})|:(?:(?::[A-Fa-f0-9]{1,4}){1,7}|:))$/;

function normalizeIp(value: string | null | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;

  const normalized = value.trim().replace(/%.+$/, '');
  if (!normalized) return undefined;

  if (IPV4_REGEX.test(normalized) || IPV6_REGEX.test(normalized)) {
    return normalized;
  }

  return undefined;
}

function getRequestIp(req: NextRequest): string | undefined {
  return normalizeIp(req.ip);
}

function getForwardedIp(
  req: NextRequest,
  trustedProxyCount: number
): string | undefined {
  if (trustedProxyCount <= 0) return undefined;

  const xForwardedFor = req.headers.get('x-forwarded-for');
  if (!xForwardedFor) return undefined;

  const entries = xForwardedFor
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  const clientIndex = entries.length - trustedProxyCount - 1;
  if (clientIndex < 0) return undefined;

  return normalizeIp(entries[clientIndex]);
}

export function getClientIp(
  req: NextRequest,
  options: GetClientIpOptions = {}
): string {
  const requestIp = getRequestIp(req);
  const trustedProxyCount = Math.max(0, Math.trunc(options.trustedProxyCount ?? 0));
  const forwardedIp = getForwardedIp(req, trustedProxyCount);

  return forwardedIp ?? requestIp ?? 'anonymous';
}
