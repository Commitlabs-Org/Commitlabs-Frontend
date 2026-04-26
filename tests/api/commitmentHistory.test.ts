import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockRequest, parseResponse } from './helpers';

// ---------------------------------------------------------------------------
// Shared mock data
// ---------------------------------------------------------------------------

const MOCK_COMMITMENT = {
  id: 'CMT-001',
  ownerAddress: 'GOWNER',
  asset: 'XLM',
  amount: '50000',
  status: 'ACTIVE' as const,
  complianceScore: 95,
  currentValue: '52000',
  feeEarned: '200',
  violationCount: 0,
  createdAt: '2026-01-10T00:00:00.000Z',
  expiresAt: '2026-03-10T00:00:00.000Z',
};

const MOCK_ATTESTATIONS = [
  {
    id: 'ATTR-001',
    commitmentId: 'CMT-001',
    kind: 'health_check',
    observedAt: '2026-01-11T12:00:00Z',
    txHash: '0xabc',
    severity: 'ok' as const,
    details: { complianceScore: 95, violation: false },
  },
  {
    id: 'ATTR-002',
    commitmentId: 'CMT-001',
    kind: 'fee_generation',
    observedAt: '2026-01-15T08:00:00Z',
    severity: 'ok' as const,
    details: { feeEarned: '100' },
  },
  {
    id: 'ATTR-OTHER',
    commitmentId: 'CMT-999', // different commitment — must be excluded
    kind: 'health_check',
    observedAt: '2026-01-12T00:00:00Z',
    severity: 'ok' as const,
    details: {},
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockDeps(
  commitment: typeof MOCK_COMMITMENT | null,
  attestations = MOCK_ATTESTATIONS,
) {
  vi.doMock('@/lib/backend/services/contracts', () => ({
    getCommitmentFromChain: commitment
      ? vi.fn().mockResolvedValue(commitment)
      : vi.fn().mockRejectedValue(new Error('not found')),
  }));

  vi.doMock('@/lib/backend/mockDb', () => ({
    getMockData: vi.fn().mockResolvedValue({
      commitments: [],
      attestations,
      listings: [],
    }),
  }));
}

function makeRequest(id: string, query = '') {
  return createMockRequest(
    `http://localhost:3000/api/commitments/${id}/history${query}`,
  );
}

async function callRoute(id: string, query = '') {
  const { GET } = await import('@/app/api/commitments/[id]/history/route');
  const req = makeRequest(id, query);
  const res = await GET(req, { params: { id } });
  return parseResponse(res);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/commitments/[id]/history', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
  });

  // ── 404 ──────────────────────────────────────────────────────────────────

  it('returns 404 when commitment does not exist', async () => {
    mockDeps(null);
    const result = await callRoute('CMT-MISSING');
    expect(result.status).toBe(404);
    expect(result.data.success).toBe(false);
    expect(result.data.error.code).toBe('NOT_FOUND');
  });

  // ── Empty history ─────────────────────────────────────────────────────────

  it('returns only a created event when there are no attestations', async () => {
    mockDeps(MOCK_COMMITMENT, []);
    const result = await callRoute('CMT-001');
    expect(result.status).toBe(200);
    const { events, meta } = result.data.data;
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('created');
    expect(meta.total).toBe(1);
  });

  // ── Full history ──────────────────────────────────────────────────────────

  it('returns created + attestation events in chronological order', async () => {
    mockDeps(MOCK_COMMITMENT);
    const result = await callRoute('CMT-001');
    expect(result.status).toBe(200);

    const { events } = result.data.data;
    // created (Jan 10) → attestation ATTR-001 (Jan 11) → attestation ATTR-002 (Jan 15)
    expect(events).toHaveLength(3);
    expect(events[0].kind).toBe('created');
    expect(events[1].kind).toBe('attestation');
    expect(events[2].kind).toBe('attestation');

    // Verify strict ascending order
    for (let i = 1; i < events.length; i++) {
      expect(new Date(events[i].occurredAt).getTime()).toBeGreaterThanOrEqual(
        new Date(events[i - 1].occurredAt).getTime(),
      );
    }
  });

  it('excludes attestations belonging to other commitments', async () => {
    mockDeps(MOCK_COMMITMENT);
    const result = await callRoute('CMT-001');
    const { events } = result.data.data;
    const attestationIds = events
      .filter((e: { kind: string }) => e.kind === 'attestation')
      .map((e: { payload: { attestationId: string } }) => e.payload.attestationId);
    expect(attestationIds).not.toContain('ATTR-OTHER');
  });

  // ── Event shapes ──────────────────────────────────────────────────────────

  it('created event has correct shape', async () => {
    mockDeps(MOCK_COMMITMENT, []);
    const result = await callRoute('CMT-001');
    const event = result.data.data.events[0];
    expect(event).toMatchObject({
      eventId: 'created:CMT-001',
      kind: 'created',
      occurredAt: MOCK_COMMITMENT.createdAt,
      payload: {
        asset: 'XLM',
        amount: '50000',
        expiresAt: MOCK_COMMITMENT.expiresAt,
      },
    });
  });

  it('attestation event has correct shape', async () => {
    mockDeps(MOCK_COMMITMENT, [MOCK_ATTESTATIONS[0]]);
    const result = await callRoute('CMT-001');
    const attnEvent = result.data.data.events.find(
      (e: { kind: string }) => e.kind === 'attestation',
    );
    expect(attnEvent).toMatchObject({
      eventId: 'attestation:ATTR-001',
      kind: 'attestation',
      occurredAt: '2026-01-11T12:00:00Z',
      txHash: '0xabc',
      payload: {
        attestationId: 'ATTR-001',
        attestationType: 'health_check',
        complianceScore: 95,
        violation: false,
      },
    });
  });

  // ── Terminal events ───────────────────────────────────────────────────────

  it('includes early_exit event when commitment status is EARLY_EXIT', async () => {
    mockDeps({ ...MOCK_COMMITMENT, status: 'EARLY_EXIT' as const }, []);
    const result = await callRoute('CMT-001');
    const { events } = result.data.data;
    const exitEvent = events.find((e: { kind: string }) => e.kind === 'early_exit');
    expect(exitEvent).toBeDefined();
    expect(exitEvent.eventId).toBe('early_exit:CMT-001');
    expect(exitEvent.payload.exitedBy).toBe(MOCK_COMMITMENT.ownerAddress);
  });

  it('includes settlement event when commitment status is SETTLED', async () => {
    mockDeps({ ...MOCK_COMMITMENT, status: 'SETTLED' as const }, []);
    const result = await callRoute('CMT-001');
    const { events } = result.data.data;
    const settlementEvent = events.find((e: { kind: string }) => e.kind === 'settlement');
    expect(settlementEvent).toBeDefined();
    expect(settlementEvent.eventId).toBe('settlement:CMT-001');
    expect(settlementEvent.payload.finalStatus).toBe('SETTLED');
  });

  it('does not include terminal event for ACTIVE commitment', async () => {
    mockDeps(MOCK_COMMITMENT, []);
    const result = await callRoute('CMT-001');
    const { events } = result.data.data;
    const terminal = events.filter(
      (e: { kind: string }) => e.kind === 'early_exit' || e.kind === 'settlement',
    );
    expect(terminal).toHaveLength(0);
  });

  // ── Ordering ──────────────────────────────────────────────────────────────

  it('orders events oldest-first regardless of insertion order', async () => {
    // Provide attestations in reverse chronological order
    const reversed = [...MOCK_ATTESTATIONS].reverse();
    mockDeps(MOCK_COMMITMENT, reversed);
    const result = await callRoute('CMT-001');
    const { events } = result.data.data;
    for (let i = 1; i < events.length; i++) {
      expect(new Date(events[i].occurredAt).getTime()).toBeGreaterThanOrEqual(
        new Date(events[i - 1].occurredAt).getTime(),
      );
    }
  });

  // ── Pagination ────────────────────────────────────────────────────────────

  it('paginates results with page and pageSize params', async () => {
    mockDeps(MOCK_COMMITMENT);
    const result = await callRoute('CMT-001', '?page=1&pageSize=2');
    expect(result.status).toBe(200);
    const { events, meta } = result.data.data;
    expect(events).toHaveLength(2);
    expect(meta.page).toBe(1);
    expect(meta.pageSize).toBe(2);
    expect(meta.total).toBe(3); // created + 2 attestations
    expect(meta.hasNextPage).toBe(true);
    expect(meta.hasPrevPage).toBe(false);
  });

  it('returns second page correctly', async () => {
    mockDeps(MOCK_COMMITMENT);
    const result = await callRoute('CMT-001', '?page=2&pageSize=2');
    const { events, meta } = result.data.data;
    expect(events).toHaveLength(1);
    expect(meta.page).toBe(2);
    expect(meta.hasPrevPage).toBe(true);
    expect(meta.hasNextPage).toBe(false);
  });

  it('returns 400 for invalid page param', async () => {
    mockDeps(MOCK_COMMITMENT);
    const result = await callRoute('CMT-001', '?page=0');
    expect(result.status).toBe(400);
    expect(result.data.success).toBe(false);
  });

  it('returns 400 for pageSize exceeding max', async () => {
    mockDeps(MOCK_COMMITMENT);
    const result = await callRoute('CMT-001', '?pageSize=999');
    expect(result.status).toBe(400);
    expect(result.data.success).toBe(false);
  });

  it('returns 400 for non-numeric page', async () => {
    mockDeps(MOCK_COMMITMENT);
    const result = await callRoute('CMT-001', '?page=abc');
    expect(result.status).toBe(400);
  });

  // ── Response envelope ─────────────────────────────────────────────────────

  it('response includes commitmentId at top level', async () => {
    mockDeps(MOCK_COMMITMENT, []);
    const result = await callRoute('CMT-001');
    expect(result.data.data.commitmentId).toBe('CMT-001');
  });

  it('meta contains all required pagination fields', async () => {
    mockDeps(MOCK_COMMITMENT, []);
    const result = await callRoute('CMT-001');
    const { meta } = result.data.data;
    expect(meta).toHaveProperty('page');
    expect(meta).toHaveProperty('pageSize');
    expect(meta).toHaveProperty('total');
    expect(meta).toHaveProperty('totalPages');
    expect(meta).toHaveProperty('hasNextPage');
    expect(meta).toHaveProperty('hasPrevPage');
  });
});
