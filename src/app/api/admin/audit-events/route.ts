/**
 * GET /api/admin/audit-events
 *
 * Returns recent audit events for admin investigations.
 * Disabled by default — requires the COMMITLABS_FEATURE_AUDIT_LOG feature flag.
 *
 * Authorization:
 *   Requires the request to carry a valid admin token in the Authorization header:
 *   `Authorization: Bearer <COMMITLABS_ADMIN_SECRET>`
 *
 *   The admin secret is read from the COMMITLABS_ADMIN_SECRET environment variable.
 *   If the variable is not set the endpoint always returns 403 (fail-secure).
 *
 * Query parameters:
 *   limit  {number}  Max events to return. Must be 1–200. Defaults to 50.
 *
 * Response shape:
 * ```json
 * {
 *   "success": true,
 *   "data": {
 *     "events": [ ...RedactedAuditEvent[] ],
 *     "total": 3
 *   },
 *   "meta": { "limit": 50 }
 * }
 * ```
 *
 * Error codes:
 *   403 FORBIDDEN          — feature disabled or missing/invalid admin token
 *   400 VALIDATION_ERROR   — limit out of range
 *   429 TOO_MANY_REQUESTS  — rate limit exceeded
 */

import { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok } from '@/lib/backend/apiResponse';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import {
  isAuditLogEnabled,
  getRecentAuditEvents,
  getAuditEventCount,
} from '@/lib/backend/auditLog';
import {
  ForbiddenError,
  TooManyRequestsError,
  ValidationError,
} from '@/lib/backend/errors';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 50;
const MIN_LIMIT = 1;
const MAX_LIMIT = 200;

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
 * Extracts the Bearer token from the Authorization header.
 * Returns null if the header is absent or malformed.
 */
function extractBearerToken(req: NextRequest): string | null {
  const header = req.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * Validates the admin token against COMMITLABS_ADMIN_SECRET.
 * Throws ForbiddenError if the token is missing, blank, or does not match.
 * Fail-secure: if the env var is not set, always throws ForbiddenError.
 */
function assertAdminAuthorized(req: NextRequest): void {
  const adminSecret = process.env.COMMITLABS_ADMIN_SECRET ?? '';

  // Fail-secure: no secret configured → always deny
  if (!adminSecret) {
    throw new ForbiddenError('Admin access is not configured.');
  }

  const token = extractBearerToken(req);
  if (!token || token !== adminSecret) {
    throw new ForbiddenError('Invalid or missing admin token.');
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export const GET = withApiHandler(async (req: NextRequest) => {
  // 1. Feature flag check — return 403 (not 404) to avoid leaking endpoint existence
  if (!isAuditLogEnabled()) {
    throw new ForbiddenError('Audit log feature is disabled.');
  }

  // 2. Rate limit
  const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'anonymous';
  const isAllowed = await checkRateLimit(ip, 'api/admin/audit-events');
  if (!isAllowed) {
    throw new TooManyRequestsError();
  }

  // 3. Admin authorization
  assertAdminAuthorized(req);

  // 4. Parse query params
  const { searchParams } = new URL(req.url);
  const limit = parseLimit(searchParams);

  // 5. Fetch and return redacted events
  const [events, total] = await Promise.all([
    getRecentAuditEvents(limit),
    getAuditEventCount(),
  ]);

  return ok({ events, total }, { limit });
});
