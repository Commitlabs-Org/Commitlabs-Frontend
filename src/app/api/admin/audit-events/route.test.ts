import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from './route';
import { NextRequest } from 'next/server';
import * as auditLog from '@/lib/backend/auditLog';
import * as rateLimit from '@/lib/backend/rateLimit';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn(),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ADMIN_SECRET = 'test-admin-secret-12345';

function makeRequest(params: Record<string, string> = {}, token?: string): NextRequest {
  const url = new URL('http://localhost:3000/api/admin/audit-events');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const headers: Record<string, string> = {};
  if (token) {
    headers['authorization'] = `Bearer ${token}`;
  }
  return new NextRequest(url.toString(), { method: 'GET', headers });
}

const MOCK_EVENTS: auditLog.RedactedAuditEvent[] = [
  {
    id: 'evt-003',
    timestamp: '2026-04-24T12:00:00Z',
    category: 'commitment',
    action: 'commitment.created',
    severity: 'info',
    actor: '[REDACTED]',
    ip: '[REDACTED]',
    resourceId: 'CMT-003',
  },
  {
    id: 'evt-002',
    timestamp: '2026-04-23T12:00:00Z',
    category: 'attestation',
    action: 'attestation.recorded',
    severity: 'info',
    actor: '[REDACTED]',
    ip: '[REDACTED]',
    resourceId: 'ATT-002',
  },
  {
    id: 'evt-001',
    timestamp: '2026-04-22T12:00:00Z',
    category: 'auth',
    action: 'auth.login',
    severity: 'info',
    actor: '[REDACTED]',
    ip: '[REDACTED]',
  },
];

// ─── GET /api/admin/audit-events — feature disabled ──────────────────────────

describe('GET /api/admin/audit-events — feature disabled', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    originalEnv = process.env.COMMITLABS_FEATURE_AUDIT_LOG;
    delete process.env.COMMITLABS_FEATURE_AUDIT_LOG;
    process.env.COMMITLABS_ADMIN_SECRET = ADMIN_SECRET;
    vi.mocked(rateLimit.checkRateLimit).mockResolvedValue(true);
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.COMMITLABS_FEATURE_AUDIT_LOG = originalEnv;
    } else {
      delete process.env.COMMITLABS_FEATURE_AUDIT_LOG;
    }
    delete process.env.COMMITLABS_ADMIN_SECRET;
  });

  it('returns 403 when feature flag is disabled', async () => {
    const req = makeRequest({}, ADMIN_SECRET);
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
    expect(body.error.message).toMatch(/disabled/i);
  });

  it('returns 403 even with valid admin token when disabled', async () => {
    const req = makeRequest({}, ADMIN_SECRET);
    const res = await GET(req, { params: {} });

    expect(res.status).toBe(403);
  });
});

// ─── GET /api/admin/audit-events — unauthorized ──────────────────────────────

describe('GET /api/admin/audit-events — unauthorized', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    originalEnv = process.env.COMMITLABS_FEATURE_AUDIT_LOG;
    process.env.COMMITLABS_FEATURE_AUDIT_LOG = 'true';
    process.env.COMMITLABS_ADMIN_SECRET = ADMIN_SECRET;
    vi.mocked(rateLimit.checkRateLimit).mockResolvedValue(true);
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.COMMITLABS_FEATURE_AUDIT_LOG = originalEnv;
    } else {
      delete process.env.COMMITLABS_FEATURE_AUDIT_LOG;
    }
    delete process.env.COMMITLABS_ADMIN_SECRET;
  });

  it('returns 403 when Authorization header is missing', async () => {
    const req = makeRequest();
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
    expect(body.error.message).toMatch(/admin token/i);
  });

  it('returns 403 when Authorization header is malformed (no Bearer prefix)', async () => {
    const url = new URL('http://localhost:3000/api/admin/audit-events');
    const req = new NextRequest(url.toString(), {
      method: 'GET',
      headers: { authorization: `Token ${ADMIN_SECRET}` },
    });

    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('returns 403 when admin token is incorrect', async () => {
    const req = makeRequest({}, 'wrong-token');
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('returns 403 when admin token is an empty string', async () => {
    const req = makeRequest({}, '');
    const res = await GET(req, { params: {} });

    expect(res.status).toBe(403);
  });

  it('returns 403 when COMMITLABS_ADMIN_SECRET is not configured', async () => {
    delete process.env.COMMITLABS_ADMIN_SECRET;

    const req = makeRequest({}, ADMIN_SECRET);
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.message).toMatch(/not configured/i);
  });
});

// ─── GET /api/admin/audit-events — authorized ────────────────────────────────

describe('GET /api/admin/audit-events — authorized', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    originalEnv = process.env.COMMITLABS_FEATURE_AUDIT_LOG;
    process.env.COMMITLABS_FEATURE_AUDIT_LOG = 'true';
    process.env.COMMITLABS_ADMIN_SECRET = ADMIN_SECRET;
    vi.mocked(rateLimit.checkRateLimit).mockResolvedValue(true);
    auditLog.resetAuditStoreForTests();

    vi.spyOn(auditLog, 'getRecentAuditEvents').mockResolvedValue(MOCK_EVENTS);
    vi.spyOn(auditLog, 'getAuditEventCount').mockResolvedValue(3);
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.COMMITLABS_FEATURE_AUDIT_LOG = originalEnv;
    } else {
      delete process.env.COMMITLABS_FEATURE_AUDIT_LOG;
    }
    delete process.env.COMMITLABS_ADMIN_SECRET;
    vi.restoreAllMocks();
  });

  it('returns 200 with redacted events when authorized', async () => {
    const req = makeRequest({}, ADMIN_SECRET);
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.events).toEqual(MOCK_EVENTS);
    expect(body.data.total).toBe(3);
  });

  it('returns meta.limit equal to the resolved limit', async () => {
    const req = makeRequest({}, ADMIN_SECRET);
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(body.meta.limit).toBe(50); // default
  });

  it('respects a custom limit', async () => {
    const req = makeRequest({ limit: '10' }, ADMIN_SECRET);
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta.limit).toBe(10);
    expect(auditLog.getRecentAuditEvents).toHaveBeenCalledWith(10);
  });

  it('returns empty array when no events exist', async () => {
    vi.mocked(auditLog.getRecentAuditEvents).mockResolvedValue([]);
    vi.mocked(auditLog.getAuditEventCount).mockResolvedValue(0);

    const req = makeRequest({}, ADMIN_SECRET);
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.events).toEqual([]);
    expect(body.data.total).toBe(0);
  });

  it('accepts limit=1 (minimum boundary)', async () => {
    const req = makeRequest({ limit: '1' }, ADMIN_SECRET);
    const res = await GET(req, { params: {} });

    expect(res.status).toBe(200);
    expect(auditLog.getRecentAuditEvents).toHaveBeenCalledWith(1);
  });

  it('accepts limit=200 (maximum boundary)', async () => {
    const req = makeRequest({ limit: '200' }, ADMIN_SECRET);
    const res = await GET(req, { params: {} });

    expect(res.status).toBe(200);
    expect(auditLog.getRecentAuditEvents).toHaveBeenCalledWith(200);
  });

  it('ensures all events have actor and ip redacted', async () => {
    const req = makeRequest({}, ADMIN_SECRET);
    const res = await GET(req, { params: {} });
    const body = await res.json();

    for (const event of body.data.events) {
      expect(event.actor).toBe('[REDACTED]');
      expect(event.ip).toBe('[REDACTED]');
    }
  });
});

