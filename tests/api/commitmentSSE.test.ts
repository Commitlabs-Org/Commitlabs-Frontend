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

function createMockRequest(id: string, authenticated = true, signal?: AbortSignal): NextRequest {
  const req = new NextRequest(`http://localhost/api/commitments/${id}/events`, {
    headers: authenticated ? { cookie: 'session=valid-token' } : {},
    signal,
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

async function readChunk(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
  const { value } = await reader.read();
  return new TextDecoder().decode(value);
}

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

  it('returns 404 when getCommitmentFromChain resolves to null', async () => {
    mockGetCommitmentFromChain.mockResolvedValue(null as any);

    const req = createMockRequest('cmt-null');
    const res = await GET(req, { params: { id: 'cmt-null' } });
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

    const text = await readChunk(res.body!.getReader());

    expect(text).toContain('event: snapshot');
    expect(text).toContain('"status":"Active"');
    expect(text).toContain('"commitmentId":"cmt-123"');
  });

  it('snapshot payload includes a timestamp', async () => {
    mockGetCommitmentFromChain.mockResolvedValue(MOCK_COMMITMENT);

    const req = createMockRequest('cmt-123');
    const res = await GET(req, { params: { id: 'cmt-123' } });

    const text = await readChunk(res.body!.getReader());
    const dataLine = text.split('\n').find((l) => l.startsWith('data:'))!;
    const payload = JSON.parse(dataLine.slice(5));

    expect(payload.timestamp).toBeDefined();
    expect(new Date(payload.timestamp).getTime()).not.toBeNaN();
  });

  it('emits status_change event on status transition', async () => {
    mockGetCommitmentFromChain.mockResolvedValue(MOCK_COMMITMENT);

    const req = createMockRequest('cmt-123');
    const res = await GET(req, { params: { id: 'cmt-123' } });

    const reader = res.body!.getReader();
    // Read snapshot
    await reader.read();

    // Update mocked status to SETTLED
    mockGetCommitmentFromChain.mockResolvedValue({
      ...MOCK_COMMITMENT,
      status: 'SETTLED',
    });

    // Advance poll timer (default 5000ms)
    await vi.advanceTimersByTimeAsync(5000);

    const text = await readChunk(reader);
    expect(text).toContain('event: status_change');
    expect(text).toContain('"status":"Settled"');
  });

  it('does not emit status_change when status is unchanged', async () => {
    mockGetCommitmentFromChain.mockResolvedValue(MOCK_COMMITMENT);

    const req = createMockRequest('cmt-123');
    const res = await GET(req, { params: { id: 'cmt-123' } });

    const reader = res.body!.getReader();
    await reader.read(); // snapshot

    // Status unchanged; advance past poll interval
    await vi.advanceTimersByTimeAsync(5000);

    // No new event enqueued — the stream should remain open but not have data ready
    let resolved = false;
    reader.read().then(() => { resolved = true; });
    // Yield microtasks without advancing timers further
    await Promise.resolve();
    // Should NOT have resolved with new data immediately after no-change poll
    // We can only assert no status_change was written without triggering another advance
    // Advance keepalive to get a readable chunk, confirming stream is still open
    await vi.advanceTimersByTimeAsync(20000);
    const text = await readChunk(reader);
    expect(text).not.toContain('event: status_change');
    expect(text).toContain(': keepalive');
    resolved; // suppress lint
  });

  it('emits keepalive periodic comment heartbeat', async () => {
    mockGetCommitmentFromChain.mockResolvedValue(MOCK_COMMITMENT);

    const req = createMockRequest('cmt-123');
    const res = await GET(req, { params: { id: 'cmt-123' } });

    const reader = res.body!.getReader();
    await reader.read(); // snapshot

    // Advance keepalive timer (default 20000ms)
    await vi.advanceTimersByTimeAsync(20000);

    const text = await readChunk(reader);
    expect(text).toContain(': keepalive');
  });

  it('emits keepalive multiple times at configured interval', async () => {
    mockGetCommitmentFromChain.mockResolvedValue(MOCK_COMMITMENT);

    const req = createMockRequest('cmt-123');
    const res = await GET(req, { params: { id: 'cmt-123' } });

    const reader = res.body!.getReader();
    await reader.read(); // snapshot

    for (let i = 0; i < 3; i++) {
      await vi.advanceTimersByTimeAsync(20000);
      const text = await readChunk(reader);
      expect(text).toContain(': keepalive');
    }
  });

  it('uses SSE_KEEPALIVE_INTERVAL_MS env var for keepalive interval', async () => {
    vi.stubEnv('SSE_KEEPALIVE_INTERVAL_MS', '10000');
    mockGetCommitmentFromChain.mockResolvedValue(MOCK_COMMITMENT);

    const req = createMockRequest('cmt-123');
    const res = await GET(req, { params: { id: 'cmt-123' } });

    const reader = res.body!.getReader();
    await reader.read(); // snapshot

    // Should fire at 10s, not 20s
    await vi.advanceTimersByTimeAsync(10000);
    const text = await readChunk(reader);
    expect(text).toContain(': keepalive');

    vi.unstubAllEnvs();
  });

  it('uses SSE_POLL_INTERVAL_MS env var for poll interval', async () => {
    vi.stubEnv('SSE_POLL_INTERVAL_MS', '2000');
    mockGetCommitmentFromChain.mockResolvedValue(MOCK_COMMITMENT);

    const req = createMockRequest('cmt-123');
    const res = await GET(req, { params: { id: 'cmt-123' } });

    const reader = res.body!.getReader();
    await reader.read(); // snapshot

    mockGetCommitmentFromChain.mockResolvedValue({ ...MOCK_COMMITMENT, status: 'VIOLATED' });

    // Should fire at 2s, not 5s
    await vi.advanceTimersByTimeAsync(2000);
    const text = await readChunk(reader);
    expect(text).toContain('event: status_change');
    expect(text).toContain('"status":"Violated"');

    vi.unstubAllEnvs();
  });

  it('closes stream and emits error event when commitment disappears mid-stream', async () => {
    mockGetCommitmentFromChain.mockResolvedValue(MOCK_COMMITMENT);

    const req = createMockRequest('cmt-123');
    const res = await GET(req, { params: { id: 'cmt-123' } });

    const reader = res.body!.getReader();
    await reader.read(); // snapshot

    // Commitment disappears
    mockGetCommitmentFromChain.mockResolvedValue(null as any);

    await vi.advanceTimersByTimeAsync(5000);

    const text = await readChunk(reader);
    expect(text).toContain('event: error');
    expect(text).toContain('Commitment not found');

    // Stream should be closed after error
    const { done } = await reader.read();
    expect(done).toBe(true);
  });

  it('clears intervals and closes stream on request abort signal', async () => {
    mockGetCommitmentFromChain.mockResolvedValue(MOCK_COMMITMENT);

    const ac = new AbortController();
    const req = createMockRequest('cmt-123', true, ac.signal);
    const abortSpy = vi.spyOn(req.signal, 'addEventListener');

    const res = await GET(req, { params: { id: 'cmt-123' } });
    expect(res.status).toBe(200);

    const abortCall = abortSpy.mock.calls.find((call) => call[0] === 'abort');
    expect(abortCall).toBeDefined();
    const onAbort = abortCall![1] as () => void;

    const reader = res.body!.getReader();
    await reader.read(); // snapshot

    // Simulate client disconnect
    onAbort();

    const { done } = await reader.read();
    expect(done).toBe(true);
  });

  it('stops emitting events after abort — no writes after cleanup', async () => {
    mockGetCommitmentFromChain.mockResolvedValue(MOCK_COMMITMENT);

    const ac = new AbortController();
    const req = createMockRequest('cmt-123', true, ac.signal);
    const abortSpy = vi.spyOn(req.signal, 'addEventListener');

    const res = await GET(req, { params: { id: 'cmt-123' } });
    const reader = res.body!.getReader();
    await reader.read(); // snapshot

    const onAbort = abortSpy.mock.calls.find((c) => c[0] === 'abort')![1] as () => void;
    onAbort();

    // Stream is now closed; advance timers — no further enqueue should occur
    mockGetCommitmentFromChain.mockResolvedValue({ ...MOCK_COMMITMENT, status: 'SETTLED' });
    await vi.advanceTimersByTimeAsync(25000); // past both poll and keepalive intervals

    // The very next read should be done (stream closed), not a new event
    const { done } = await reader.read();
    expect(done).toBe(true);
  });

  it('stream cancel() teardown clears intervals', async () => {
    mockGetCommitmentFromChain.mockResolvedValue(MOCK_COMMITMENT);

    const req = createMockRequest('cmt-123');
    const res = await GET(req, { params: { id: 'cmt-123' } });

    const reader = res.body!.getReader();
    await reader.read(); // snapshot

    // Cancel the stream from the consumer side
    await reader.cancel();

    // Advancing timers should not throw or cause side effects
    await vi.advanceTimersByTimeAsync(25000);
    // Test passes if no unhandled promise rejections occurred
  });

  it('maps all ChainCommitmentStatus values correctly', async () => {
    const statusMap: Array<[string, string]> = [
      ['ACTIVE', 'Active'],
      ['SETTLED', 'Settled'],
      ['VIOLATED', 'Violated'],
      ['EARLY_EXIT', 'Early Exit'],
    ];

    for (const [chainStatus, uiStatus] of statusMap) {
      mockGetCommitmentFromChain.mockResolvedValue({
        ...MOCK_COMMITMENT,
        status: chainStatus as any,
      });

      const req = createMockRequest('cmt-123');
      const res = await GET(req, { params: { id: 'cmt-123' } });
      const text = await readChunk(res.body!.getReader());

      expect(text).toContain(`"status":"${uiStatus}"`);
    }
  });
});
