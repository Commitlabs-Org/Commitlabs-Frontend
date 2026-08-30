/**
 * Analytics Boundary
 *
 * Centralizes the client-side authorization and validation invariants for the
 * analytics feature. Components import from this module instead of duplicating
 * guard logic inline.
 *
 * Invariants enforced here:
 *  1. Wallet connectivity — analytics data is only requested when a wallet is
 *     connected and has a non-empty address.
 *  2. Network validation — the wallet must be on the expected Stellar network.
 *  3. Address format — any address used in an API request must be a well-formed
 *     Stellar G-address.
 *  4. Server response validation — API responses are validated before they are
 *     handed to components, protecting the UI from corrupt or tampered data.
 */

// ─── Stellar address helpers ──────────────────────────────────────────────────

/**
 * Canonical Stellar G-address pattern used throughout the analytics boundary.
 * Intentionally aligned with the backend `STELLAR_PUBLIC_KEY_REGEX` in
 * `src/lib/backend/validation.ts`.
 */
export const STELLAR_G_ADDRESS_REGEX = /^G[A-Z2-7]{55}$/;

/**
 * Returns `true` when `address` is a well-formed Stellar public key.
 * Does NOT perform cryptographic validation — only structural.
 */
export function isValidStellarAddress(address: unknown): address is string {
  return typeof address === 'string' && STELLAR_G_ADDRESS_REGEX.test(address);
}

// ─── Network passphrase helpers ───────────────────────────────────────────────

/**
 * Expected network passphrase for the configured environment.
 * Falls back to the Stellar testnet passphrase when the env var is absent.
 */
export const EXPECTED_NETWORK_PASSPHRASE: string =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE?.trim()) ||
  'Test SDF Network ; September 2015';

/**
 * Returns `true` when `passphrase` matches the expected network passphrase.
 * An empty string or undefined is treated as "no passphrase asserted" and
 * returns `false` so callers can distinguish "not provided" from "wrong".
 */
export function isExpectedNetwork(passphrase: string | null | undefined): boolean {
  if (!passphrase) return false;
  return passphrase.trim() === EXPECTED_NETWORK_PASSPHRASE;
}

// ─── Wallet connectivity guard ────────────────────────────────────────────────

export type WalletGuardResult =
  | { ok: true; address: string }
  | { ok: false; reason: 'disconnected' | 'wrong_network' | 'invalid_address' };

/**
 * Validates the wallet state before any analytics API call.
 *
 * Returns `{ ok: true, address }` when the wallet is ready to make authorized
 * requests; otherwise returns `{ ok: false, reason }` so callers can surface
 * an appropriate prompt to the user without making a doomed request.
 *
 * @param address       Wallet address from `useWallet`.
 * @param connected     Whether the wallet is connected.
 * @param networkError  Any network error message from the wallet hook.
 */
export function guardAnalyticsWallet(
  address: string | null | undefined,
  connected: boolean,
  networkError?: string | null,
): WalletGuardResult {
  if (!connected || !address) {
    return { ok: false, reason: 'disconnected' };
  }

  // A network error from the wallet hook indicates wrong network
  if (networkError) {
    return { ok: false, reason: 'wrong_network' };
  }

  if (!isValidStellarAddress(address)) {
    return { ok: false, reason: 'invalid_address' };
  }

  return { ok: true, address };
}

// ─── Protocol analytics response validation ───────────────────────────────────

export interface ProtocolAnalyticsSnapshot {
  generatedAt: string;
  window: string;
  source: string;
  rejectedRecords: number;
}

export interface ValidatedProtocolAnalytics {
  totalCommitments: number;
  activeCommitments: number;
  settledCommitments: number;
  violatedCommitments: number;
  totalValueLocked: string;
  totalFeesEarned: string;
  averageComplianceScore: number;
  totalViolations: number;
  uniqueOwners: number;
  snapshot: ProtocolAnalyticsSnapshot;
}

export type AnalyticsValidationResult =
  { valid: true; data: ValidatedProtocolAnalytics } | { valid: false; reason: string };

/**
 * Validates a raw JSON response from `GET /api/analytics/protocol`.
 *
 * Rejects:
 *  - non-object or null payloads
 *  - missing or non-numeric required fields
 *  - negative numbers (invariant: all protocol metrics are non-negative)
 *  - compliance scores outside [0, 100]
 *  - status sub-counts that exceed `totalCommitments` (tampered totals)
 *  - missing or malformed snapshot metadata
 *
 * Returns `{ valid: true, data }` on success or `{ valid: false, reason }` on
 * any violation. Components should treat a `valid: false` result as an error
 * state rather than displaying potentially incorrect data.
 */
