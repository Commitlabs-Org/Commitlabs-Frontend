import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as mockDb from '@/lib/backend/mockDb';
import { getCommitmentHistory } from '@/lib/backend/services/commitmentHistory';
import type { ChainCommitment } from '@/lib/backend/services/contracts';
import type { Attestation } from '@/lib/types/domain';

vi.mock('@/lib/backend/mockDb', () => ({
  getMockData: vi.fn(),
}));

const mockGetMockData = mockDb.getMockData as ReturnType<typeof vi.fn>;

const BASE_COMMITMENT: ChainCommitment = {
  id: 'CMT-001',
  ownerAddress: 'GOWNER',
  asset: 'XLM',
  amount: '50000',
  status: 'ACTIVE',
  complianceScore: 95,
  currentValue: '52000',
  feeEarned: '200',
  violationCount: 0,
  createdAt: '2026-01-10T00:00:00.000Z',
  expiresAt: '2026-03-10T00:00:00.000Z',
};

const BASE_ATTESTATIONS: Attestation[] = [
  {
    id: 'ATTR-001',
    commitmentId: 'CMT-001',
    kind: 'health_check',
    observedAt: '2026-01-20T12:00:00.000Z',
    txHash: '0xabc',
    severity: 'ok',
    details: { complianceScore: 95, violation: false },
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockGetMockData.mockResolvedValue({
    commitments: [],
    attestations: [],
    listings: [],
  });
});

