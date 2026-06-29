import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as mockDb from '@/lib/backend/mockDb';
import { getUserNotifications } from '@/lib/backend/services/notifications';

vi.mock('@/lib/backend/mockDb', () => ({
  getMockData: vi.fn(),
}));

const mockGetMockData = mockDb.getMockData as ReturnType<typeof vi.fn>;

const BASE_COMMITMENT = { asset: 'XLM', type: 'Safe' as const, amount: '100', status: 'Active' as const };

beforeEach(() => {
  vi.clearAllMocks();
  mockGetMockData.mockResolvedValue({ commitments: [], attestations: [], listings: [] });
});

describe('getUserNotifications – owner filtering', () => {
  it('returns only notifications for the requested owner', async () => {
    mockGetMockData.mockResolvedValue({
      commitments: [
        { ...BASE_COMMITMENT, id: 'CMT-A', ownerAddress: 'alice', status: 'Violated' },
        { ...BASE_COMMITMENT, id: 'CMT-B', ownerAddress: 'bob', status: 'Violated' },
      ],
      attestations: [],
      listings: [],
    });

    const notifications = await getUserNotifications('alice');

    expect(notifications.every((n) => n.ownerAddress === 'alice')).toBe(true);
    expect(notifications.every((n) => n.relatedCommitmentId === 'CMT-A')).toBe(true);
  });

  it('returns empty array when owner has no commitments', async () => {
    mockGetMockData.mockResolvedValue({
      commitments: [{ ...BASE_COMMITMENT, id: 'CMT-X', ownerAddress: 'alice', status: 'Active', daysRemaining: 30 }],
      attestations: [],
      listings: [],
    });

    const notifications = await getUserNotifications('nobody');
    expect(notifications).toHaveLength(0);
  });

  it('includes commitments without ownerAddress for any owner (fallback behaviour)', async () => {
    mockGetMockData.mockResolvedValue({
      commitments: [{ ...BASE_COMMITMENT, id: 'CMT-NOOWN', status: 'Violated' }],
      attestations: [],
      listings: [],
    });

    const notifications = await getUserNotifications('anyone');
    expect(notifications).toHaveLength(1);
    expect(notifications[0].relatedCommitmentId).toBe('CMT-NOOWN');
  });

  it('isolates owners — bob sees only his notifications', async () => {
    mockGetMockData.mockResolvedValue({
      commitments: [
        { ...BASE_COMMITMENT, id: 'CMT-A', ownerAddress: 'alice', status: 'Violated' },
        { ...BASE_COMMITMENT, id: 'CMT-B', ownerAddress: 'bob', status: 'Violated' },
      ],
      attestations: [],
      listings: [],
    });

    const bobNotifs = await getUserNotifications('bob');
    expect(bobNotifs).toHaveLength(1);
    expect(bobNotifs[0].relatedCommitmentId).toBe('CMT-B');
  });
});

describe('getUserNotifications – attestation → notification mapping', () => {
  it('maps a failed attestation to a critical violation notification', async () => {
    mockGetMockData.mockResolvedValue({
      commitments: [{ ...BASE_COMMITMENT, id: 'CMT-1', ownerAddress: 'alice' }],
      attestations: [
        { id: 'ATT-1', commitmentId: 'CMT-1', verdict: 'fail', observedAt: '2026-01-15T10:00:00Z' },
      ],
      listings: [],
    });

    const notifications = await getUserNotifications('alice');
    const attestationNotif = notifications.find((n) => n.relatedCommitmentId === 'CMT-1' && n.type === 'violation');

    expect(attestationNotif).toBeDefined();
    expect(attestationNotif!.severity).toBe('critical');
    expect(attestationNotif!.title).toBe('Attestation Failure');
    expect(attestationNotif!.message).toContain('CMT-1');
    expect(attestationNotif!.createdAt).toBe('2026-01-15T10:00:00Z');
    expect(attestationNotif!.read).toBe(false);
    expect(attestationNotif!.ownerAddress).toBe('alice');
  });

  it('maps a severity=violation attestation to a critical violation notification', async () => {
    mockGetMockData.mockResolvedValue({
      commitments: [{ ...BASE_COMMITMENT, id: 'CMT-2', ownerAddress: 'alice' }],
      attestations: [
        { id: 'ATT-2', commitmentId: 'CMT-2', severity: 'violation', observedAt: '2026-02-01T08:00:00Z' },
      ],
      listings: [],
    });

    const [notif] = await getUserNotifications('alice');
    expect(notif.severity).toBe('critical');
    expect(notif.type).toBe('violation');
  });

  it('maps a warning attestation to a warning health_check notification', async () => {
    mockGetMockData.mockResolvedValue({
      commitments: [{ ...BASE_COMMITMENT, id: 'CMT-3', ownerAddress: 'alice' }],
      attestations: [
        { id: 'ATT-3', commitmentId: 'CMT-3', severity: 'warning', observedAt: '2026-03-05T09:00:00Z' },
      ],
      listings: [],
    });

    const [notif] = await getUserNotifications('alice');
    expect(notif.severity).toBe('warning');
    expect(notif.type).toBe('health_check');
    expect(notif.title).toBe('Attestation Warning');
    expect(notif.createdAt).toBe('2026-03-05T09:00:00Z');
  });

  it('does not create a notification for a passing attestation', async () => {
    mockGetMockData.mockResolvedValue({
      commitments: [{ ...BASE_COMMITMENT, id: 'CMT-4', ownerAddress: 'alice' }],
      attestations: [
        { id: 'ATT-4', commitmentId: 'CMT-4', verdict: 'pass', severity: 'ok', observedAt: '2026-04-01T00:00:00Z' },
      ],
      listings: [],
    });

    const notifications = await getUserNotifications('alice');
    expect(notifications).toHaveLength(0);
  });

  it('only joins attestations belonging to the owner\'s commitments', async () => {
    mockGetMockData.mockResolvedValue({
      commitments: [
        { ...BASE_COMMITMENT, id: 'CMT-A', ownerAddress: 'alice' },
        { ...BASE_COMMITMENT, id: 'CMT-B', ownerAddress: 'bob' },
      ],
      attestations: [
        { id: 'ATT-A', commitmentId: 'CMT-A', verdict: 'fail', observedAt: '2026-01-01T00:00:00Z' },
        { id: 'ATT-B', commitmentId: 'CMT-B', verdict: 'fail', observedAt: '2026-01-02T00:00:00Z' },
      ],
      listings: [],
    });

    const aliceNotifs = await getUserNotifications('alice');
    expect(aliceNotifs.every((n) => n.relatedCommitmentId === 'CMT-A')).toBe(true);
  });
});