export function validateProtocolAnalyticsClientResponse(raw: unknown): AnalyticsValidationResult {
  if (typeof raw !== 'object' || raw === null) {
    return { valid: false, reason: 'Response is not an object.' };
  }

  const d = raw as Record<string, unknown>;

  // Required numeric fields
  const numericFields = [
    'totalCommitments',
    'activeCommitments',
    'settledCommitments',
    'violatedCommitments',
    'averageComplianceScore',
    'totalViolations',
    'uniqueOwners',
  ] as const;

  for (const field of numericFields) {
    const v = d[field];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
      return {
        valid: false,
        reason: `Response has invalid numeric field: ${field} (got ${JSON.stringify(v)}).`,
      };
    }
  }

  // Compliance score must be in [0, 100]
  const score = d.averageComplianceScore as number;
  if (score > 100) {
    return {
      valid: false,
      reason: `averageComplianceScore ${score} exceeds maximum of 100.`,
    };
  }

  // Currency fields must be parseable non-negative strings
  const currencyFields = ['totalValueLocked', 'totalFeesEarned'] as const;
  for (const field of currencyFields) {
    const v = d[field];
    if (typeof v !== 'string') {
      return { valid: false, reason: `Response currency field ${field} is not a string.` };
    }
    const parsed = Number(v);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return { valid: false, reason: `Response currency field ${field} has invalid value: ${v}.` };
    }
  }

  // Status sub-counts must not exceed totalCommitments (tamper guard)
  const totalCommitments = d.totalCommitments as number;
  const statusTotal =
    (d.activeCommitments as number) +
    (d.settledCommitments as number) +
    (d.violatedCommitments as number);

  if (statusTotal > totalCommitments) {
    return {
      valid: false,
      reason: `Status totals (${statusTotal}) exceed totalCommitments (${totalCommitments}).`,
    };
  }

  // Snapshot metadata
  if (typeof d.snapshot !== 'object' || d.snapshot === null) {
    return { valid: false, reason: 'Response is missing the snapshot field.' };
  }
  const snap = d.snapshot as Record<string, unknown>;

  if (typeof snap.generatedAt !== 'string' || isNaN(Date.parse(snap.generatedAt))) {
    return {
      valid: false,
      reason: 'Response snapshot.generatedAt is missing or not a valid ISO date.',
    };
  }
  if (typeof snap.rejectedRecords !== 'number' || snap.rejectedRecords < 0) {
    return { valid: false, reason: 'Response snapshot.rejectedRecords is invalid.' };
  }

  return {
    valid: true,
    data: {
      totalCommitments: d.totalCommitments as number,
      activeCommitments: d.activeCommitments as number,
      settledCommitments: d.settledCommitments as number,
      violatedCommitments: d.violatedCommitments as number,
      totalValueLocked: d.totalValueLocked as string,
      totalFeesEarned: d.totalFeesEarned as string,
      averageComplianceScore: d.averageComplianceScore as number,
      totalViolations: d.totalViolations as number,
      uniqueOwners: d.uniqueOwners as number,
      snapshot: {
        generatedAt: snap.generatedAt as string,
        window: typeof snap.window === 'string' ? snap.window : 'protocol-lifetime',
        source: typeof snap.source === 'string' ? snap.source : 'unknown',
        rejectedRecords: snap.rejectedRecords as number,
      },
    },
  };
}

// ─── User analytics response validation ──────────────────────────────────────

export interface ValidatedUserAnalytics {
  ownerAddress: string;
  totalCommitments: number;
  activeCommitments: number;
  totalValueCommitted: string;
  feesEarned: string;
  averageComplianceScore: number;
  violationCount: number;
}

export type UserAnalyticsValidationResult =
  { valid: true; data: ValidatedUserAnalytics } | { valid: false; reason: string };

/**
 * Validates a raw JSON response from `GET /api/analytics/user`.
 *
 * Rejects malformed, tampered, or missing fields before they reach the UI.
 */
export function validateUserAnalyticsClientResponse(raw: unknown): UserAnalyticsValidationResult {
  if (typeof raw !== 'object' || raw === null) {
    return { valid: false, reason: 'User analytics response is not an object.' };
  }

  const d = raw as Record<string, unknown>;

  if (typeof d.ownerAddress !== 'string' || !isValidStellarAddress(d.ownerAddress)) {
    return { valid: false, reason: 'User analytics response has invalid ownerAddress.' };
  }

  const numericFields = [
    'totalCommitments',
    'activeCommitments',
    'averageComplianceScore',
    'violationCount',
  ] as const;

  for (const field of numericFields) {
    const v = d[field];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
      return { valid: false, reason: `User analytics response has invalid field: ${field}.` };
    }
  }

  const score = d.averageComplianceScore as number;
  if (score > 100) {
    return {
      valid: false,
      reason: `averageComplianceScore ${score} exceeds maximum of 100.`,
    };
  }

  const currencyFields = ['totalValueCommitted', 'feesEarned'] as const;
  for (const field of currencyFields) {
    const v = d[field];
    if (typeof v !== 'string') {
      return { valid: false, reason: `User analytics currency field ${field} is not a string.` };
    }
    const parsed = Number(v);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return {
        valid: false,
        reason: `User analytics currency field ${field} has invalid value: ${v}.`,
      };
    }
  }

  return {
    valid: true,
    data: {
      ownerAddress: d.ownerAddress as string,
      totalCommitments: d.totalCommitments as number,
      activeCommitments: d.activeCommitments as number,
      totalValueCommitted: d.totalValueCommitted as string,
      feesEarned: d.feesEarned as string,
      averageComplianceScore: d.averageComplianceScore as number,
      violationCount: d.violationCount as number,
    },
  };
}
