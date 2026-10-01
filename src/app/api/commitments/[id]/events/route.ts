/**
 * Commitment events API (SSE).
 *
 * Contract:
 * - GET /api/commitments/[id]/events returns a Server-Sent Events stream.
 * - Events include: snapshot, status_change, error, and keepalive comments.
 * - Each event carries an `id:` line for Last-Event-ID reconnection support.
 * - Clients should reconnect on connection loss and send `Last-Event-ID`.
 * - The stream is read-only; authorization is enforced via requireAuth.
 * - Polling, keepalive, and retry intervals are configurable via env vars:
 *   SSE_POLL_INTERVAL_MS (default 5000, min 1000)
 *   SSE_KEEPALIVE_INTERVAL_MS (default 30000, min 1000)
 *   SSE_RETRY_MS (default 3000, min 1000)
 * - Optional `format=json` query param returns a paginated JSON event list.
 * - Pagination uses `page` (1-based) and `pageSize` (default 10, min 1).
 * - JSON response shape: `{ events, page, pageSize, total, hasMore }`.
 * - If `page` is out of range, `events` is an empty array; `hasMore` is false.
 * - Invalid `page`/`pageSize` values fall back to defaults (`page=1`, `pageSize=10`).
 */
import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/backend/requireAuth';
import { NotFoundError } from '@/lib/backend/errors';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { getCommitmentFromChain } from '@/lib/backend/services/contracts';
import { createCorsOptionsHandler, type CorsRoutePolicy } from '@/lib/backend/cors';
import { CommitmentStatus } from '@/types/commitment';
import { checkRateLimit } from '@/lib/backend/rateLimit';

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

export const parsePositiveInt = (value: string | null, defaultValue: number, min = 1) => {
  if (value === null) return defaultValue;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min) return defaultValue;
  return parsed;
};

export const GET = withApiHandler(
  async (req: NextRequest, context: { params: { id: string } }) => {
    requireAuth(req);

    const ip = req.headers.get('x-forwarded-for') ?? 'anonymous';
    if (!(await checkRateLimit(ip, 'api/commitments/events'))) {
      return new Response('Too many requests', { status: 429 });
    }

    const commitmentId = context.params.id;
    if (!commitmentId) {
      throw new NotFoundError('Commitment');
    }

    let initialCommitment;
    try {
      initialCommitment = await getCommitmentFromChain(commitmentId);
    } catch {
      throw new NotFoundError('Commitment', { commitmentId });
    }

    if (!initialCommitment) {
      throw new NotFoundError('Commitment', { commitmentId });
    }

    // JSON mode for paginated event history (supports ?format=json&page=&pageSize=)
    if (req.nextUrl.searchParams.get('format') === 'json') {
      const page = parsePositiveInt(req.nextUrl.searchParams.get('page'), 1, 1);
      const pageSize = parsePositiveInt(req.nextUrl.searchParams.get('pageSize'), 10, 1);
      const status = mapStatus(initialCommitment.status);
      const snapshotEvent = {
        id: getEventId('snapshot'),
        type: 'snapshot',
        data: {
          commitmentId,
          status,
          timestamp: new Date().toISOString(),
        },
      };
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

    const encoder = new TextEncoder();
    let pollIntervalId: NodeJS.Timeout | null = null;
    let keepaliveIntervalId: NodeJS.Timeout | null = null;
    let isClosed = false;
    let abortHandler: (() => void) | null = null;

    const stream = new ReadableStream({
      async start(controller) {
        if (req.signal.aborted) {
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
          if (abortHandler) req.signal.removeEventListener('abort', abortHandler);
          try {
            controller.close();
          } catch {
            // Stream already closed
          }
        };

        abortHandler = () => {
          cleanup();
        };
        req.signal.addEventListener('abort', abortHandler);

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
        if (abortHandler) req.signal.removeEventListener('abort', abortHandler);
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
  },
  { cors: EVENTS_CORS_POLICY },
);
