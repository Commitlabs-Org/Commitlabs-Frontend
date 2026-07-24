import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { NextRequest } from 'next/server';
import * as mockDb from '@/lib/backend/mockDb';
import * as rateLimit from '@/lib/backend/rateLimit';
import type { Attestation } from '@/lib/types/domain';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/backend/mockDb', () => ({
  getMockData: vi.fn(),
}));

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn(),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const OWNER_A = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
const OWNER_B = 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';

/** Five attestations with distinct timestamps (newest first in this array). */
const ATTESTATIONS: Attestation[] = [
  {
    id: 'ATT-005',
    commitmentId: 'CMT-005',
    observedAt: '2026-04-24T10:00:00Z',
    details: { ownerAddress: OWNER_A },
  },
  {
    id: 'ATT-004',
    commitmentId: 'CMT-004',
    observedAt: '2026-04-23T10:00:00Z',
    details: { ownerAddress: OWNER_B },
  },
  {
    id: 'ATT-003',
    commitmentId: 'CMT-003',
    observedAt: '2026-04-22T10:00:00Z',
    details: { ownerAddress: OWNER_A },
  },
  {
    id: 'ATT-002',
    commitmentId: 'CMT-002',
    observedAt: '2026-04-21T10:00:00Z',
    details: { ownerAddress: OWNER_B },
  },
  {
    id: 'ATT-001',
    commitmentId: 'CMT-001',
    observedAt: '2026-04-20T10:00:00Z',
    details: { ownerAddress: OWNER_A },
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(params: Record<string, string> = {}, authToken?: string): NextRequest {
  const url = new URL('http://localhost:3000/api/attestations/recent');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const headers: Record<string, string> = {};
  if (authToken) {
    headers['authorization'] = `Bearer ${authToken}`;
  }
  return new NextRequest(url.toString(), { method: 'GET', headers });
}

// ─── GET /api/attestations/recent — happy paths ───────────────────────────────

describe('GET /api/attestations/recent — happy paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rateLimit.checkRateLimit).mockResolvedValue(true);
    vi.mocked(mockDb.getMockData).mockResolvedValue({
      commitments: [],
      attestations: ATTESTATIONS,
      listings: [],
    });
  });

  it('returns 200 with attestations sorted newest-first (default pageSize=10)', async () => {
    const req = makeRequest();
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.attestations).toHaveLength(5);
    // Verify descending order
    expect(body.data.attestations[0].id).toBe('ATT-005');
    expect(body.data.attestations[4].id).toBe('ATT-001');
  });

  it('returns full pagination meta on default request', async () => {
    const req = makeRequest();
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(body.meta).toMatchObject({
      page: 1,
      pageSize: 10,
      total: 5,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    });
  });

  it('returns data.total equal to the total number of matching attestations', async () => {
    const req = makeRequest();
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(body.data.total).toBe(5);
  });

  it('respects a custom pageSize and slices correctly', async () => {
    const req = makeRequest({ pageSize: '2' });
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.attestations).toHaveLength(2);
    expect(body.data.attestations[0].id).toBe('ATT-005');
    expect(body.data.attestations[1].id).toBe('ATT-004');
    // total reflects unsliced count
    expect(body.data.total).toBe(5);
    expect(body.meta.pageSize).toBe(2);
  });

  it('returns all attestations when pageSize exceeds available count', async () => {
    const req = makeRequest({ pageSize: '100' });
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.attestations).toHaveLength(5);
  });

  it('returns empty array when mockDb has no attestations', async () => {
    vi.mocked(mockDb.getMockData).mockResolvedValue({
      commitments: [],
      attestations: [],
      listings: [],
    });

    const req = makeRequest();
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.attestations).toEqual([]);
    expect(body.data.total).toBe(0);
  });

  it('accepts pageSize=1 (minimum boundary)', async () => {
    const req = makeRequest({ pageSize: '1' });
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.attestations).toHaveLength(1);
    expect(body.data.attestations[0].id).toBe('ATT-005');
  });

  it('accepts pageSize=100 (maximum boundary)', async () => {
    const req = makeRequest({ pageSize: '100' });
    const res = await GET(req, { params: {} });

    expect(res.status).toBe(200);
  });
});

