import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, OPTIONS, mapStatus } from './route';

vi.mock('@/lib/backend/requireAuth', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/backend/services/contracts', () => ({
  getCommitmentFromChain: vi.fn(),
}));

import { requireAuth } from '@/lib/backend/requireAuth';
import { getCommitmentFromChain } from '@/lib/backend/services/contracts';

const mockedRequireAuth = vi.mocked(requireAuth);
const mockedGetCommitment = vi.mocked(getCommitmentFromChain);

function makeRequest(id: string, init?: RequestInit): NextRequest {
  return new NextRequest(`http://localhost/api/commitments/${id}/events`, init);
}

async function readChunk(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
  const result = await reader.read();
  if (result.done) {
    throw new Error('Stream ended unexpectedly');
  }

  return new TextDecoder().decode(result.value);
}

const baseCommitment = {
  id: 'cmt-123',
  ownerAddress: 'GOWNER123456789',
  asset: 'USDC',
  amount: '10000',
  status: 'ACTIVE' as const,
  complianceScore: 90,
  currentValue: '10000',
  feeEarned: '0',
  violationCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('commitment events SSE route', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    vi.clearAllMocks();
    mockedRequireAuth.mockImplementation(() => undefined as never);
    mockedGetCommitment.mockResolvedValue(baseCommitment as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ['ACTIVE', 'Active'],
    ['SETTLED', 'Settled'],
    ['VIOLATED', 'Violated'],
    ['EARLY_EXIT', 'Early Exit'],
    ['CREATED', 'Unknown'],
    ['DISPUTED', 'Unknown'],
    ['UNKNOWN', 'Unknown'],
  ] as const)('maps %s to %s', (status, expected) => {
    expect(mapStatus(status)).toBe(expected);
  });

  it('returns 404 when the commitment cannot be resolved', async () => {
    mockedGetCommitment.mockRejectedValueOnce(new Error('missing commitment'));

    const req = makeRequest('missing');
    const res = await GET(req, { params: { id: 'missing' } });

    expect(res.status).toBe(404);
  });

  it('returns SSE headers and emits the initial snapshot event', async () => {
    const req = makeRequest('cmt-123');
    const res = await GET(req, { params: { id: 'cmt-123' } });
    const reader = res.body?.getReader();

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    expect(res.headers.get('cache-control')).toContain('no-cache');

    expect(reader).toBeDefined();
    const event = await readChunk(reader!);
    expect(event).toContain('event: snapshot');
    expect(event).toContain('"status":"Active"');
  });

  it('sends keepalive comments on the heartbeat interval', async () => {
    const req = makeRequest('cmt-123');
    const res = await GET(req, { params: { id: 'cmt-123' } });
    const reader = res.body?.getReader();

    await readChunk(reader!);

    await vi.advanceTimersByTimeAsync(20000);

    const keepaliveEvent = await readChunk(reader!);
    expect(keepaliveEvent).toContain(': keepalive');
  });

  it('emits a status change event when the commitment status changes on poll', async () => {
    mockedGetCommitment
      .mockResolvedValueOnce(baseCommitment as never)
      .mockResolvedValueOnce({ ...baseCommitment, status: 'SETTLED' } as never);

    const req = makeRequest('cmt-123');
    const res = await GET(req, { params: { id: 'cmt-123' } });
    const reader = res.body?.getReader();

    await readChunk(reader!);

    await vi.advanceTimersByTimeAsync(5000);

    const statusChangeEvent = await readChunk(reader!);
    expect(statusChangeEvent).toContain('event: status_change');
    expect(statusChangeEvent).toContain('"status":"Settled"');
  });

  it('closes the stream when the client aborts the request', async () => {
    const controller = new AbortController();
    const req = makeRequest('cmt-123', { signal: controller.signal });
    const res = await GET(req, { params: { id: 'cmt-123' } });
    const reader = res.body?.getReader();

    await readChunk(reader!);

    controller.abort();

    await expect(reader!.closed).resolves.toBeUndefined();
  });

  it('returns CORS preflight headers for GET events requests', async () => {
    const req = makeRequest('cmt-123', {
      method: 'OPTIONS',
      headers: {
        origin: 'http://localhost:3000',
        'access-control-request-method': 'GET',
      },
    });

    const res = await OPTIONS(req);

    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
    expect(res.headers.get('access-control-allow-methods')).toContain('GET');
    expect(res.headers.get('access-control-allow-methods')).toContain('OPTIONS');
  });
});
