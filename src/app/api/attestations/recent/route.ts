
/**
 * GET /api/attestations/recent
 *
 * Returns the most recent attestations, sorted by timestamp descending.
 *
 * Query parameters:
 *   limit        {number}  Max number of results to return. Must be 1–100. Defaults to 10.
 *   ownerAddress {string}  (Optional) Filter attestations by commitment owner address.
 *                          Requires authentication when provided.
 *
 * Response shape:
 * ```json
 * {
 *   "success": true,
 *   "data": {
 *     "attestations": [ ...Attestation[] ],
 *     "total": 3
 *   },
 *   "meta": { "limit": 10 }
 * }
 * ```
 *
 * Error codes:
 *   400 VALIDATION_ERROR   — limit is out of range or ownerAddress is malformed
 *   401 UNAUTHORIZED       — ownerAddress filter requested without a valid session token
 *   429 TOO_MANY_REQUESTS  — rate limit exceeded
 */

import { NextRequest } from 'next/server';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok } from '@/lib/backend/apiResponse';
import { getMockData } from '@/lib/backend/mockDb';
import {
  ValidationError,
  TooManyRequestsError,
  UnauthorizedError,
} from '@/lib/backend/errors';
import type { Attestation } from '@/lib/types/domain';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 10;
const MIN_LIMIT = 1;
const MAX_LIMIT = 100;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse and validate the `limit` query parameter.
 * Returns the parsed integer, or the default if the param is absent.
 * Throws ValidationError for out-of-range or non-integer values.
 */
function parseLimit(searchParams: URLSearchParams): number {
  const raw = searchParams.get('limit');
  if (raw === null) return DEFAULT_LIMIT;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || !Number.isFinite(parsed)) {
    throw new ValidationError(
      `"limit" must be an integer between ${MIN_LIMIT} and ${MAX_LIMIT}.`,
      { field: 'limit', received: raw }
    );
  }
  if (parsed < MIN_LIMIT || parsed > MAX_LIMIT) {
    throw new ValidationError(
      `"limit" must be between ${MIN_LIMIT} and ${MAX_LIMIT}. Received: ${parsed}.`,
      { field: 'limit', min: MIN_LIMIT, max: MAX_LIMIT, received: parsed }
    );
  }
  return parsed;
}

/**
 * Validate the optional `ownerAddress` query parameter.
 * Returns the trimmed address string, or undefined if absent.
 * Throws ValidationError if the value is present but blank.
 */
function parseOwnerAddress(searchParams: URLSearchParams): string | undefined {
  const raw = searchParams.get('ownerAddress');
  if (raw === null) return undefined;

  const trimmed = raw.trim();
  if (trimmed === '') {
    throw new ValidationError(
      '"ownerAddress" must be a non-empty string when provided.',
      { field: 'ownerAddress' }
    );
  }
  return trimmed;
}

/**
 * Resolve a session token from the Authorization header.
 * Returns the token string, or null if the header is absent / malformed.
 */
function extractBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization') ?? '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

/**
 * Sort attestations by their timestamp field, newest first.
 * Attestations without a timestamp are sorted to the end.
 */
function sortByTimestampDesc(attestations: Attestation[]): Attestation[] {
  return [...attestations].sort((a, b) => {
    const ta = a.observedAt ? new Date(a.observedAt).getTime() : 0;
    const tb = b.observedAt ? new Date(b.observedAt).getTime() : 0;
    return tb - ta;
  });
}

// ─── Route handler ────────────────────────────────────────────────────────────

export const GET = withApiHandler(async (req: NextRequest) => {
  const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'anonymous';

  const isAllowed = await checkRateLimit(ip, 'api/attestations/recent');
  if (!isAllowed) {
    throw new TooManyRequestsError();
  }

  const { searchParams } = new URL(req.url);

  const limit = parseLimit(searchParams);
  const ownerAddress = parseOwnerAddress(searchParams);

  // ownerAddress filter requires authentication to prevent enumeration attacks
  if (ownerAddress !== undefined) {
    const token = extractBearerToken(req);
    if (!token) {
      throw new UnauthorizedError(
        'Authentication is required to filter attestations by ownerAddress.'
      );
    }
    // TODO: validate token against session store (JWT / Redis) in production
  }

  const { attestations } = await getMockData();

  // Filter by ownerAddress if provided.
  // The mock Attestation type does not carry ownerAddress directly; we match
  // against the `details.ownerAddress` field that upstream services may populate.
  const filtered: Attestation[] = ownerAddress
    ? attestations.filter(
        (a) =>
          typeof a.details?.ownerAddress === 'string' &&
          a.details.ownerAddress.toLowerCase() === ownerAddress.toLowerCase()
      )
    : attestations;

  const sorted = sortByTimestampDesc(filtered);
  const sliced = sorted.slice(0, limit);

  return ok(
    { attestations: sliced, total: filtered.length },
    { limit }
  );
});
