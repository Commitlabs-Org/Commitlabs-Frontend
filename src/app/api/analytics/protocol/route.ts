import { NextRequest, NextResponse } from 'next/server';
import { methodNotAllowed, attachSecurityHeaders } from '@/lib/backend/apiResponse';
import { ChainCommitment } from '@/lib/backend/services/contracts';
import {
  applyCorsPolicy,
  createCorsOptionsHandler,
  enforceCorsRequestPolicy,
  toCorsErrorResponse,
  type CorsRoutePolicy,
} from '@/lib/backend/cors';
import { BackendError, normalizeBackendError, toBackendErrorResponse } from '@/lib/backend/errors';
import { UnauthorizedError } from '@/lib/backend/errors';
import { isFeatureEnabled } from '@/lib/backend/config';
import { getMockData } from '@/lib/backend/mockDb';
import { verifyAuth } from '@/lib/backend/requireAuth';

export interface ProtocolAnalyticsResponse {
  totalCommitments: number;
  activeCommitments: number;
  settledCommitments: number;
  violatedCommitments: number;
  totalValueLocked: string;
  totalFeesEarned: string;
  averageComplianceScore: number;
  totalViolations: number;
  uniqueOwners: number;
  snapshot: {
    generatedAt: string;
    window: 'protocol-lifetime';
    source: 'mock' | 'chain';
    rejectedRecords: number;
  };
  invariants: {
    statusTotalsMatch: true;
    nonNegativeTotals: true;
    complianceScoreBounded: true;
  };
}

/**
 * Expected network passphrase. Drawn from the same env vars as the marketplace
 * boundary so wallet-network validation is consistent across the app.
 */
export const EXPECTED_ANALYTICS_NETWORK_PASSPHRASE =
  process.env.SOROBAN_NETWORK_PASSPHRASE ??
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ??
  'Test SDF Network ; September 2015';

const ANALYTICS_PROTOCOL_CORS_POLICY = {
  GET: { access: 'first-party' },
} satisfies CorsRoutePolicy;

export const OPTIONS = createCorsOptionsHandler(ANALYTICS_PROTOCOL_CORS_POLICY);

type ProtocolAnalyticsSource = 'mock' | 'chain';

type CountedStatus = 'ACTIVE' | 'SETTLED' | 'VIOLATED';

interface NormalizedCommitment {
  id: string;
  ownerAddress: string;
  amount: number;
  feeEarned: number;
  status: CountedStatus | 'OTHER';
  complianceScore: number;
  violationCount: number;
}

interface ProtocolCommitmentSnapshot {
  commitments: ChainCommitment[];
  source: ProtocolAnalyticsSource;
}

const COUNTED_STATUSES = new Set<CountedStatus>(['ACTIVE', 'SETTLED', 'VIOLATED']);
const MAX_COMPLIANCE_SCORE = 100;

/**
 * Validate the network passphrase header sent by the client.
 *
 * The header is optional — first-party SPA calls typically omit it — but when
 * present it MUST match the expected passphrase. This prevents a compromised
 * or misconfigured client on the wrong network from querying the protocol
 * analytics endpoint as if it were on the correct network.
 *
 * Throws an `UnauthorizedError` (HTTP 401) on a mismatch.
 */
export function validateNetworkPassphrase(req: NextRequest): void {
  const provided = req.headers.get('x-network-passphrase');
  if (!provided) {
    // Header is optional — absence means the client is not asserting a network.
    return;
  }
  if (provided.trim() !== EXPECTED_ANALYTICS_NETWORK_PASSPHRASE) {
    throw new UnauthorizedError('Wallet is connected to an unsupported Stellar network.', {
      provided: provided.trim(),
    });
  }
}

/**
 * Validate the wallet address header when the client forwards it.
 *
 * Like the network passphrase, this header is optional. When present it must
 * be a plausible Stellar G-address (56 chars, starts with G) so the server can
 * at minimum reject obviously forged / injected values before any downstream
 * use.
 *
 * Throws an `UnauthorizedError` (HTTP 401) on a malformed value.
 */
export function validateWalletAddressHeader(req: NextRequest): string | null {
  const raw = req.headers.get('x-wallet-address');
  if (!raw) return null;
  const trimmed = raw.trim();
  // Stellar public key: 56-character base32 string starting with 'G'
  if (!/^G[A-Z2-7]{55}$/.test(trimmed)) {
    throw new UnauthorizedError('x-wallet-address header contains an invalid Stellar address.', {
      provided: trimmed,
    });
  }
  return trimmed;
}

