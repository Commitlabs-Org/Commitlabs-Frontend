import { effectiveStatus, maturityOf, type Commitment } from './commitments';
import { isStorageAvailable, readRaw, subscribeStorage, writeRaw } from './storage';

export type NotificationKind = 'maturity' | 'dispute' | 'violation' | 'protocol';

export interface AppNotification {
  id: string; // e.g. "maturity:<id>", "dispute:<id>", "violated:<id>", "protocol:paused"
  kind: NotificationKind;
  title: string;
  message: string;
  timestamp: number;
  link?: string;
  commitmentId?: string;
}

export interface ProtocolStatusLike {
  status?: string;
  paused?: boolean;
}

export const NOTIFICATIONS_READ_KEY = 'commitlabs.notifications.read.v1';
export const NOTIFICATIONS_BROWSER_KEY = 'commitlabs.notifications.browser.enabled';

/**
 * Pure function to derive notification items from commitments and protocol status.
 * Deduplicates by stable keys (e.g. maturity:<id>, dispute:<id>, violated:<id>, protocol:paused).
 */
export function deriveNotifications(
  commitments: Commitment[] = [],
  status?: ProtocolStatusLike | null,
  now = Date.now(),
): AppNotification[] {
  const result: AppNotification[] = [];
  const seenIds = new Set<string>();

  // 1. Process commitments
  for (const c of commitments) {
    // Check maturity: effectiveStatus is 'matured' (only if not settled or exited)
    if (c.status !== 'settled' && c.status !== 'exited') {
      const eff = effectiveStatus(c, now);
      if (eff === 'matured' || c.status === 'matured') {
        const id = `maturity:${c.id}`;
        if (!seenIds.has(id)) {
          seenIds.add(id);
          result.push({
            id,
            kind: 'maturity',
            title: `Commitment #${c.id} Matured`,
            message: `Commitment #${c.id} has matured and is ready for settlement.`,
            timestamp: maturityOf(c),
            link: `/commitments/${c.id}`,
            commitmentId: c.id,
          });
        }
      }
    }

    // Check dispute
    if (c.status === 'disputed') {
      const id = `dispute:${c.id}`;
      if (!seenIds.has(id)) {
        seenIds.add(id);
        result.push({
          id,
          kind: 'dispute',
          title: `Commitment #${c.id} Disputed`,
          message: `A dispute has been recorded on commitment #${c.id}. Payouts and transfers are frozen.`,
          timestamp: c.createdAt,
          link: `/commitments/${c.id}`,
          commitmentId: c.id,
        });
      }
    }

    // Check violated
    if (c.status === 'violated') {
      const id = `violated:${c.id}`;
      if (!seenIds.has(id)) {
        seenIds.add(id);
        result.push({
          id,
          kind: 'violation',
          title: `Commitment #${c.id} Violated`,
          message: `Compliance rule violation detected on commitment #${c.id}.`,
          timestamp: c.createdAt,
          link: `/commitments/${c.id}`,
          commitmentId: c.id,
        });
      }
    }
  }

  // 2. Protocol status paused: single banner-linked item
  if (status && (status.paused === true || (status.status === 'ok' && status.paused))) {
    const id = 'protocol:paused';
    if (!seenIds.has(id)) {
      seenIds.add(id);
      result.push({
        id,
        kind: 'protocol',
        title: 'Protocol Paused',
        message: 'Escrow operations are temporarily paused by the operator.',
        timestamp: now,
        link: '#paused-banner',
      });
    }
  }

  // Sort newest first
  return result.sort((a, b) => b.timestamp - a.timestamp);
}

// In-memory fallback if localStorage fails or private mode
let memoryReadIds: Set<string> | null = null;

export function loadReadNotificationIds(): Set<string> {
  if (memoryReadIds !== null && !isStorageAvailable()) {
    return new Set(memoryReadIds);
  }
  const raw = readRaw(NOTIFICATIONS_READ_KEY);
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((item): item is string => typeof item === 'string'));
    }
    return new Set();
  } catch {
    return new Set();
  }
}

export function saveReadNotificationIds(ids: Set<string> | string[]): boolean {
  const arr = Array.from(ids);
  const ok = writeRaw(NOTIFICATIONS_READ_KEY, JSON.stringify(arr));
  if (!ok) {
    memoryReadIds = new Set(arr);
  }
  return ok;
}

export function markNotificationAsRead(id: string): void {
  const current = loadReadNotificationIds();
  current.add(id);
  saveReadNotificationIds(current);
}

export function markAllNotificationsAsRead(ids: string[]): void {
  const current = loadReadNotificationIds();
  for (const id of ids) {
    current.add(id);
  }
  saveReadNotificationIds(current);
}

export function subscribeNotifications(handler: () => void): () => void {
  return subscribeStorage(NOTIFICATIONS_READ_KEY, handler);
}

export function getBrowserNotificationPref(): boolean {
  const raw = readRaw(NOTIFICATIONS_BROWSER_KEY);
  return raw === 'true';
}

export function setBrowserNotificationPref(enabled: boolean): boolean {
  return writeRaw(NOTIFICATIONS_BROWSER_KEY, enabled ? 'true' : 'false');
}

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isNotificationSupported()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'default';
  }
}

export function sendBrowserNotification(title: string, options?: NotificationOptions): boolean {
  if (!isNotificationSupported()) return false;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
  try {
    new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}
