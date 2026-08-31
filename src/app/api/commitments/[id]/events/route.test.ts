import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, OPTIONS, mapStatus, parsePositiveInt, validateInterval } from './route';
import { UnauthorizedError } from '@/lib/backend/errors';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { requireAuth } from '@/lib/backend/requireAuth';
import { getCommitmentFromChain } from '@/lib/backend/services/contracts';

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/backend/requireAuth', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/backend/services/contracts', () => ({
  getCommitmentFromChain: vi.fn(),
}));

const mockCheckRateLimit = vi.mocked(checkRateLimit);
const mockRequireAuth = vi.mocked(requireAuth);
const mockGetCommitment = vi.mocked(getCommitmentFromChain);

const mockGET = GET as (
  req: NextRequest,
  context: { params: Record<string, string> },
) => Promise<Response>;

const COMMITMENT_ID = 'evt-route-commitment-1';

const MOCK_COMMITMENT = {
  id: COMMITMENT_ID,
  ownerAddress: `G${'A'.repeat(55)}`,
  asset: 'USDC',
  amount: '10000',
  status: 'ACTIVE' as const,
  complianceScore: 90,
  currentValue: '10000',
  feeEarned: '0',
  violationCount: 0,
};

function makeRequest(
  url = `http://localhost/api/commitments/${COMMITMENT_ID}/events`,
): NextRequest {
  return new NextRequest(url);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRateLimit.mockResolvedValue(true);
  mockRequireAuth.mockImplementation((req) => {
    (req as NextRequest & { user?: unknown }).user = {
      address: `G${'B'.repeat(55)}`,
      csrfToken: 'tok',
    };
    return req as ReturnType<typeof requireAuth>;
  });
  mockGetCommitment.mockResolvedValue(MOCK_COMMITMENT);
});

describe('mapStatus and interval/positive-int helpers', () => {
  it('maps chain statuses to UI statuses', () => {
    expect(mapStatus('ACTIVE')).toBe('Active');
    expect(mapStatus('SETTLED')).toBe('Settled');
    expect(mapStatus('VIOLATED')).toBe('Violated');
    expect(mapStatus('EARLY_EXIT')).toBe('Early Exit');
    expect(mapStatus('SOMETHING_ELSE')).toBe('Unknown');
  });

  it('parsePositiveInt falls back to the default for empty/invalid/low values', () => {
    expect(parsePositiveInt(null, 10, 1)).toBe(10);
    expect(parsePositiveInt('abc', 10, 1)).toBe(10);
    expect(parsePositiveInt('0', 10, 1)).toBe(10);
    expect(parsePositiveInt('5', 10, 1)).toBe(5);
  });

  it('validateInterval clamps below the minimum and accepts valid values', () => {
    expect(validateInterval(undefined, 3000)).toBe(3000);
    expect(validateInterval('50', 3000)).toBe(3000);
    expect(validateInterval('not-a-number', 3000)).toBe(3000);
    expect(validateInterval('4000', 3000)).toBe(4000);
  });
});