// ─── GET /api/admin/audit-events — limit validation ──────────────────────────

describe('GET /api/admin/audit-events — limit validation', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    originalEnv = process.env.COMMITLABS_FEATURE_AUDIT_LOG;
    process.env.COMMITLABS_FEATURE_AUDIT_LOG = 'true';
    process.env.COMMITLABS_ADMIN_SECRET = ADMIN_SECRET;
    vi.mocked(rateLimit.checkRateLimit).mockResolvedValue(true);
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.COMMITLABS_FEATURE_AUDIT_LOG = originalEnv;
    } else {
      delete process.env.COMMITLABS_FEATURE_AUDIT_LOG;
    }
    delete process.env.COMMITLABS_ADMIN_SECRET;
  });

  it('returns 400 when limit is 0 (below minimum)', async () => {
    const req = makeRequest({ limit: '0' }, ADMIN_SECRET);
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toMatch(/limit/);
  });

  it('returns 400 when limit is negative', async () => {
    const req = makeRequest({ limit: '-5' }, ADMIN_SECRET);
    const res = await GET(req, { params: {} });

    expect(res.status).toBe(400);
  });

  it('returns 400 when limit exceeds 200', async () => {
    const req = makeRequest({ limit: '201' }, ADMIN_SECRET);
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.message).toMatch(/200/);
  });

  it('returns 400 when limit is a non-numeric string', async () => {
    const req = makeRequest({ limit: 'abc' }, ADMIN_SECRET);
    const res = await GET(req, { params: {} });

    expect(res.status).toBe(400);
  });

  it('returns 400 when limit is a float', async () => {
    const req = makeRequest({ limit: '2.5' }, ADMIN_SECRET);
    const res = await GET(req, { params: {} });

    expect(res.status).toBe(400);
  });
});

// ─── GET /api/admin/audit-events — rate limiting ─────────────────────────────

describe('GET /api/admin/audit-events — rate limiting', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    originalEnv = process.env.COMMITLABS_FEATURE_AUDIT_LOG;
    process.env.COMMITLABS_FEATURE_AUDIT_LOG = 'true';
    process.env.COMMITLABS_ADMIN_SECRET = ADMIN_SECRET;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.COMMITLABS_FEATURE_AUDIT_LOG = originalEnv;
    } else {
      delete process.env.COMMITLABS_FEATURE_AUDIT_LOG;
    }
    delete process.env.COMMITLABS_ADMIN_SECRET;
  });

  it('returns 429 when rate limit is exceeded', async () => {
    vi.mocked(rateLimit.checkRateLimit).mockResolvedValue(false);

    const req = makeRequest({}, ADMIN_SECRET);
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('calls checkRateLimit with the correct routeId', async () => {
    vi.mocked(rateLimit.checkRateLimit).mockResolvedValue(true);
    vi.spyOn(auditLog, 'getRecentAuditEvents').mockResolvedValue([]);
    vi.spyOn(auditLog, 'getAuditEventCount').mockResolvedValue(0);

    const req = makeRequest({}, ADMIN_SECRET);
    await GET(req, { params: {} });

    expect(rateLimit.checkRateLimit).toHaveBeenCalledWith(
      expect.any(String),
      'api/admin/audit-events'
    );
  });
});
