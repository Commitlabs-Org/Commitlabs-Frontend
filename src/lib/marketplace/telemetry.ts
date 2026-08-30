type MarketplaceTelemetryEvent = {
  event: string;
  feature?: string;
  operation?: string;
  outcome?: 'success' | 'failure' | 'recovered' | 'unknown';
  correlationId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  latencyMs?: number;
  errorCode?: string;
  message?: string;
  attempt?: number;
  maxAttempts?: number;
  recovered?: boolean;
  details?: Record<string, unknown>;
};

const SENSITIVE_KEYS = new Set([
  'authorization',
  'cookie',
  'x-api-key',
  'buyeraddress',
  'selleraddress',
  'privatekey',
  'mnemonic',
  'password',
  'secret',
  'token',
  'accesstoken',
  'refreshtoken',
  'apikey',
  'sessionid',
]);

const SENSITIVE_PATTERNS: RegExp[] = [
  /0x[a-fA-F0-9]{40}/g,
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  /AKIA[0-9A-Z]{16}/g,
];

function redactText(input: string): string {
  let result = input;
  for (const pattern of SENSITIVE_PATTERNS) {
    pattern.lastIndex = 0;
    result = result.replace(pattern, '[REDACTED]');
  }
  return result;
}

function redact(value: unknown, key = ''): unknown {
  if (typeof value === 'string') {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) return '[REDACTED]';
    return redactText(value);
  }
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        SENSITIVE_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : redact(v, k),
      ]),
    );
  }
  return value;
}

export function emitMarketplaceTelemetry(event: MarketplaceTelemetryEvent): void {
  const safeDetails = redact(event.details);
  const safeMessage = typeof event.message === 'string' ? redactText(event.message) : event.message;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    ...event,
    message: safeMessage,
    details: safeDetails,
  });
  const status = event.statusCode ?? 0;
  if (status >= 500) {
    console.error(line);
  } else if (status >= 400) {
    console.warn(line);
  } else {
    console.info(line);
  }
}