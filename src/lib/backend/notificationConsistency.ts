/**
 * @module notificationConsistency
 *
 * Client-side consistency guards for notification and preference APIs.
 *
 * Ensures consistency across multiple tabs/sessions by:
 * - Tracking ETags for conditional requests
 * - Detecting version conflicts
 * - Coordinating updates across windows
 * - Tracking idempotency keys for safe retries
 * - Preventing redundant network requests
 *
 * This module provides observable degradation signals and explicit
 * invariants for multi-window operation.
 */

export interface ConsistencyState {
  /** Current ETag from last successful GET */
  etag: string | null;
  /** Version number for tracking updates */
  version: number;
  /** Last update timestamp */
  updatedAt: number;
  /** Whether the local state is known to be stale */
  isStale: boolean;
}

export interface ConflictResolution {
  /** Whether a conflict occurred */
  conflict: boolean;
  /** Message describing the conflict */
  message?: string;
  /** Suggested action */
  action?: 'retry' | 'refresh' | 'merge';
}

/**
 * Tracks consistency state for notifications across multiple windows/tabs.
 * Each wallet address gets its own tracking state.
 */
export class NotificationConsistencyTracker {
  private state = new Map<string, ConsistencyState>();

  /**
   * Initialize or update the consistency state after a successful GET.
   */
  updateFromGet(address: string, etag: string | null): void {
    const current = this.state.get(address) ?? {
      etag: null,
      version: 0,
      updatedAt: Date.now(),
      isStale: false,
    };

    if (etag !== current.etag) {
      current.version += 1;
      current.etag = etag;
      current.updatedAt = Date.now();
      current.isStale = false;
    }

    this.state.set(address, current);
  }

  /**
   * Get the current ETag for use in If-Match headers.
   */
  getCurrentETag(address: string): string | null {
    return this.state.get(address)?.etag ?? null;
  }

  /**
   * Mark the state as stale (after an update or invalidation).
   */
  markStale(address: string): void {
    const current = this.state.get(address);
    if (current) {
      current.isStale = true;
    }
  }

  /**
   * Check if the local state is known to be stale.
   */
  isStale(address: string): boolean {
    return this.state.get(address)?.isStale ?? true;
  }

  /**
   * Get the version number (increments on each GET).
   */
  getVersion(address: string): number {
    return this.state.get(address)?.version ?? 0;
  }

  /**
   * Get time since last update (ms).
   */
  getTimeSinceUpdate(address: string): number {
    const state = this.state.get(address);
    return state ? Date.now() - state.updatedAt : Infinity;
  }

  /**
   * Detect if a conflict occurred (409 or 412 response).
   */
  detectConflict(statusCode: number, message?: string): ConflictResolution {
    if (statusCode === 409) {
      return {
        conflict: true,
        message: message || 'State machine conflict — notification is in terminal state or invalid transition.',
        action: 'retry',
      };
    }

    if (statusCode === 412) {
      return {
        conflict: true,
        message: message || 'Precondition failed — preferences have been modified. Fetch the current version and retry.',
        action: 'refresh',
      };
    }

    return { conflict: false };
  }

  /**
   * Clear all tracking data (for tests or cache invalidation).
   */
  reset(): void {
    this.state.clear();
  }

  /**
   * Get all tracked addresses (for debugging).
   */
  getTrackedAddresses(): string[] {
    return Array.from(this.state.keys());
  }
}

/**
 * Idempotency key manager for safe mutation retries.
 * Generates and tracks idempotency keys to prevent duplicate operations.
 */
export class IdempotencyKeyManager {
  private keys = new Map<string, { key: string; createdAt: number; operation: string }>();

  /**
   * Generate a new idempotency key for an operation.
   * Format: `op_<timestamp>_<random>`
   */
  generateKey(operation: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    const key = `op_${timestamp}_${random}`;

    // Store for tracking
    this.keys.set(key, { key, createdAt: Date.now(), operation });

    // Clean up old keys (older than 24 hours)
    const maxAge = 24 * 60 * 60 * 1000;
    for (const [k, v] of this.keys.entries()) {
      if (Date.now() - v.createdAt > maxAge) {
        this.keys.delete(k);
      }
    }

    return key;
  }

  /**
   * Get the operation for a given idempotency key (for debugging).
   */
  getOperation(key: string): string | null {
    return this.keys.get(key)?.operation ?? null;
  }

  /**
   * Clear all keys (for tests).
   */
  reset(): void {
    this.keys.clear();
  }
}

/**
 * Global consistency tracker for notifications.
 */
export const globalNotificationConsistencyTracker = new NotificationConsistencyTracker();

/**
 * Global idempotency key manager.
 */
export const globalIdempotencyKeyManager = new IdempotencyKeyManager();

/**
 * Broadcast channel for cross-tab communication about preferences/notification changes.
 * Allows multiple tabs to stay in sync without polling.
 */
export class CrossTabSyncChannel {
  private channel: BroadcastChannel | null = null;
  private listeners = new Set<(event: SyncEvent) => void>();

  constructor(private channelName = 'notification-sync') {
    // Only available in browser environments
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel(channelName);
        this.channel.onmessage = (event) => {
          this.notifyListeners(event.data);
        };
      } catch {
        // BroadcastChannel not available in this context
      }
    }
  }

  /**
   * Publish a sync event to other tabs.
   */
  publish(event: SyncEvent): void {
    if (this.channel) {
      this.channel.postMessage(event);
    }
    // Also notify local listeners
    this.notifyListeners(event);
  }

  /**
   * Subscribe to sync events from other tabs.
   */
  subscribe(listener: (event: SyncEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Close the channel (call when unmounting).
   */
  close(): void {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
  }

  private notifyListeners(event: SyncEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in sync listener:', err);
      }
    }
  }
}

export interface SyncEvent {
  /** Type of sync event */
  type: 'notification_updated' | 'preference_updated' | 'invalidate_cache' | 'conflict_detected';
  /** Wallet address (optional, for filtering) */
  address?: string;
  /** Event-specific data */
  data?: Record<string, unknown>;
  /** Timestamp */
  timestamp: number;
}

/**
 * Global cross-tab sync channel.
 */
export const globalCrossTabSyncChannel = new CrossTabSyncChannel();

/**
 * Deduplicate rapid identical requests within a time window.
 * Useful for preventing redundant API calls when rapidly toggling states.
 */
export class RequestDeduplicator {
  private requests = new Map<string, { timestamp: number; promise: Promise<unknown> }>();

  /**
   * Execute or return cached promise for a request within a window.
   * @param key Unique identifier for this request
   * @param fn Function to execute
   * @param windowMs Time window (ms) during which identical requests are deduplicated
   */
  async deduplicate<T>(
    key: string,
    fn: () => Promise<T>,
    windowMs = 1000,
  ): Promise<T> {
    const now = Date.now();
    const cached = this.requests.get(key);

    // If we have a recent cached request, return it
    if (cached && now - cached.timestamp < windowMs) {
      return cached.promise as Promise<T>;
    }

    // Create new request
    const promise = fn();

    // Store for deduplication
    this.requests.set(key, { timestamp: now, promise });

    // Clean up after window expires
    setTimeout(() => {
      if (this.requests.get(key)?.timestamp === now) {
        this.requests.delete(key);
      }
    }, windowMs);

    return promise;
  }

  /**
   * Clear all cached requests (for tests).
   */
  reset(): void {
    this.requests.clear();
  }
}

/**
 * Global request deduplicator.
 */
export const globalRequestDeduplicator = new RequestDeduplicator();
