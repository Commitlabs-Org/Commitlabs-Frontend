/**
 * GET /api/commitments/[id]/history
 *
 * Returns a paginated, time-ordered list of lifecycle events for a commitment.
 *
 * ## Response shape
 * ```json
 * {
 *   "success": true,
 *   "data": {
 *     "commitmentId": "CMT-ABC123",
 *     "events": [
 *       {
 *         "eventId": "created:CMT-ABC123",
 *         "kind": "created",
 *         "occurredAt": "2026-01-10T00:00:00.000Z",
 *         "payload": { "asset": "XLM", "amount": "50000", "expiresAt": "..." }
 *       },
 *       {
 *         "eventId": "attestation:ATTR-001",
 *         "kind": "attestation",
 *         "occurredAt": "2026-01-11T12:00:00Z",
 *         "payload": { "attestationId": "ATTR-001", "attestationType": "health_check", ... }
 *       }
 *     ],
 *     "meta": {
 *       "page": 1,
 *       "pageSize": 20,
 *       "total": 5,
 *       "totalPages": 1,
 *       "hasNextPage": false,
 *       "hasPrevPage": false
 *     }
 *   }
 * }
 * ```
 *
 * ## Query parameters
 * | param    | type    | default | description                        |
 * |----------|---------|---------|------------------------------------|
 * | page     | integer | 1       | 1-based page number                |
 * | pageSize | integer | 20      | Items per page (max 100)           |
 *
 * ## Error responses
 * - `404` — commitment not found
 * - `400` — invalid pagination params
 * - `429` — rate limit exceeded
 */

import { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok } from '@/lib/backend/apiResponse';
import { NotFoundError, TooManyRequestsError } from '@/lib/backend/errors';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import {
  parsePaginationParams,
  paginateArray,
  paginationErrorResponse,
  PaginationParseError,
} from '@/lib/backend/pagination';
import { getCommitmentFromChain } from '@/lib/backend/services/contracts';
import { getCommitmentHistory } from '@/lib/backend/services/commitmentHistory';

const DEFAULT_HISTORY_PAGE_SIZE = 20;

export const GET = withApiHandler(async (
  req: NextRequest,
  context: { params: Record<string, string> },
) => {
  const commitmentId = context.params.id;

  const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'anonymous';
  const isAllowed = await checkRateLimit(ip, 'api/commitments/history');
  if (!isAllowed) throw new TooManyRequestsError();

  // Parse pagination
  const { searchParams } = new URL(req.url);
  let pagination;
  try {
    pagination = parsePaginationParams(searchParams, {
      defaultPageSize: DEFAULT_HISTORY_PAGE_SIZE,
    });
  } catch (err) {
    if (err instanceof PaginationParseError) {
      return paginationErrorResponse(err);
    }
    throw err;
  }

  // Resolve commitment — throws NotFoundError (→ 404) if absent
  let commitment;
  try {
    commitment = await getCommitmentFromChain(commitmentId);
  } catch {
    throw new NotFoundError('Commitment', { commitmentId });
  }

  // Aggregate history events
  const { events } = await getCommitmentHistory(commitment);

  // Paginate
  const page = paginateArray(events, pagination);

  return ok({
    commitmentId,
    events: page.data,
    meta: page.meta,
  });
});
