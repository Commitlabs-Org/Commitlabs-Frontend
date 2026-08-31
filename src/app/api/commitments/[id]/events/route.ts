/**
 * Commitment events API with strict authorization and validation.
 *
 * Authorization & Validation Invariants:
 * - Authentication: User must have valid session (checked by requireAuth)
 * - Ownership: User's wallet must match commitment's ownerAddress
 * - Route params: commitmentId must be valid Stellar contract ID
 * - Pagination: page/pageSize must be integers within bounds (1-based)
 * - Response: Chain data must match schema (commitmentId, status, ownerAddress)
 *
 * Supported modes:
 * - SSE streaming: GET /api/commitments/[id]/events
 *   Returns Server-Sent Events stream with snapshot, status_change, error, keepalive
 * - JSON pagination: GET /api/commitments/[id]/events?format=json&page=1&pageSize=10
 *   Returns paginated JSON with events, page, pageSize, total, hasMore
 *
 * Configurable intervals (env vars):
 *   SSE_POLL_INTERVAL_MS (default 5000, min 1000)
 *   SSE_KEEPALIVE_INTERVAL_MS (default 30000, min 1000)
 *   SSE_RETRY_MS (default 3000, min 1000)
 *
 * Adversarial scenarios covered:
 * - Replay attack: Pagination params are validated per-request
 * - Tampering: commitmentId, page, pageSize validated with strict bounds checking
 * - Wrong network: Chain response schema validation catches malformed data
 * - Disconnected wallet: Ownership verification ensures user still owns commitment
 * - Malformed response: Schema validation rejects invalid chain data
 */

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/backend/requireAuth';
import { NotFoundError, ValidationError } from '@/lib/backend/errors';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { getCommitmentFromChain } from '@/lib/backend/services/contracts';
import { createCorsOptionsHandler, type CorsRoutePolicy } from '@/lib/backend/cors';
import { CommitmentStatus } from '@/types/commitment';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import {
  buildCommitmentEventContext,
  type CommitmentEventContext,
} from '@/lib/backend/commitment-event-boundary';

const DEFAULT_POLL_INTERVAL = 5000;
const DEFAULT_KEEPALIVE_INTERVAL = 30000;
const DEFAULT_RETRY_INTERVAL = 3000;
const MIN_INTERVAL = 1000;

let eventCounter = 0;
export const getEventId = (prefix: string) => `evt-${prefix}-${Date.now().toString(36)}-${++eventCounter}`;

const EVENTS_CORS_POLICY = {
  GET: { access: 'first-party' },
} satisfies CorsRoutePolicy;

export const OPTIONS = createCorsOptionsHandler(EVENTS_CORS_POLICY);

export function mapStatus(status: any): CommitmentStatus | 'Unknown' {
  switch (status) {
    case 'ACTIVE':
      return 'Active';
    case 'SETTLED':
      return 'Settled';
    case 'VIOLATED':
      return 'Violated';
    case 'EARLY_EXIT':
      return 'Early Exit';
    default:
      return 'Unknown';
  }
}

export const validateInterval = (value: string | undefined, defaultValue: number) => {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < MIN_INTERVAL) return defaultValue;
  return parsed;
};

export const GET = withApiHandler(
  async (req: NextRequest, context: { params: { id: string } }) => {
    // Step 1: Verify authentication
    const authenticatedReq = requireAuth(req);
    const userAddress = authenticatedReq.user.address;

    // Step 2: Rate limit by IP
    const ip = req.headers.get('x-forwarded-for') ?? 'anonymous';
    if (!(await checkRateLimit(ip, 'api/commitments/events'))) {
      return new Response('Too many requests', { status: 429 });
    }

    // Step 3: Fetch commitment from chain (may throw NotFoundError)
    const commitmentId = context.params.id;
    let initialCommitment;
    try {
      initialCommitment = await getCommitmentFromChain(commitmentId);
    } catch (err) {
      throw new NotFoundError('Commitment', { commitmentId });
    }

    if (!initialCommitment) {
      throw new NotFoundError('Commitment', { commitmentId });
    }

    // Step 4: Build and validate authorization context
    // This checks: route params, user identity, pagination params, chain response schema, ownership
    let context_v;
    try {
      context_v = buildCommitmentEventContext(
        commitmentId,
        userAddress,
        req.nextUrl.searchParams,
        initialCommitment,
      );
    } catch (err) {
      // If it's ValidationError or ForbiddenError, let withApiHandler convert to response
      throw err;
    }

    // JSON mode for paginated event history
    if (req.nextUrl.searchParams.get('format') === 'json') {
      return handleJsonPaginationMode(context_v);
    }

    // SSE streaming mode (default)
    return handleSseStreamMode(context_v, req.signal);
  },
  { cors: EVENTS_CORS_POLICY },
);