describe('getCommitmentHistory – created event', () => {
  it('returns exactly one created event', async () => {
    mockGetMockData.mockResolvedValue({
      commitments: [], attestations: [], listings: [],
    });

    const result = await getCommitmentHistory(BASE_COMMITMENT);

    const created = result.events.filter((e) => e.kind === 'created');
    expect(created).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('created event has correct shape', async () => {
    mockGetMockData.mockResolvedValue({
      commitments: [], attestations: [], listings: [],
    });

    const result = await getCommitmentHistory(BASE_COMMITMENT);
    const event = result.events[0];

    expect(event).toMatchObject({
      eventId: 'created:CMT-001',
      kind: 'created',
      occurredAt: '2026-01-10T00:00:00.000Z',
      payload: {
        asset: 'XLM',
        amount: '50000',
        expiresAt: '2026-03-10T00:00:00.000Z',
      },
    });
  });

  it('falls back to epoch when createdAt is missing', async () => {
    const commitment = { ...BASE_COMMITMENT, createdAt: undefined };

    const result = await getCommitmentHistory(commitment);
    const event = result.events[0];

    expect(event.occurredAt).toBe(new Date(0).toISOString());
  });
});

describe('getCommitmentHistory – attestation events', () => {
  it('returns one event per attestation for the commitment', async () => {
    const attestations: Attestation[] = [
      { id: 'ATTR-001', commitmentId: 'CMT-001', kind: 'health_check', observedAt: '2026-01-20T12:00:00.000Z', details: {} },
      { id: 'ATTR-002', commitmentId: 'CMT-001', kind: 'fee_generation', observedAt: '2026-01-25T08:00:00.000Z', details: {} },
    ];
    mockGetMockData.mockResolvedValue({
      commitments: [], attestations, listings: [],
    });

    const result = await getCommitmentHistory(BASE_COMMITMENT);

    const attestationEvents = result.events.filter((e) => e.kind === 'attestation');
    expect(attestationEvents).toHaveLength(2);
  });

  it('excludes attestations from other commitments', async () => {
    const attestations: Attestation[] = [
      { id: 'ATTR-001', commitmentId: 'CMT-001', kind: 'health_check', observedAt: '2026-01-20T12:00:00.000Z', details: {} },
      { id: 'ATTR-OTHER', commitmentId: 'CMT-999', kind: 'health_check', observedAt: '2026-01-25T08:00:00.000Z', details: {} },
    ];
    mockGetMockData.mockResolvedValue({
      commitments: [], attestations, listings: [],
    });

    const result = await getCommitmentHistory(BASE_COMMITMENT);

    const attestationEvents = result.events.filter((e) => e.kind === 'attestation');
    expect(attestationEvents).toHaveLength(1);
    attestationEvents.forEach((e) => {
      if (e.kind === 'attestation') {
        expect(e.payload.attestationId).toBe('ATTR-001');
      }
    });
  });

  it('attestation event has correct shape with compliance and violation', async () => {
    mockGetMockData.mockResolvedValue({
      commitments: [], attestations: BASE_ATTESTATIONS, listings: [],
    });

    const result = await getCommitmentHistory(BASE_COMMITMENT);
    const attnEvent = result.events.find((e) => e.kind === 'attestation');

    expect(attnEvent).toBeDefined();
    if (attnEvent?.kind === 'attestation') {
      expect(attnEvent).toMatchObject({
        eventId: 'attestation:ATTR-001',
        kind: 'attestation',
        occurredAt: '2026-01-20T12:00:00.000Z',
        txHash: '0xabc',
        payload: {
          attestationId: 'ATTR-001',
          attestationType: 'health_check',
          complianceScore: 95,
          violation: false,
          severity: 'ok',
        },
      });
    }
  });

  it('attestation event defaults kind to unknown when missing', async () => {
    const attestations: Attestation[] = [
      { id: 'ATTR-001', commitmentId: 'CMT-001', observedAt: '2026-01-20T12:00:00.000Z', details: {} },
    ];
    mockGetMockData.mockResolvedValue({
      commitments: [], attestations, listings: [],
    });

    const result = await getCommitmentHistory(BASE_COMMITMENT);
    const attnEvent = result.events.find((e) => e.kind === 'attestation');

    expect(attnEvent).toBeDefined();
    if (attnEvent?.kind === 'attestation') {
      expect(attnEvent.payload.attestationType).toBe('unknown');
    }
  });

  it('handles undefined complianceScore and violation in attestation details', async () => {
    const attestations: Attestation[] = [
      { id: 'ATTR-001', commitmentId: 'CMT-001', kind: 'health_check', observedAt: '2026-01-20T12:00:00.000Z', severity: 'ok', details: {} },
    ];
    mockGetMockData.mockResolvedValue({
      commitments: [], attestations, listings: [],
    });

    const result = await getCommitmentHistory(BASE_COMMITMENT);
    const attnEvent = result.events.find((e) => e.kind === 'attestation');

    expect(attnEvent).toBeDefined();
    if (attnEvent?.kind === 'attestation') {
      expect(attnEvent.payload.complianceScore).toBeUndefined();
      expect(attnEvent.payload.violation).toBeUndefined();
    }
  });
});

describe('getCommitmentHistory – terminal events', () => {
  it('includes early_exit event when commitment status is EARLY_EXIT', async () => {
    const commitment = { ...BASE_COMMITMENT, status: 'EARLY_EXIT' as const };
    mockGetMockData.mockResolvedValue({
      commitments: [], attestations: [], listings: [],
    });

    const result = await getCommitmentHistory(commitment);

    const terminal = result.events.find((e) => e.kind === 'early_exit');
    expect(terminal).toBeDefined();
    if (terminal?.kind === 'early_exit') {
      expect(terminal.eventId).toBe('early_exit:CMT-001');
      expect(terminal.payload.exitedBy).toBe('GOWNER');
    }
  });

  it('includes settlement event when commitment status is SETTLED', async () => {
    const commitment = { ...BASE_COMMITMENT, status: 'SETTLED' as const };
    mockGetMockData.mockResolvedValue({
      commitments: [], attestations: [], listings: [],
    });

    const result = await getCommitmentHistory(commitment);

    const terminal = result.events.find((e) => e.kind === 'settlement');
    expect(terminal).toBeDefined();
    if (terminal?.kind === 'settlement') {
      expect(terminal.eventId).toBe('settlement:CMT-001');
      expect(terminal.payload.settlementAmount).toBe('200');
      expect(terminal.payload.finalStatus).toBe('SETTLED');
    }
  });

  it('does not include terminal event for ACTIVE commitment', async () => {
    mockGetMockData.mockResolvedValue({
      commitments: [], attestations: [], listings: [],
    });

    const result = await getCommitmentHistory(BASE_COMMITMENT);

    const terminal = result.events.filter(
      (e) => e.kind === 'early_exit' || e.kind === 'settlement',
    );
    expect(terminal).toHaveLength(0);
  });

  it('does not include terminal event for VIOLATED commitment', async () => {
    const commitment = { ...BASE_COMMITMENT, status: 'VIOLATED' as const };
    mockGetMockData.mockResolvedValue({
      commitments: [], attestations: [], listings: [],
    });

    const result = await getCommitmentHistory(commitment);

    const terminal = result.events.filter(
      (e) => e.kind === 'early_exit' || e.kind === 'settlement',
    );
    expect(terminal).toHaveLength(0);
  });

  it('does not include terminal event for UNKNOWN commitment', async () => {
    const commitment = { ...BASE_COMMITMENT, status: 'UNKNOWN' as const };
    mockGetMockData.mockResolvedValue({
      commitments: [], attestations: [], listings: [],
    });

    const result = await getCommitmentHistory(commitment);

    const terminal = result.events.filter(
      (e) => e.kind === 'early_exit' || e.kind === 'settlement',
    );
    expect(terminal).toHaveLength(0);
  });

  it('early_exit event uses expiresAt as timestamp', async () => {
    const commitment = { ...BASE_COMMITMENT, status: 'EARLY_EXIT' as const };
    mockGetMockData.mockResolvedValue({
      commitments: [], attestations: [], listings: [],
    });

    const result = await getCommitmentHistory(commitment);
    const terminal = result.events.find((e) => e.kind === 'early_exit');

    expect(terminal).toBeDefined();
    expect(terminal!.occurredAt).toBe('2026-03-10T00:00:00.000Z');
  });

  it('settlement event uses expiresAt as timestamp', async () => {
    const commitment = { ...BASE_COMMITMENT, status: 'SETTLED' as const };
    mockGetMockData.mockResolvedValue({
      commitments: [], attestations: [], listings: [],
    });

    const result = await getCommitmentHistory(commitment);
    const terminal = result.events.find((e) => e.kind === 'settlement');

    expect(terminal).toBeDefined();
    expect(terminal!.occurredAt).toBe('2026-03-10T00:00:00.000Z');
  });
});

describe('getCommitmentHistory – chronological ordering', () => {
  it('returns events sorted ascending by occurredAt', async () => {
    const attestations: Attestation[] = [
      { id: 'ATTR-002', commitmentId: 'CMT-001', kind: 'fee_generation', observedAt: '2026-01-25T08:00:00.000Z', details: {} },
      { id: 'ATTR-001', commitmentId: 'CMT-001', kind: 'health_check', observedAt: '2026-01-20T12:00:00.000Z', details: {} },
    ];
    mockGetMockData.mockResolvedValue({
      commitments: [], attestations, listings: [],
    });

    const result = await getCommitmentHistory(BASE_COMMITMENT);

    for (let i = 1; i < result.events.length; i++) {
      expect(new Date(result.events[i].occurredAt).getTime()).toBeGreaterThanOrEqual(
        new Date(result.events[i - 1].occurredAt).getTime(),
      );
    }
  });

  it('orders correctly when terminal event falls between attestations', async () => {
    const attestations: Attestation[] = [
      { id: 'ATTR-001', commitmentId: 'CMT-001', kind: 'health_check', observedAt: '2026-02-01T00:00:00.000Z', details: {} },
      { id: 'ATTR-002', commitmentId: 'CMT-001', kind: 'fee_generation', observedAt: '2026-04-01T00:00:00.000Z', details: {} },
    ];
    const commitment = { ...BASE_COMMITMENT, status: 'EARLY_EXIT' as const, expiresAt: '2026-03-01T00:00:00.000Z' };
    mockGetMockData.mockResolvedValue({
      commitments: [], attestations, listings: [],
    });

    const result = await getCommitmentHistory(commitment);

    const kinds = result.events.map((e) => e.kind);
    const createdIdx = kinds.indexOf('created');
    const attn1Idx = kinds.indexOf('attestation');
    const exitIdx = kinds.indexOf('early_exit');
    const attn2Idx = kinds.lastIndexOf('attestation');

    expect(createdIdx).toBeLessThan(attn1Idx);
    expect(attn1Idx).toBeLessThan(exitIdx);
    expect(exitIdx).toBeLessThan(attn2Idx);
  });

  it('handles attestations out of order in source data', async () => {
    const attestations: Attestation[] = [
      { id: 'ATTR-003', commitmentId: 'CMT-001', kind: 'drawdown', observedAt: '2026-03-01T00:00:00.000Z', details: {} },
      { id: 'ATTR-001', commitmentId: 'CMT-001', kind: 'health_check', observedAt: '2026-01-20T12:00:00.000Z', details: {} },
      { id: 'ATTR-002', commitmentId: 'CMT-001', kind: 'fee_generation', observedAt: '2026-02-15T00:00:00.000Z', details: {} },
    ];
    mockGetMockData.mockResolvedValue({
      commitments: [], attestations, listings: [],
    });

    const result = await getCommitmentHistory(BASE_COMMITMENT);

    const timestamps = result.events.map((e) => new Date(e.occurredAt).getTime());
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
    }
  });
});

describe('getCommitmentHistory – total count', () => {
  it('total reflects the number of events', async () => {
    const attestations: Attestation[] = [
      { id: 'ATTR-001', commitmentId: 'CMT-001', kind: 'health_check', observedAt: '2026-01-20T12:00:00.000Z', details: {} },
      { id: 'ATTR-002', commitmentId: 'CMT-001', kind: 'fee_generation', observedAt: '2026-01-25T08:00:00.000Z', details: {} },
    ];
    mockGetMockData.mockResolvedValue({
      commitments: [], attestations, listings: [],
    });

    const result = await getCommitmentHistory(BASE_COMMITMENT);

    expect(result.total).toBe(3);
    expect(result.events).toHaveLength(result.total);
  });

  it('total includes terminal event', async () => {
    const commitment = { ...BASE_COMMITMENT, status: 'SETTLED' as const };
    mockGetMockData.mockResolvedValue({
      commitments: [], attestations: BASE_ATTESTATIONS, listings: [],
    });

    const result = await getCommitmentHistory(commitment);

    expect(result.total).toBe(3);
  });
});

describe('getCommitmentHistory – integration scenarios', () => {
  it('handles no attestations for an active commitment', async () => {
    mockGetMockData.mockResolvedValue({
      commitments: [], attestations: [], listings: [],
    });

    const result = await getCommitmentHistory(BASE_COMMITMENT);

    expect(result.events).toHaveLength(1);
    expect(result.events[0].kind).toBe('created');
    expect(result.total).toBe(1);
  });

  it('handles no attestations for a settled commitment', async () => {
    const commitment = { ...BASE_COMMITMENT, status: 'SETTLED' as const };
    mockGetMockData.mockResolvedValue({
      commitments: [], attestations: [], listings: [],
    });

    const result = await getCommitmentHistory(commitment);

    expect(result.events).toHaveLength(2);
    expect(result.events[0].kind).toBe('created');
    expect(result.events[1].kind).toBe('settlement');
    expect(result.total).toBe(2);
  });

  it('handles no attestations for an early-exited commitment', async () => {
    const commitment = { ...BASE_COMMITMENT, status: 'EARLY_EXIT' as const };
    mockGetMockData.mockResolvedValue({
      commitments: [], attestations: [], listings: [],
    });

    const result = await getCommitmentHistory(commitment);

    expect(result.events).toHaveLength(2);
    expect(result.events[0].kind).toBe('created');
    expect(result.events[1].kind).toBe('early_exit');
    expect(result.total).toBe(2);
  });

  it('creates unique eventIds for each event', async () => {
    mockGetMockData.mockResolvedValue({
      commitments: [], attestations: BASE_ATTESTATIONS, listings: [],
    });

    const result = await getCommitmentHistory(BASE_COMMITMENT);
    const ids = result.events.map((e) => e.eventId);

    expect(new Set(ids).size).toBe(ids.length);
  });
});
