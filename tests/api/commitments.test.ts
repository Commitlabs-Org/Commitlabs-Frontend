import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/commitments/route';
import { createMockRequest, parseResponse } from './helpers';
import { __resetSessionStoreForTests, createBrowserSession, SESSION_COOKIE_NAME } from '@/lib/backend/session';
import { CSRF_HEADER_NAME } from '@/lib/backend/csrf';

vi.mock('@/lib/backend/services/contracts', () => ({
  getUserCommitmentsFromChain: vi.fn().mockResolvedValue([]),
  createCommitmentOnChain: vi.fn().mockResolvedValue({
    commitmentId: 'mock-1',
    ownerAddress: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    status: 'ACTIVE',
  }),
}));

const ORIGIN = 'http://localhost:3000';

const validPostBody = {
  ownerAddress: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  asset: 'USDC',
  amount: '100',
  durationDays: 30,
  maxLossBps: 100,
};

describe('GET /api/commitments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when ownerAddress is missing', async () => {
    const request = createMockRequest(`${ORIGIN}/api/commitments`);
    const response = await GET(request);
    const result = await parseResponse(response);
    expect(result.status).toBe(400);
    expect(result.data.success).toBe(false);
  });

  it('returns paginated items when ownerAddress is provided', async () => {
    const request = createMockRequest(
      `${ORIGIN}/api/commitments?ownerAddress=GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA&page=1&pageSize=10`,
    );
    const response = await GET(request);
    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    expect(result.data.success).toBe(true);
    expect(result.data.data).toMatchObject({
      items: [],
      page: 1,
      pageSize: 10,
      total: 0,
    });
  });
});

describe('POST /api/commitments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetSessionStoreForTests();
  });

  it('succeeds without CSRF when no session cookie is sent', async () => {
    const request = createMockRequest(`${ORIGIN}/api/commitments`, {
      method: 'POST',
      body: validPostBody,
      headers: { Origin: ORIGIN },
    });
    const response = await POST(request);
    const result = await parseResponse(response);
    expect(result.status).toBe(201);
    expect(result.data.success).toBe(true);
  });

  it('returns 403 when session cookie is present but CSRF header is missing', async () => {
    const { sessionId } = createBrowserSession();
    const request = createMockRequest(`${ORIGIN}/api/commitments`, {
      method: 'POST',
      body: validPostBody,
      headers: {
        Origin: ORIGIN,
        Cookie: `${SESSION_COOKIE_NAME}=${sessionId}`,
      },
    });
    const response = await POST(request);
    const result = await parseResponse(response);
    expect(result.status).toBe(403);
    expect(result.data.success).toBe(false);
    expect(result.data.error?.code).toBe('CSRF_INVALID');
  });

  it('returns 201 when session and CSRF header are valid', async () => {
    const { sessionId, csrfToken } = createBrowserSession();
    const request = createMockRequest(`${ORIGIN}/api/commitments`, {
      method: 'POST',
      body: validPostBody,
      headers: {
        Origin: ORIGIN,
        Cookie: `${SESSION_COOKIE_NAME}=${sessionId}`,
        [CSRF_HEADER_NAME]: csrfToken,
      },
    });
    const response = await POST(request);
    const result = await parseResponse(response);
    expect(result.status).toBe(201);
    expect(result.data.success).toBe(true);
  });
});