/**
 * JSON pagination mode handler.
 * Returns: { events, page, pageSize, total, hasMore }
 */
function handleJsonPaginationMode(context: CommitmentEventContext) {
  const { commitmentId, pagination, commitment } = context;
  const { page, pageSize } = pagination;

  const status = mapStatus(commitment.status);
  const snapshotEvent = {
    id: getEventId('snapshot'),
    type: 'snapshot',
    data: {
      commitmentId,
      status,
      timestamp: new Date().toISOString(),
    },
  };

  // For now, we return a single snapshot event per page.
  // In production, this would fetch from an event store (indexer, DB, etc).
  const total = 1;
  const startIndex = (page - 1) * pageSize;
  const events = startIndex < total ? [snapshotEvent] : [];
  const hasMore = startIndex + pageSize < total;

  return Response.json({
    events,
    page,
    pageSize,
    total,
    hasMore,
  });
}

/**
 * SSE streaming mode handler.
 * Returns a Server-Sent Events stream with snapshot, status_change, error, keepalive events.
 */
function handleSseStreamMode(context: CommitmentEventContext, signal: AbortSignal) {
  const { commitmentId, commitment: initialCommitment } = context;

  const encoder = new TextEncoder();
  let pollIntervalId: NodeJS.Timeout | null = null;
  let keepaliveIntervalId: NodeJS.Timeout | null = null;
  let isClosed = false;
  let abortHandler: (() => void) | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      if (signal.aborted) {
        isClosed = true;
        try {
          controller.close();
        } catch {
          // Stream already closed
        }
        return;
      }

      let lastStatus = mapStatus(initialCommitment.status);

      const retryIntervalMs = validateInterval(
        process.env.SSE_RETRY_MS,
        DEFAULT_RETRY_INTERVAL,
      );
      const snapshotPayload = {
        commitmentId,
        status: lastStatus,
        timestamp: new Date().toISOString(),
      };
      const snapshotId = getEventId('snapshot');
      controller.enqueue(
        encoder.encode(
          `retry: ${retryIntervalMs}\nid: ${snapshotId}\nevent: snapshot\ndata: ${JSON.stringify(snapshotPayload)}\n\n`,
        ),
      );

      const cleanup = () => {
        if (isClosed) return;
        isClosed = true;
        if (pollIntervalId) clearInterval(pollIntervalId);
        if (keepaliveIntervalId) clearInterval(keepaliveIntervalId);
        if (abortHandler) signal.removeEventListener('abort', abortHandler);
        try {
          controller.close();
        } catch {
          // Stream already closed
        }
      };

      abortHandler = () => {
        cleanup();
      };
      signal.addEventListener('abort', abortHandler);

      const checkStatus = async () => {
        if (isClosed) return;
        try {
          const commitment = await getCommitmentFromChain(commitmentId);
          if (!commitment) {
            const errorId = getEventId('error');
            controller.enqueue(
              encoder.encode(
                `id: ${errorId}\nevent: error\ndata: ${JSON.stringify({ message: 'Commitment not found' })}\n\n`,
              ),
            );
            cleanup();
            return;
          }

          const currentStatus = mapStatus(commitment.status);
          if (currentStatus !== lastStatus) {
            lastStatus = currentStatus;
            const transitionPayload = {
              commitmentId,
              status: currentStatus,
              timestamp: new Date().toISOString(),
            };
            const statusChangeId = getEventId('status');
            controller.enqueue(
              encoder.encode(
                `id: ${statusChangeId}\nevent: status_change\ndata: ${JSON.stringify(transitionPayload)}\n\n`,
              ),
            );
          }
        } catch {}
      };

      const sendKeepalive = () => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'));
        } catch {
          cleanup();
        }
      };

      const pollIntervalMs = validateInterval(
        process.env.SSE_POLL_INTERVAL_MS,
        DEFAULT_POLL_INTERVAL,
      );
      const keepaliveIntervalMs = validateInterval(
        process.env.SSE_KEEPALIVE_INTERVAL_MS,
        DEFAULT_KEEPALIVE_INTERVAL,
      );

      pollIntervalId = setInterval(checkStatus, pollIntervalMs);
      keepaliveIntervalId = setInterval(sendKeepalive, keepaliveIntervalMs);
    },
    cancel() {
      isClosed = true;
      if (pollIntervalId) clearInterval(pollIntervalId);
      if (keepaliveIntervalId) clearInterval(keepaliveIntervalId);
      if (abortHandler) signal.removeEventListener('abort', abortHandler);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

