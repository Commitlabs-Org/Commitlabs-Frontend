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
const MIN_INTERVAL = 1000;

const EVENTS_CORS_POLICY = {
  GET: { access: 'first-party' },
} satisfies CorsRoutePolicy;

export const OPTIONS = createCorsOptionsHandler(EVENTS_CORS_POLICY);

export function mapStatus(status: unknown): CommitmentStatus | 'Unknown' {
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

export function shouldEmitStatusTransition(
  previousStatus: CommitmentStatus | 'Unknown',
  currentStatus: CommitmentStatus | 'Unknown',
): boolean {
  if (previousStatus === 'Unknown' && currentStatus === 'Unknown') {
    return false;
  }

  return previousStatus !== currentStatus;
}

const validateInterval = (value: string | undefined, defaultValue: number) => {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < MIN_INTERVAL) return defaultValue;
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

    const encoder = new TextEncoder();
    let pollIntervalId: NodeJS.Timeout | null = null;
    let keepaliveIntervalId: NodeJS.Timeout | null = null;
    let isClosed = false;

    const stream = new ReadableStream({
      async start(controller) {
        let lastStatus = mapStatus(initialCommitment.status);
        let checkInFlight = false;
        let latestRequestId = 0;

        const enqueueEvent = (eventName: string, payload: Record<string, unknown>) => {
          if (isClosed) return;
          controller.enqueue(
            encoder.encode(`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`),
          );
        };

        const snapshotPayload = {
          commitmentId,
          status: lastStatus,
          timestamp: new Date().toISOString(),
        };
        enqueueEvent('snapshot', snapshotPayload);

        const cleanup = () => {
          if (isClosed) return;
          isClosed = true;
          if (pollIntervalId) clearInterval(pollIntervalId);
          if (keepaliveIntervalId) clearInterval(keepaliveIntervalId);
          try {
            controller.close();
          } catch {
            // Stream already closed
          }
        };

        req.signal.addEventListener('abort', () => {
          cleanup();
        });

        const checkStatus = async () => {
          if (isClosed || checkInFlight) return;

          const requestId = ++latestRequestId;
          checkInFlight = true;

          try {
            const commitment = await getCommitmentFromChain(commitmentId);
            if (requestId !== latestRequestId) {
              return;
            }

            if (!commitment) {
              enqueueEvent('error', { message: 'Commitment not found' });
              cleanup();
              return;
            }

            const currentStatus = mapStatus(commitment.status);
            if (!shouldEmitStatusTransition(lastStatus, currentStatus)) {
              return;
            }

            lastStatus = currentStatus;
            enqueueEvent('status_change', {
              commitmentId,
              status: currentStatus,
              timestamp: new Date().toISOString(),
            });
          } catch {
            // Ignore transient indexer/chain read failures; the next poll retry may recover the state.
          } finally {
            if (!isClosed && requestId === latestRequestId) {
              checkInFlight = false;
            }
          }
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
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  },
  { cors: EVENTS_CORS_POLICY },
);
