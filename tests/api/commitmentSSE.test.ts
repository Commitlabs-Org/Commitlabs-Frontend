import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/commitments/[id]/events/route';
import { verifySessionToken } from '@/lib/backend/auth';
import { getCommitmentFromChain } from '@/lib/backend/services/contracts';

vi.mock('@/lib/backend/auth', () => ({
  verifySessionToken: vi.fn(),
}));

vi.mock('@/lib/backend/services/contracts', () => ({
  getCommitmentFromChain: vi.fn(),
}));

const mockVerifySessionToken = vi.mocked(verifySessionToken);
const mockGetCommitmentFromChain = vi.mocked(getCommitmentFromChain);

function createMockRequest(id: string, authenticated = true): NextRequest {
  const req = new NextRequest(`http://localhost/api/commitments/${id}/events`, {
    headers: authenticated ? { cookie: 'session=valid-token' } : {},
  });
  return req;
}

const MOCK_COMMITMENT = {
  id: 'cmt-123',
  ownerAddress: 'GBVFTZL5HIPT4PFQVTZVIWR77V7LWYCXU4CLYWWHHOEXB64XPG5LDMTU',
  asset: 'USDC',
  amount: '5000',
  status: 'ACTIVE' as const,
  complianceScore: 95,
  currentValue: '5100',
  feeEarned: '50',
  violationCount: 0,
};

describe('GET /api/commitments/[id]/events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockVerifySessionToken.mockReturnValue({ valid: true, address: '0x123', csrfToken: 'csrf' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 401 when request is not authenticated', async () => {
    const req = createMockRequest('cmt-123', false);
    const res = await GET(req, { params: { id: 'cmt-123' } });
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 404 when commitment does not exist', async () => {
    mockGetCommitmentFromChain.mockRejectedValue(new Error('Not found'));

    const req = createMockRequest('non-existent');
    const res = await GET(req, { params: { id: 'non-existent' } });
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 200 with event-stream headers on success', async () => {
    mockGetCommitmentFromChain.mockResolvedValue(MOCK_COMMITMENT);

    const req = createMockRequest('cmt-123');
    const res = await GET(req, { params: { id: 'cmt-123' } });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/event-stream');
    expect(res.headers.get('cache-control')).toBe('no-cache, no-transform');
    expect(res.headers.get('connection')).toBe('keep-alive');
  });

  it('emits snapshot event immediately on connection', async () => {
    mockGetCommitmentFromChain.mockResolvedValue(MOCK_COMMITMENT);

    const req = createMockRequest('cmt-123');
    const res = await GET(req, { params: { id: 'cmt-123' } });
    expect(res.status).toBe(200);

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();

    const { value } = await reader.read();
    const text = decoder.decode(value);

    expect(text).toContain('event: snapshot');
    expect(text).toContain('"status":"Active"');
    expect(text).toContain('"commitmentId":"cmt-123"');
  });

  it('emits status_change event on status transition', async () => {
    mockGetCommitmentFromChain.mockResolvedValue(MOCK_COMMITMENT);

    const req = createMockRequest('cmt-123');
    const res = await GET(req, { params: { id: 'cmt-123' } });

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();

    // Read snapshot
    await reader.read();

    // Update mocked status to SETTLED
    mockGetCommitmentFromChain.mockResolvedValue({
      ...MOCK_COMMITMENT,
      status: 'SETTLED',
    });

    // Advance poll timer (default 5000ms)
    await vi.advanceTimersByTimeAsync(5000);

    const { value } = await reader.read();
    const text = decoder.decode(value);

    expect(text).toContain('event: status_change');
    expect(text).toContain('"status":"Settled"');
  });

  it('emits keepalive periodic comment heartbeat', async () => {
    mockGetCommitmentFromChain.mockResolvedValue(MOCK_COMMITMENT);

    const req = createMockRequest('cmt-123');
    const res = await GET(req, { params: { id: 'cmt-123' } });

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();

    // Read snapshot
    await reader.read();

    // Advance keepalive timer (default 20000ms)
    await vi.advanceTimersByTimeAsync(20000);

    const { value } = await reader.read();
    const text = decoder.decode(value);

    expect(text).toContain(': keepalive');
  });

  it('clears intervals gracefully on request abort signal', async () => {
    mockGetCommitmentFromChain.mockResolvedValue(MOCK_COMMITMENT);

    const req = createMockRequest('cmt-123');
    const abortSpy = vi.spyOn(req.signal, 'addEventListener');

    const res = await GET(req, { params: { id: 'cmt-123' } });
    expect(res.status).toBe(200);

    // Get the abort callback
    const abortCall = abortSpy.mock.calls.find((call) => call[0] === 'abort');
    expect(abortCall).toBeDefined();
    const onAbort = abortCall![1] as () => void;

    const reader = res.body!.getReader();
    // Read snapshot first
    await reader.read();

    // Trigger abort
    onAbort();

    // Verify stream is done after abort
    const { done } = await reader.read();
    expect(done).toBe(true);
  });
});