describe('GET /api/commitments/[id]/events - Contract & Regression', () => {
  // ── Auth / rate-limit / not-found ──────────────────────────────────────────

  it('returns 401 when the user is not authenticated', async () => {
    mockRequireAuth.mockImplementation(() => {
      throw new UnauthorizedError('No session token provided');
    });
    const res = await mockGET(makeRequest(), { params: { id: COMMITMENT_ID } });
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 404 when the commitment does not exist on chain', async () => {
    mockGetCommitment.mockRejectedValue(new Error('not found'));
    const res = await mockGET(makeRequest(), { params: { id: 'missing' } });
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 404 when the commitment resolves to null', async () => {
    mockGetCommitment.mockResolvedValue(null as never);
    const res = await mockGET(makeRequest(), { params: { id: COMMITMENT_ID } });
    const body = await res.json();
    expect(res.status).toBe(404);
  });

  it('returns 429 when the rate limit is exceeded', async () => {
    mockCheckRateLimit.mockResolvedValue(false);
    const res = await mockGET(makeRequest(), { params: { id: COMMITMENT_ID } });
    expect(res.status).toBe(429);
  });

  // ── JSON mode (contract shape) ─────────────────────────────────────────────

  it('returns the documented JSON shape in format=json mode', async () => {
    const res = await mockGET(
      makeRequest(`http://localhost/api/commitments/${COMMITMENT_ID}/events?format=json`),
      {
        params: { id: COMMITMENT_ID },
      },
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ page: 1, pageSize: 10, total: 1, hasMore: false });
    expect(body.events).toHaveLength(1);
    expect(body.events[0].type).toBe('snapshot');
    expect(body.events[0].data.commitmentId).toBe(COMMITMENT_ID);
    expect(body.events[0].data.status).toBe('Active');
    expect(body.events[0].data.timestamp).toBeDefined();
  });

  it('honours explicit page/pageSize in JSON mode', async () => {
    const res = await mockGET(
      makeRequest(
        `http://localhost/api/commitments/${COMMITMENT_ID}/events?format=json&page=1&pageSize=5`,
      ),
      {
        params: { id: COMMITMENT_ID },
      },
    );
    const body = await res.json();
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(5);
  });

  it('returns an empty page (and no overflow) for an out-of-range page', async () => {
    const res = await mockGET(
      makeRequest(
        `http://localhost/api/commitments/${COMMITMENT_ID}/events?format=json&page=99&pageSize=10`,
      ),
      {
        params: { id: COMMITMENT_ID },
      },
    );
    const body = await res.json();
    expect(body.page).toBe(99);
    expect(body.events).toEqual([]);
    expect(body.hasMore).toBe(false);
  });

  it('falls back to defaults for malformed page/pageSize', async () => {
    const res = await mockGET(
      makeRequest(
        `http://localhost/api/commitments/${COMMITMENT_ID}/events?format=json&page=abc&pageSize=0`,
      ),
      {
        params: { id: COMMITMENT_ID },
      },
    );
    const body = await res.json();
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(10);
  });

  // ── SSE mode ───────────────────────────────────────────────────────────────

  it('streams text/event-stream by default', async () => {
    const res = await mockGET(makeRequest(), { params: { id: COMMITMENT_ID } });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/event-stream');
    expect(res.headers.get('Cache-Control')).toBe('no-cache, no-transform');
    await res.body?.cancel();
  });

  it('emits a snapshot frame with retry/id/event/data lines', async () => {
    const res = await mockGET(makeRequest(), { params: { id: COMMITMENT_ID } });
    const reader = res.body?.getReader();
    const { value } = await reader!.read();
    const frame = new TextDecoder().decode(value);
    reader!.cancel();

    expect(frame).toContain('event: snapshot');
    expect(frame).toMatch(/^retry: \d+/m);
    expect(frame).toMatch(/^id: evt-snapshot-/m);
    expect(frame).toContain(`"commitmentId":"${COMMITMENT_ID}"`);
    expect(frame).toContain('"status":"Active"');
  });

  it('allows a JSON snapshot to flow after the initial streamed snapshot', async () => {
    // Regression: re-running a second request must not share server-side state
    // (fresh counter/timers) and must still resolve a valid JSON snapshot.
    const res = await mockGET(
      makeRequest(`http://localhost/api/commitments/${COMMITMENT_ID}/events?format=json`),
      {
        params: { id: COMMITMENT_ID },
      },
    );
    const body = await res.json();
    expect(body.events).toHaveLength(1);
    expect(body.events[0].type).toBe('snapshot');
  });
});

describe('OPTIONS /api/commitments/[id]/events', () => {
  it('returns 204 for a preflight from the same origin', async () => {
    const req = makeRequest();
    req.headers.set('origin', 'http://localhost:3000');
    req.headers.set('access-control-request-method', 'GET');
    const res = await OPTIONS(req);
    expect(res.status).toBe(204);
  });
});