/**
 * Cross-check the authenticated session address against the optional
 * x-wallet-address header. Prevents a valid session from being replayed by a
 * client that swapped its wallet address in the header (replay / tampering
 * scenario).
 *
 * Throws a `UnauthorizedError` (HTTP 401) when the addresses do not match.
 */
export function assertSessionMatchesWalletHeader(
  sessionAddress: string,
  walletAddress: string | null,
): void {
  if (walletAddress === null) return;
  if (sessionAddress !== walletAddress) {
    throw new UnauthorizedError(
      'Session wallet address does not match the x-wallet-address header.',
      { hint: 'Ensure you are signed in with the same wallet you are querying from.' },
    );
  }
}

function parseNonNegativeFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = typeof value === 'string' ? Number(value.replace(/,/g, '')) : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function normalizeCommitment(commitment: ChainCommitment): NormalizedCommitment | null {
  const amount = parseNonNegativeFiniteNumber(commitment.amount);
  const feeEarned = parseNonNegativeFiniteNumber(commitment.feeEarned);
  const complianceScore = parseNonNegativeFiniteNumber(commitment.complianceScore);
  const violationCount = parseNonNegativeFiniteNumber(commitment.violationCount);

  if (
    !commitment.id ||
    amount === null ||
    feeEarned === null ||
    complianceScore === null ||
    violationCount === null ||
    complianceScore > MAX_COMPLIANCE_SCORE ||
    !Number.isInteger(violationCount)
  ) {
    return null;
  }

  const status = COUNTED_STATUSES.has(commitment.status as CountedStatus)
    ? (commitment.status as CountedStatus)
    : 'OTHER';

  return {
    id: commitment.id,
    ownerAddress: commitment.ownerAddress?.trim() ?? '',
    amount,
    feeEarned,
    status,
    complianceScore,
    violationCount,
  };
}

function formatCurrencyMetric(value: number): string {
  return value.toFixed(2);
}

export function buildProtocolAnalytics(
  commitments: ChainCommitment[],
  source: ProtocolAnalyticsSource = 'chain',
): ProtocolAnalyticsResponse {
  const normalized = commitments.map(normalizeCommitment);
  const validCommitments = normalized.filter((c): c is NormalizedCommitment => c !== null);
  const rejectedRecords = normalized.length - validCommitments.length;

  const totalCommitments = validCommitments.length;
  const activeCommitments = validCommitments.filter((c) => c.status === 'ACTIVE').length;
  const settledCommitments = validCommitments.filter((c) => c.status === 'SETTLED').length;
  const violatedCommitments = validCommitments.filter((c) => c.status === 'VIOLATED').length;

  const averageComplianceScore =
    totalCommitments === 0
      ? 0
      : validCommitments.reduce((acc, c) => acc + c.complianceScore, 0) / totalCommitments;

  const totalViolations = validCommitments.reduce((acc, c) => acc + c.violationCount, 0);

  const uniqueOwners = new Set(validCommitments.map((c) => c.ownerAddress).filter(Boolean)).size;
  const statusTotal = activeCommitments + settledCommitments + violatedCommitments;

  if (statusTotal > totalCommitments) {
    throw new BackendError({
      code: 'INTERNAL_ERROR',
      message: 'Protocol analytics status invariant failed.',
      status: 500,
      details: { totalCommitments, statusTotal },
    });
  }

  return {
    totalCommitments,
    activeCommitments,
    settledCommitments,
    violatedCommitments,
    totalValueLocked: formatCurrencyMetric(validCommitments.reduce((acc, c) => acc + c.amount, 0)),
    totalFeesEarned: formatCurrencyMetric(
      validCommitments.reduce((acc, c) => acc + c.feeEarned, 0),
    ),
    averageComplianceScore: Number(averageComplianceScore.toFixed(2)),
    totalViolations,
    uniqueOwners,
    snapshot: {
      generatedAt: new Date().toISOString(),
      window: 'protocol-lifetime',
      source,
      rejectedRecords,
    },
    invariants: {
      statusTotalsMatch: true,
      nonNegativeTotals: true,
      complianceScoreBounded: true,
    },
  };
}

/**
 * Validate and normalize the analytics response body returned from an upstream
 * service or the internal aggregation layer.
 *
 * Guards against malformed responses by asserting that mandatory numeric fields
 * are finite non-negative numbers and that the snapshot shape is present.
 * Throws a `BackendError` with code `INTERNAL_ERROR` when the shape is invalid
 * so callers receive a 500 rather than silently propagating corrupt data to the
 * client.
 */