// ─── GET /api/attestations/recent — pagination ────────────────────────────────

describe('GET /api/attestations/recent — pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rateLimit.checkRateLimit).mockResolvedValue(true);
    vi.mocked(mockDb.getMockData).mockResolvedValue({
      commitments: [],
      attestations: ATTESTATIONS,
      listings: [],
    });
  });

  it('returns page 2 results with correct items', async () => {
    const req = makeRequest({ page: '2', pageSize: '2' });
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.attestations).toHaveLength(2);
    expect(body.data.attestations[0].id).toBe('ATT-003');
    expect(body.data.attestations[1].id).toBe('ATT-002');
  });

  it('hasNextPage is true when more pages exist', async () => {
    const req = makeRequest({ page: '1', pageSize: '2' });
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(body.meta.hasNextPage).toBe(true);
    expect(body.meta.hasPrevPage).toBe(false);
  });

  it('hasPrevPage is true on page > 1', async () => {
    const req = makeRequest({ page: '2', pageSize: '2' });
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(body.meta.hasPrevPage).toBe(true);
  });

  it('hasNextPage is false on the last page', async () => {
    // 5 items, pageSize=2 → 3 pages; page 3 is last
    const req = makeRequest({ page: '3', pageSize: '2' });
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(body.meta.hasNextPage).toBe(false);
    expect(body.meta.hasPrevPage).toBe(true);
    expect(body.data.attestations).toHaveLength(1);
    expect(body.data.attestations[0].id).toBe('ATT-001');
  });

  it('reports correct totalPages', async () => {
    const req = makeRequest({ pageSize: '2' });
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(body.meta.totalPages).toBe(3);
  });

  it('returns empty attestations array when page exceeds totalPages', async () => {
    const req = makeRequest({ page: '99', pageSize: '10' });
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.attestations).toEqual([]);
    expect(body.data.total).toBe(5);
    expect(body.meta.page).toBe(99);
  });

  it('meta.total reflects total matching items, not page size', async () => {
    const req = makeRequest({ pageSize: '2' });
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(body.meta.total).toBe(5);
    expect(body.data.attestations).toHaveLength(2);
  });
});

// ─── GET /api/attestations/recent — ordering ─────────────────────────────────

describe('GET /api/attestations/recent — ordering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rateLimit.checkRateLimit).mockResolvedValue(true);
  });

  it('sorts attestations by observedAt descending regardless of input order', async () => {
    // Provide attestations in ascending order
    const unordered: Attestation[] = [
      { id: 'ATT-A', commitmentId: 'CMT-A', observedAt: '2026-01-01T00:00:00Z' },
      { id: 'ATT-C', commitmentId: 'CMT-C', observedAt: '2026-03-01T00:00:00Z' },
      { id: 'ATT-B', commitmentId: 'CMT-B', observedAt: '2026-02-01T00:00:00Z' },
    ];
    vi.mocked(mockDb.getMockData).mockResolvedValue({
      commitments: [],
      attestations: unordered,
      listings: [],
    });

    const req = makeRequest();
    const res = await GET(req, { params: {} });
    const body = await res.json();

    const ids = body.data.attestations.map((a: Attestation) => a.id);
    expect(ids).toEqual(['ATT-C', 'ATT-B', 'ATT-A']);
  });

  it('places attestations without observedAt at the end', async () => {
    const mixed: Attestation[] = [
      { id: 'ATT-DATED', commitmentId: 'CMT-1', observedAt: '2026-01-15T00:00:00Z' },
      { id: 'ATT-NO-DATE', commitmentId: 'CMT-2', observedAt: '' },
    ];
    vi.mocked(mockDb.getMockData).mockResolvedValue({
      commitments: [],
      attestations: mixed,
      listings: [],
    });

    const req = makeRequest();
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(body.data.attestations[0].id).toBe('ATT-DATED');
    expect(body.data.attestations[1].id).toBe('ATT-NO-DATE');
  });
});

// ─── GET /api/attestations/recent — ownerAddress filter ──────────────────────

