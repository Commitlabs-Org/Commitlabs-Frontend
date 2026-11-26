import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  deriveNotifications,
  loadReadNotificationIds,
  saveReadNotificationIds,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  subscribeNotifications,
  NOTIFICATIONS_READ_KEY,
} from '../notifications';
import type { Commitment } from '../commitments';

const baseCommitment: Commitment = {
  id: 'CMT-100',
  type: 'safe',
  asset: 'XLM',
  amount: '10000000',
  durationDays: 7,
  maxLoss: 2,
  penalty: 3,
  apy: 4.5,
  createdAt: 1000000,
  status: 'active',
  owner: 'GBUSER',
  txHash: null,
};

describe('Notifications Derivation', () => {
  it('commitment crossing maturity yields exactly one maturity:<id> notification', () => {
    const maturityTime = baseCommitment.createdAt + baseCommitment.durationDays * 86_400_000;
    const now = maturityTime + 5000; // Crossed maturity

    const notifications = deriveNotifications([baseCommitment], null, now);

    const maturityItems = notifications.filter((n) => n.id === `maturity:${baseCommitment.id}`);
    expect(maturityItems).toHaveLength(1);
    expect(maturityItems[0].kind).toBe('maturity');
    expect(maturityItems[0].title).toContain(`Commitment #${baseCommitment.id} Matured`);
    expect(maturityItems[0].link).toBe(`/commitments/${baseCommitment.id}`);
  });

  it('dispute and violated statuses each produce one', () => {
    const disputed: Commitment = {
      ...baseCommitment,
      id: 'CMT-DISPUTED',
      status: 'disputed',
    };
    const violated: Commitment = {
      ...baseCommitment,
      id: 'CMT-VIOLATED',
      status: 'violated',
    };

    const notifications = deriveNotifications([disputed, violated], null, Date.now());

    const disputeItems = notifications.filter((n) => n.id === `dispute:${disputed.id}`);
    expect(disputeItems).toHaveLength(1);
    expect(disputeItems[0].kind).toBe('dispute');

    const violatedItems = notifications.filter((n) => n.id === `violated:${violated.id}`);
    expect(violatedItems).toHaveLength(1);
    expect(violatedItems[0].kind).toBe('violation');
  });

  it('paused protocol produces a single banner-linked item', () => {
    const now = Date.now();
    const notifications = deriveNotifications([], { status: 'ok', paused: true }, now);

    const protocolItems = notifications.filter((n) => n.id === 'protocol:paused');
    expect(protocolItems).toHaveLength(1);
    expect(protocolItems[0].kind).toBe('protocol');
    expect(protocolItems[0].title).toBe('Protocol Paused');
    expect(protocolItems[0].link).toBe('#paused-banner');
  });
});

describe('Notifications Persistence and Sync', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('mark read persists across remount and across a storage event', () => {
    const notifId = 'maturity:CMT-100';

    expect(loadReadNotificationIds().has(notifId)).toBe(false);

    markNotificationAsRead(notifId);

    // Persisted in storage
    const loaded = loadReadNotificationIds();
    expect(loaded.has(notifId)).toBe(true);

    // Across storage event (simulating another tab)
    const listener = vi.fn();
    const unsubscribe = subscribeNotifications(listener);

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: NOTIFICATIONS_READ_KEY,
        newValue: JSON.stringify([notifId, 'dispute:CMT-200']),
      }),
    );

    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });
});
