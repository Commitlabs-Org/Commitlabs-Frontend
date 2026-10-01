import { NextRequest } from 'next/server';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok, methodNotAllowed } from '@/lib/backend/apiResponse';
import { assertMutationCsrf } from '@/lib/backend/csrf';
import { TooManyRequestsError, ValidationError, ForbiddenError } from '@/lib/backend/errors';
import { getClientIp } from '@/lib/backend/getClientIp';
import { openDisputeOnChain } from '@/lib/backend/services/contracts';
import { logDisputeOpened } from '@/lib/backend/logger';
import { recordAuditEvent } from '@/lib/backend/auditLog';
import { validateCommitmentId } from '@/lib/backend/validation';

const DisputeRequestSchema = z.object({
  reason: z.string().min(1, 'Dispute reason is required').max(500),
  evidence: z.string().max(500).optional(),
  callerAddress: z.string().trim().min(1, 'Caller address is required').max(128).optional(),
});

/**
 * POST /api/commitments/[id]/dispute
 *
 * Enforces, in order of increasing cost:
 * 1. CSRF / same-origin boundary for cookie-session mutations.
 * 2. Rate limit on the caller.
 * 3. Route-parameter (commitment id) validation against hostile input.
 * 4. Request-body validation.
 * 5. Server-side ownership/authorization: a callerAddress must be supplied
 *    (asserted against the chain inside `openDisputeOnChain`), rather than
 *    trusting client-side state or inferring identity from the UI.
 */
export const POST = withApiHandler(async (req: NextRequest, { params }, correlationId) => {
  assertMutationCsrf(req);

  const ip = getClientIp(req);
  if (!(await checkRateLimit(ip, 'api/commitments/dispute'))) {
    throw new TooManyRequestsError();
  }

  const id = validateCommitmentId(params.id, 'Commitment ID');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ValidationError('Invalid JSON in request body');
  }

  const validation = DisputeRequestSchema.safeParse(body);
  if (!validation.success) {
    throw new ValidationError('Invalid request data', validation.error.issues);
  }

  const { reason, evidence, callerAddress } = validation.data;

  if (!callerAddress) {
    throw new ForbiddenError('A caller address is required to open a dispute.');
  }

  try {
    const disputeResult = await openDisputeOnChain({
      commitmentId: id,
      reason,
      evidence: evidence ?? '',
      callerAddress,
    });

    logDisputeOpened({
      ip,
      commitmentId: id,
      reason,
      callerAddress,
      disputeId: disputeResult.disputeId,
      txHash: disputeResult.txHash,
    });

    recordAuditEvent({
      eventType: 'DISPUTE_OPENED',
      actorAddress: callerAddress,
      commitmentId: id,
      details: {
        reason,
        evidence: evidence ?? '',
        disputeId: disputeResult.disputeId,
        txHash: disputeResult.txHash,
      },
    });

    return ok(
      {
        commitmentId: id,
        disputeId: disputeResult.disputeId,
        status: disputeResult.status,
        txHash: disputeResult.txHash,
        disputedAt: disputeResult.disputedAt,
      },
      undefined,
      200,
      correlationId,
    );
  } catch (error) {
    logDisputeOpened({
      ip,
      commitmentId: id,
      reason,
      callerAddress,
      error: error instanceof Error ? error.message : 'Unknown dispute error',
    });

    throw error;
  }
});

const _405 = methodNotAllowed(['POST']);
export { _405 as GET, _405 as PUT, _405 as PATCH, _405 as DELETE };
