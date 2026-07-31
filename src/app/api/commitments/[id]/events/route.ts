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

function mapStatus(status: any): CommitmentStatus | 'Unknown' {
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

        const snapshotPayload = {
          commitmentId,
          status: lastStatus,
          timestamp: new Date().toISOString(),
        };
        controller.enqueue(
          encoder.encode(`event: snapshot\ndata: ${JSON.stringify(snapshotPayload)}\n\n`),
        );

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
          if (isClosed) return;
          try {
            const commitment = await getCommitmentFromChain(commitmentId);
            if (!commitment) {
              controller.enqueue(
                encoder.encode(
                  `event: error\ndata: ${JSON.stringify({ message: 'Commitment not found' })}\n\n`,
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
              controller.enqueue(
                encoder.encode(
                  `event: status_change\ndata: ${JSON.stringify(transitionPayload)}\n\n`,
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