describe('GET /api/attestations/recent — ownerAddress filter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rateLimit.checkRateLimit).mockResolvedValue(true);
    vi.mocked(mockDb.getMockData).mockResolvedValue({
      commitments: [],
      attestations: ATTESTATIONS,
      listings: [],
    });
  });

  it('filters attestations by ownerAddress when authenticated', async () => {
    const req = makeRequest({ ownerAddress: OWNER_A }, 'valid-token');
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(200);
    // OWNER_A has ATT-005, ATT-003, ATT-001
    expect(body.data.attestations).toHaveLength(3);
    expect(body.data.total).toBe(3);
    for (const att of body.data.attestations) {
      expect(att.details.ownerAddress).toBe(OWNER_A);
    }
  });

  it('filters are case-insensitive for ownerAddress', async () => {
    const req = makeRequest({ ownerAddress: OWNER_A.toLowerCase() }, 'valid-token');
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.attestations).toHaveLength(3);
  });

  it('returns empty array when no attestations match ownerAddress', async () => {
    const req = makeRequest({ ownerAddress: 'GNONEXISTENT' }, 'valid-token');
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.attestations).toEqual([]);
    expect(body.data.total).toBe(0);
  });

  it('applies pageSize after ownerAddress filter', async () => {
    const req = makeRequest({ ownerAddress: OWNER_A, pageSize: '1' }, 'valid-token');
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.attestations).toHaveLength(1);
    // Most recent OWNER_A attestation
    expect(body.data.attestations[0].id).toBe('ATT-005');
    // total still reflects all matching, not sliced
    expect(body.data.total).toBe(3);
  });

  it('returns 401 when ownerAddress is provided without auth token', async () => {
    const req = makeRequest({ ownerAddress: OWNER_A });
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when Authorization header is malformed (no Bearer prefix)', async () => {
    const url = new URL('http://localhost:3000/api/attestations/recent');
    url.searchParams.set('ownerAddress', OWNER_A);
    const req = new NextRequest(url.toString(), {
      method: 'GET',
      headers: { authorization: 'Token abc123' },
    });

    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('does NOT require auth when ownerAddress is absent', async () => {
    const req = makeRequest(); // no auth header, no ownerAddress
    const res = await GET(req, { params: {} });

    expect(res.status).toBe(200);
  });
});

// ─── GET /api/attestations/recent — page and pageSize validation ──────────────

describe('GET /api/attestations/recent — page and pageSize validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rateLimit.checkRateLimit).mockResolvedValue(true);
    vi.mocked(mockDb.getMockData).mockResolvedValue({
      commitments: [],
      attestations: ATTESTATIONS,
      listings: [],
    });
  });

  it('returns 400 when pageSize is 0 (below minimum)', async () => {
    const req = makeRequest({ pageSize: '0' });
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when pageSize is negative', async () => {
    const req = makeRequest({ pageSize: '-5' });
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when pageSize exceeds 100', async () => {
    const req = makeRequest({ pageSize: '101' });
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toMatch(/100/);
  });

  it('returns 400 when pageSize is a non-numeric string', async () => {
    const req = makeRequest({ pageSize: 'abc' });
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when page is 0 (below minimum)', async () => {
    const req = makeRequest({ page: '0' });
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when page is negative', async () => {
    const req = makeRequest({ page: '-1' });
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when page is a non-numeric string', async () => {
    const req = makeRequest({ page: 'first' });
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when ownerAddress is an empty string', async () => {
    const req = makeRequest({ ownerAddress: '   ' }, 'valid-token');
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toMatch(/ownerAddress/);
  });
});

// ─── GET /api/attestations/recent — rate limiting ────────────────────────────

describe('GET /api/attestations/recent — rate limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 429 when rate limit is exceeded', async () => {
    vi.mocked(rateLimit.checkRateLimit).mockResolvedValue(false);

    const req = makeRequest();
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('calls checkRateLimit with the correct routeId', async () => {
    vi.mocked(rateLimit.checkRateLimit).mockResolvedValue(true);
    vi.mocked(mockDb.getMockData).mockResolvedValue({
      commitments: [],
      attestations: [],
      listings: [],
    });

    const req = makeRequest();
    await GET(req, { params: {} });

    expect(rateLimit.checkRateLimit).toHaveBeenCalledWith(
      expect.any(String),
      'api/attestations/recent'
    );
  });
});
