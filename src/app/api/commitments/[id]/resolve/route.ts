import { NextRequest } from 'next/server';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok, methodNotAllowed } from '@/lib/backend/apiResponse';
import { assertMutationCsrf } from '@/lib/backend/csrf';
import { TooManyRequestsError, ValidationError } from '@/lib/backend/errors';
import { getClientIp } from '@/lib/backend/getClientIp';
import { resolveDisputeOnChain } from '@/lib/backend/services/contracts';
import { logDisputeResolved } from '@/lib/backend/logger';
import { recordAuditEvent } from '@/lib/backend/auditLog';
import { requireAdmin } from '@/lib/backend/requireAuth';
import { validateCommitmentId } from '@/lib/backend/validation';

const ResolveDisputeRequestSchema = z.object({
  resolution: z.enum([
    'resolved_in_favor_of_owner',
    'resolved_in_favor_of_counterparty',
    'dismissed',
  ]),
  notes: z.string().max(1000).optional(),
});

/**
 * POST /api/commitments/[id]/resolve
 *
 * Admin-only. Enforces, in order of increasing cost:
 * 1. CSRF / same-origin boundary for cookie-session mutations.
 * 2. Admin authorization (requireAdmin) before any parsing or chain work.
 * 3. Rate limit on the caller.
 * 4. Route-parameter (commitment id) validation against hostile input.
 * 5. Request-body validation.
 */
export const POST = withApiHandler(async (req: NextRequest, { params }, correlationId) => {
  assertMutationCsrf(req);

  const admin = requireAdmin(req);

  const ip = getClientIp(req);
  if (!(await checkRateLimit(ip, 'api/commitments/resolve'))) {
    throw new TooManyRequestsError();
  }

  const id = validateCommitmentId(params.id, 'Commitment ID');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ValidationError('Invalid JSON in request body');
  }

  const validation = ResolveDisputeRequestSchema.safeParse(body);
  if (!validation.success) {
    throw new ValidationError('Invalid request data', validation.error.issues);
  }

  const { resolution, notes } = validation.data;

  try {
    const resolveResult = await resolveDisputeOnChain({
      commitmentId: id,
      resolution,
      notes: notes ?? '',
      resolverAddress: admin.address,
    });

    logDisputeResolved({
      ip,
      commitmentId: id,
      resolution,
      resolverAddress: admin.address,
      disputeId: resolveResult.disputeId,
      txHash: resolveResult.txHash,
    });

    recordAuditEvent({
      eventType: 'DISPUTE_RESOLVED',
      actorAddress: admin.address,
      commitmentId: id,
      details: {
        resolution,
        notes: notes ?? '',
        disputeId: resolveResult.disputeId,
        txHash: resolveResult.txHash,
      },
    });

    return ok(
      {
        commitmentId: id,
        disputeId: resolveResult.disputeId,
        resolution: resolveResult.resolution,
        finalStatus: resolveResult.finalStatus,
        txHash: resolveResult.txHash,
        resolvedAt: resolveResult.resolvedAt,
      },
      undefined,
      200,
      correlationId,
    );
  } catch (error) {
    logDisputeResolved({
      ip,
      commitmentId: id,
      resolution,
      resolverAddress: admin.address,
      error: error instanceof Error ? error.message : 'Unknown resolution error',
    });

    throw error;
  }
});

const _405 = methodNotAllowed(['POST']);
export { _405 as GET, _405 as PUT, _405 as PATCH, _405 as DELETE };