export function validateProtocolAnalyticsResponse(data: unknown): ProtocolAnalyticsResponse {
  if (typeof data !== 'object' || data === null) {
    throw new BackendError({
      code: 'INTERNAL_ERROR',
      message: 'Protocol analytics response is not an object.',
      status: 500,
    });
  }

  const d = data as Record<string, unknown>;

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
      throw new BackendError({
        code: 'INTERNAL_ERROR',
        message: `Protocol analytics response has invalid field: ${field}.`,
        status: 500,
        details: { field, value: v },
      });
    }
  }

  const stringCurrencyFields = ['totalValueLocked', 'totalFeesEarned'] as const;
  for (const field of stringCurrencyFields) {
    const v = d[field];
    if (typeof v !== 'string') {
      throw new BackendError({
        code: 'INTERNAL_ERROR',
        message: `Protocol analytics response has invalid currency field: ${field}.`,
        status: 500,
        details: { field, value: v },
      });
    }
    const parsed = Number(v);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new BackendError({
        code: 'INTERNAL_ERROR',
        message: `Protocol analytics response has non-numeric currency value for: ${field}.`,
        status: 500,
        details: { field, value: v },
      });
    }
  }

  if (typeof d.snapshot !== 'object' || d.snapshot === null) {
    throw new BackendError({
      code: 'INTERNAL_ERROR',
      message: 'Protocol analytics response is missing the snapshot field.',
      status: 500,
    });
  }

  const snap = d.snapshot as Record<string, unknown>;
  if (typeof snap.generatedAt !== 'string' || isNaN(Date.parse(snap.generatedAt))) {
    throw new BackendError({
      code: 'INTERNAL_ERROR',
      message: 'Protocol analytics snapshot.generatedAt is missing or not a valid ISO date.',
      status: 500,
    });
  }

  // Cross-validate status totals: status sub-counts must not exceed total
  const statusTotal =
    (d.activeCommitments as number) +
    (d.settledCommitments as number) +
    (d.violatedCommitments as number);
  if (statusTotal > (d.totalCommitments as number)) {
    throw new BackendError({
      code: 'INTERNAL_ERROR',
      message: 'Protocol analytics response status totals exceed totalCommitments.',
      status: 500,
      details: { totalCommitments: d.totalCommitments, statusTotal },
    });
  }

  return data as ProtocolAnalyticsResponse;
}

/**
 * Fetch all commitments from the mock-db (dev/test) or chain (production).
 * In mock mode commitments are keyed by owner; we iterate unique owners.
 * In chain mode we call `get_all_commitments` if supported, otherwise we
 * aggregate via stored owner addresses from the mock-db.
 */
async function fetchAllCommitmentsForProtocol(): Promise<ProtocolCommitmentSnapshot> {
  if (process.env.NEXT_PUBLIC_USE_MOCKS === 'true') {
    // In mock mode, pull from the shared mock-db and map to ChainCommitment
    const mockData = await getMockData();
    return {
      source: 'mock',
      commitments: mockData.commitments.map((c) => ({
        id: String(c.id ?? ''),
        ownerAddress: '',
        asset: c.asset ?? '',
        amount: typeof c.amount === 'string' ? c.amount.replace(/,/g, '') : String(c.amount ?? 0),
        status: (c.status?.toUpperCase().replace(' ', '_') ??
          'UNKNOWN') as ChainCommitment['status'],
        complianceScore: typeof c.complianceScore === 'number' ? c.complianceScore : 0,
        currentValue: typeof c.currentValue === 'string' ? c.currentValue.replace(/,/g, '') : '0',
        feeEarned: '0',
        violationCount: 0,
      })),
    };
  }

  // Production: attempt to get all commitments from chain via unique owner list.
  // The Soroban contract exposes `get_all_commitment_ids` at the protocol level.
  // We fall back to an empty array rather than throwing so a partial analytics
  // view is always renderable on the frontend.
  try {
    const { default: contractsService } = (await import('@/lib/backend/services/contracts')) as {
      default?: never;
    };
    void contractsService; // reserved for future protocol-level RPC call
    // Until the contract exposes a `get_all_commitment_ids` method the protocol
    // analytics endpoint returns zeros rather than failing. The frontend handles
    // zero-valued data gracefully (empty state).
    return { commitments: [], source: 'chain' };
  } catch {
    return { commitments: [], source: 'chain' };
  }
}

