import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  GET,
  mapStatus,
  shouldEmitStatusTransition,
} from '@/app/api/commitments/[id]/events/route';

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn(),
}));

vi.mock('@/lib/backend/services/contracts', () => ({
  getCommitmentFromChain: vi.fn(),
}));

vi.mock('@/lib/backend/requireAuth', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/backend/withApiHandler', () => ({
  withApiHandler: <TArgs extends unknown[]>(handler: (...args: TArgs) => Promise<Response>) =>
    handler,
}));

import { checkRateLimit } from '@/lib/backend/rateLimit';
import { getCommitmentFromChain } from '@/lib/backend/services/contracts';

const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedGetCommitmentFromChain = vi.mocked(getCommitmentFromChain);

describe('commitment events status state machine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCheckRateLimit.mockResolvedValue(true);
    mockedGetCommitmentFromChain.mockResolvedValue({
      status: 'ACTIVE',
    } as Awaited<ReturnType<typeof getCommitmentFromChain>>);
  });

  it('normalizes and transitions status changes deterministically', () => {
    expect(mapStatus('ACTIVE')).toBe('Active');
    expect(mapStatus('SETTLED')).toBe('Settled');
    expect(mapStatus('VIOLATED')).toBe('Violated');
    expect(mapStatus('EARLY_EXIT')).toBe('Early Exit');
    expect(mapStatus('UNKNOWN')).toBe('Unknown');

    expect(shouldEmitStatusTransition('Active', 'Active')).toBe(false);
    expect(shouldEmitStatusTransition('Unknown', 'Unknown')).toBe(false);
    expect(shouldEmitStatusTransition('Active', 'Violated')).toBe(true);
    expect(shouldEmitStatusTransition('Violated', 'Settled')).toBe(true);
  });

  it('returns the stream with a snapshot payload and honors auth/rate-limit gates', async () => {
    const req = new NextRequest('http://localhost:3000/api/commitments/123/events');
    const response = await GET(req, { params: { id: '123' } } as Parameters<typeof GET>[1]);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/event-stream');

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const { value } = await reader.read();
    const text = value ? decoder.decode(value) : '';

    expect(text).toContain('event: snapshot');
    expect(text).toContain('"status":"Active"');

    await reader.cancel();
  });

  it('refuses requests when rate limits are exceeded', async () => {
    mockedCheckRateLimit.mockResolvedValue(false);
    const req = new NextRequest('http://localhost:3000/api/commitments/123/events');
    const response = await GET(req, { params: { id: '123' } } as Parameters<typeof GET>[1]);

    expect(response.status).toBe(429);
  });
});
