import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, getDaysRemaining } from './route';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/backend/services/contracts', () => ({
  getCommitmentFromChain: vi.fn(),
}));

import { getCommitmentFromChain } from '@/lib/backend/services/contracts';
import { checkRateLimit } from '@/lib/backend/rateLimit';

const mockGetCommitment = vi.mocked(getCommitmentFromChain);
const mockCheckRateLimit = vi.mocked(checkRateLimit);

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(id: string): [NextRequest, { params: Record<string, string> }] {
  const req = new NextRequest(`http://localhost/api/commitments/${id}/status`);
  return [req, { params: { id } }];
}

const MOCK_COMMITMENT = {
  id: 'commitment-123',
  ownerAddress: 'GBVFTZL5HIPT4PFQVTZVIWR77V7LWYCXU4CLYWWHHOEXB64XPG5LDMTU',
  asset: 'USDC',
  amount: '10000',
  status: 'ACTIVE' as const,
  complianceScore: 92,
  currentValue: '10500',
  feeEarned: '150',
  violationCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
};

// ── getDaysRemaining ──────────────────────────────────────────────────────────

describe('getDaysRemaining', () => {
  it('returns 0 for undefined', () => {
    expect(getDaysRemaining(undefined)).toBe(0);
  });

  it('returns 0 for empty string', () => {
    expect(getDaysRemaining('')).toBe(0);
  });

  it('returns 0 for invalid date string', () => {
    expect(getDaysRemaining('not-a-date')).toBe(0);
  });

  it('returns 0 for a past date', () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(getDaysRemaining(past)).toBe(0);
  });

  it('returns positive days for a future date', () => {
    const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    expect(getDaysRemaining(future)).toBeGreaterThan(0);
  });

  it('returns approximately 30 for 30 days in the future', () => {
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const days = getDaysRemaining(future);
    expect(days).toBeGreaterThanOrEqual(29);
    expect(days).toBeLessThanOrEqual(31);
  });
});

// ── GET handler ───────────────────────────────────────────────────────────────

describe('GET /api/commitments/[id]/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(true);
  });

  describe('200 - success', () => {
    it('returns status snapshot for a valid commitment', async () => {
      mockGetCommitment.mockResolvedValue(MOCK_COMMITMENT);
      const [req, ctx] = makeRequest('commitment-123');
      const res = await GET(req, ctx);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.commitmentId).toBe('commitment-123');
      expect(body.data.status).toBe('ACTIVE');
      expect(body.data.complianceScore).toBe(92);
      expect(body.data.currentValue).toBe('10500');
      expect(body.data.violationCount).toBe(0);
      expect(body.data.daysRemaining).toBeGreaterThan(0);
      expect(body.data.expiresAt).toBeDefined();
    });

    it('returns daysRemaining as 0 when commitment has no expiresAt', async () => {
      mockGetCommitment.mockResolvedValue({ ...MOCK_COMMITMENT, expiresAt: undefined });
      const [req, ctx] = makeRequest('commitment-123');
      const res = await GET(req, ctx);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.daysRemaining).toBe(0);
      expect(body.data.expiresAt).toBeNull();
    });

    it('returns daysRemaining as 0 for expired commitment', async () => {
      const expired = { ...MOCK_COMMITMENT, expiresAt: '2020-01-01T00:00:00.000Z' };
      mockGetCommitment.mockResolvedValue(expired);
      const [req, ctx] = makeRequest('commitment-123');
      const res = await GET(req, ctx);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.daysRemaining).toBe(0);
    });

    it('returns correct fields for a SETTLED commitment', async () => {
      mockGetCommitment.mockResolvedValue({ ...MOCK_COMMITMENT, status: 'SETTLED' });
      const [req, ctx] = makeRequest('commitment-123');
      const res = await GET(req, ctx);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.status).toBe('SETTLED');
    });
  });

  describe('404 - not found', () => {
    it('returns 404 when commitment does not exist', async () => {
      mockGetCommitment.mockRejectedValue(new Error('Not found'));
      const [req, ctx] = makeRequest('nonexistent-id');
      const res = await GET(req, ctx);

      expect(res.status).toBe(404);
    });

    it('returns 404 when commitment id is empty string', async () => {
      mockGetCommitment.mockRejectedValue(new Error('Not found'));
      const [req, ctx] = makeRequest('');
      ctx.params.id = '';
      const res = await GET(req, ctx);

      expect(res.status).toBe(404);
    });
  });

  describe('429 - rate limit', () => {
    it('returns 429 when rate limit is exceeded', async () => {
      mockCheckRateLimit.mockResolvedValue(false);
      const [req, ctx] = makeRequest('commitment-123');
      const res = await GET(req, ctx);

      expect(res.status).toBe(429);
    });
  });
});