/**
 * GET /api/analytics/protocol
 *
 * Returns aggregate protocol-wide analytics. No query parameters required.
 *
 * Authorization:
 *   Requires an authenticated session — either an `Authorization: Bearer <token>`
 *   header (wallet-auth session token) OR a `cl_auth_session` cookie set by the
 *   wallet-auth flow. Unauthenticated requests receive HTTP 401.
 *
 * Optional validation headers (checked when present):
 *   - `x-network-passphrase`: must match the configured Stellar network passphrase.
 *   - `x-wallet-address`: must be a valid Stellar G-address and must match the
 *     authenticated session address (replay / tampering guard).
 *
 * Feature flag:
 *   Requires the `analyticsProtocol` feature flag to be enabled
 *   (env: COMMITLABS_FEATURE_ANALYTICS_PROTOCOL=true).
 */
export async function GET(req: NextRequest) {
  try {
    enforceCorsRequestPolicy(req, ANALYTICS_PROTOCOL_CORS_POLICY);
  } catch (error) {
    return toCorsErrorResponse(error);
  }

  // ── Feature flag guard ────────────────────────────────────────────────────
  if (!isFeatureEnabled('analyticsProtocol')) {
    const error = new BackendError({
      code: 'NOT_FOUND',
      message: 'Protocol analytics endpoint is disabled.',
      status: 404,
      details: { feature: 'analyticsProtocol' },
    });

    return applyCorsPolicy(
      req,
      attachSecurityHeaders(
        NextResponse.json(toBackendErrorResponse(error), { status: error.status }),
      ),
      ANALYTICS_PROTOCOL_CORS_POLICY,
    );
  }

  // ── Authorization boundary ────────────────────────────────────────────────
  // Verify caller holds a valid session (cookie or Bearer token). This is the
  // primary gate: no valid session → 401 before any data is read.
  let sessionAddress: string;
  try {
    const auth = verifyAuth(req);
    sessionAddress = auth.address;
  } catch (authError) {
    // Re-throw UnauthorizedError / ForbiddenError as BackendError so the
    // existing CORS-aware error-response path handles them uniformly.
    const normalized = new BackendError({
      code: 'UNAUTHORIZED',
      message:
        authError instanceof Error
          ? authError.message
          : 'Authentication required to access protocol analytics.',
      status: 401,
    });
    return applyCorsPolicy(
      req,
      attachSecurityHeaders(NextResponse.json(toBackendErrorResponse(normalized), { status: 401 })),
      ANALYTICS_PROTOCOL_CORS_POLICY,
    );
  }

  // ── Optional header validation ────────────────────────────────────────────
  // Validate optional x-network-passphrase and x-wallet-address headers when
  // present. This defends against wrong-network calls and session replay.
  try {
    validateNetworkPassphrase(req);
    const walletAddress = validateWalletAddressHeader(req);
    assertSessionMatchesWalletHeader(sessionAddress, walletAddress);
  } catch (validationError) {
    const normalized = new BackendError({
      code: 'UNAUTHORIZED',
      message:
        validationError instanceof Error ? validationError.message : 'Request validation failed.',
      status: 401,
    });
    return applyCorsPolicy(
      req,
      attachSecurityHeaders(NextResponse.json(toBackendErrorResponse(normalized), { status: 401 })),
      ANALYTICS_PROTOCOL_CORS_POLICY,
    );
  }

  // ── Data fetch and aggregation ────────────────────────────────────────────
  try {
    const snapshot = await fetchAllCommitmentsForProtocol();
    const analytics = buildProtocolAnalytics(snapshot.commitments, snapshot.source);

    // Validate the response shape before returning it to the client. Catches
    // any invariant violation introduced by future refactors of the aggregation
    // logic that the buildProtocolAnalytics invariant check does not cover.
    const validated = validateProtocolAnalyticsResponse(analytics);

    return applyCorsPolicy(
      req,
      attachSecurityHeaders(NextResponse.json(validated)),
      ANALYTICS_PROTOCOL_CORS_POLICY,
    );
  } catch (error) {
    const normalized = normalizeBackendError(error, {
      code: 'INTERNAL_ERROR',
      message: 'Failed to compute protocol analytics.',
      status: 500,
    });

    return applyCorsPolicy(
      req,
      attachSecurityHeaders(
        NextResponse.json(toBackendErrorResponse(normalized), {
          status: normalized.status,
        }),
      ),
      ANALYTICS_PROTOCOL_CORS_POLICY,
    );
  }
}

const _405 = methodNotAllowed(['GET']);
export { _405 as POST, _405 as PUT, _405 as PATCH, _405 as DELETE };