describe('getUserNotifications – commitment-derived notifications', () => {
  it('emits an expiry warning for active commitments with <=7 days remaining', async () => {
    mockGetMockData.mockResolvedValue({
      commitments: [
        { ...BASE_COMMITMENT, id: 'CMT-EXP', ownerAddress: 'alice', status: 'Active', daysRemaining: 3 },
      ],
      attestations: [],
      listings: [],
    });

    const [notif] = await getUserNotifications('alice');
    expect(notif.type).toBe('expiry');
    expect(notif.severity).toBe('warning');
    expect(notif.message).toContain('CMT-EXP');
    expect(notif.message).toContain('3');
  });

  it('does not emit expiry warning when daysRemaining > 7', async () => {
    mockGetMockData.mockResolvedValue({
      commitments: [
        { ...BASE_COMMITMENT, id: 'CMT-FAR', ownerAddress: 'alice', status: 'Active', daysRemaining: 30 },
      ],
      attestations: [],
      listings: [],
    });

    const notifications = await getUserNotifications('alice');
    expect(notifications).toHaveLength(0);
  });

  it('emits a violation notification for a Violated commitment', async () => {
    mockGetMockData.mockResolvedValue({
      commitments: [
        { ...BASE_COMMITMENT, id: 'CMT-VIO', ownerAddress: 'alice', status: 'Violated' },
      ],
      attestations: [],
      listings: [],
    });

    const [notif] = await getUserNotifications('alice');
    expect(notif.type).toBe('violation');
    expect(notif.severity).toBe('critical');
    expect(notif.message).toContain('CMT-VIO');
  });

  it('returns notifications sorted by createdAt descending', async () => {
    mockGetMockData.mockResolvedValue({
      commitments: [{ ...BASE_COMMITMENT, id: 'CMT-S', ownerAddress: 'alice' }],
      attestations: [
        { id: 'ATT-OLD', commitmentId: 'CMT-S', verdict: 'fail', observedAt: '2026-01-01T00:00:00Z' },
        { id: 'ATT-NEW', commitmentId: 'CMT-S', severity: 'warning', observedAt: '2026-06-01T00:00:00Z' },
      ],
      listings: [],
    });

    const notifications = await getUserNotifications('alice');
    expect(notifications[0].createdAt >= notifications[notifications.length - 1].createdAt).toBe(true);
  });
});

describe('getUserNotifications – edge cases', () => {
  it('handles owner with commitments but no attestations', async () => {
    mockGetMockData.mockResolvedValue({
      commitments: [{ ...BASE_COMMITMENT, id: 'CMT-NOATT', ownerAddress: 'alice', status: 'Active', daysRemaining: 5 }],
      attestations: [],
      listings: [],
    });

    const notifications = await getUserNotifications('alice');
    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe('expiry');
  });

  it('handles empty mock data', async () => {
    const notifications = await getUserNotifications('alice');
    expect(notifications).toHaveLength(0);
  });

  it('assigns a unique id to each notification', async () => {
    mockGetMockData.mockResolvedValue({
      commitments: [
        { ...BASE_COMMITMENT, id: 'CMT-1', ownerAddress: 'alice', status: 'Violated' },
        { ...BASE_COMMITMENT, id: 'CMT-2', ownerAddress: 'alice', status: 'Violated' },
      ],
      attestations: [],
      listings: [],
    });

    const notifications = await getUserNotifications('alice');
    const ids = notifications.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
