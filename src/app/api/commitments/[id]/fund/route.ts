import { NextRequest, NextResponse } from 'next/server';
/**
 * POST /api/commitments/[id]/fund
 *
 * ## Idempotency & State Invariants
 *
 * Funding requests are strictly idempotent: repeated requests with the same
 * Idempotency-Key return the same response without creating duplicate ledger effects.
 *
 * ### State Machine Invariants
 * - Only CREATED commitments can be funded (precondition invariant)
 * - Funding transitions state to FUNDED (postcondition invariant)
 * - No state regression: state never reverts from FUNDED to CREATED
 * - Ownership is immutable: only ownerAddress can fund
 *
 * ### Authorization Invariants
 * - Caller identity is derived from the server-side session token, never
 *   trusted from the request body alone.
 * - When callerAddress is supplied in the body it is cross-checked against the
 *   session identity to prevent tampered-body spoofing.
 * - Address format is validated against the canonical Stellar public-key regex
 *   before reaching any business logic.
 * - Network passphrase (when supplied) must match the server configuration to
 *   catch wrong-network wallet submissions.
 *
 * ### Concurrent Request Bounds
 * - Max 100 concurrent funding operations per route
 * - Exceeding bound returns 503 with degraded telemetry
 * - Individual caller rate limit: per IP (from global rate limiter)
 *
 * ### Retry & Recovery
 * - STARTED idempotency records block concurrent retries (prevent duplicate txs)
 * - COMPLETED records are cached for 24 hours (default TTL)
 * - FAILED records are deleted (allow immediate retry)
 * - Network failures expose via X-Telemetry-Status header
 *
 * ### Idempotency Key Bounds
 * - Keys are capped at MAX_IDEMPOTENCY_KEY_LENGTH characters to prevent
 *   storage inflation from hostile oversized values.
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok, methodNotAllowed } from '@/lib/backend/apiResponse';
import { assertMutationCsrf } from '@/lib/backend/csrf';
import { createCorsOptionsHandler, type CorsRoutePolicy } from '@/lib/backend/cors';
import {
  BackendError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  TooManyRequestsError,
  ValidationError,
  toBackendErrorResponse,
} from '@/lib/backend/errors';
import { getClientIp } from '@/lib/backend/getClientIp';
import { fundEscrowOnChain, getCommitmentFromChain } from '@/lib/backend/services/contracts';
import { checkRateLimit, getRateLimitWindowSeconds } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { idempotencyService } from '@/lib/backend/idempotency';
import { diagnosticsService } from '@/lib/backend/diagnostics';
import { verifyAuth } from '@/lib/backend/requireAuth';
import { getBackendConfig } from '@/lib/backend/config';
import { validateStellarAddress, validateCommitmentId } from '@/lib/backend/validation';
import { randomUUID } from 'crypto';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Maximum byte length for an idempotency key.  Unbounded keys could be used
 * to inflate in-memory/KV storage without meaningful semantic value.
 */
const MAX_IDEMPOTENCY_KEY_LENGTH = 128;

/**
 * Bound for concurrent funding operations.
 * Prevents resource exhaustion during high load or DDoS.
 */
const MAX_CONCURRENT_FUNDING_OPS = 100;

/**
 * Maximum duration for fund operation before considered slow/degraded.
 */
const FUND_OPERATION_SLOW_THRESHOLD_MS = 30000;

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

/**
 * `callerAddress` is optional: when omitted the route falls back to the
 * address extracted from the verified server-side session token.  When
 * provided it must be a syntactically-valid Stellar public key; the route
 * then additionally checks it matches the session identity.
 *
 * `network` is optional: when supplied it must equal the server-configured
 * network passphrase, catching wrong-network submissions before any on-chain
 * call is attempted.
 */
const FundRequestSchema = z.object({
  callerAddress: z.string().min(1).optional(),
  network: z.string().optional(),
});

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

const COMMITMENT_FUND_CORS_POLICY = {
  POST: { access: 'first-party' },
} satisfies CorsRoutePolicy;

export const OPTIONS = createCorsOptionsHandler(COMMITMENT_FUND_CORS_POLICY);

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const POST = withApiHandler(
  async (req: NextRequest, { params }, correlationId) => {
    const operationId = randomUUID();
    const telemetry = diagnosticsService.startOperation(
      operationId,
      'fund_commitment',
      MAX_CONCURRENT_FUNDING_OPS,
    );

    if (telemetry.status === 'degraded') {
      diagnosticsService.completeOperation(operationId, 'degraded', telemetry.failureReason);
      const response = new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Funding service temporarily degraded. Too many concurrent requests.',
            requestId: correlationId,
          },
        }),
        { status: 503 },
      );
      response.headers.set('X-Telemetry-Status', 'degraded');
      return response;
    }

    try {
      // --- CSRF ---------------------------------------------------------------
      assertMutationCsrf(req);

      // --- Rate limit ---------------------------------------------------------
      const ip = getClientIp(req);
      if (!(await checkRateLimit(ip, 'api/commitments/fund'))) {
        throw new TooManyRequestsError(
          'Too many requests. Please try again later.',
          undefined,
          getRateLimitWindowSeconds('api/commitments/fund'),
        );
      }

      // --- Route parameter validation -----------------------------------------
      const id = validateCommitmentId(params.id);

      // --- Idempotency key validation ------------------------------------------
      const idempotencyKey = req.headers.get('idempotency-key');
      let isIdempotentRetry = false;

      if (idempotencyKey) {
        if (idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
          throw new ValidationError(
            `Idempotency-Key must not exceed ${MAX_IDEMPOTENCY_KEY_LENGTH} characters`,
          );
        }
        const record = await idempotencyService.getRecord(idempotencyKey);
        if (record) {
          isIdempotentRetry = true;
          if (record.status === 'COMPLETED') {
            diagnosticsService.completeOperation(operationId, 'success', undefined, {
              cacheHit: true,
              idempotent: true,
            });
            const response = ok(record.response, undefined, record.statusCode, correlationId);
            response.headers.set('X-Idempotent-Replay', 'true');
            return response;
          } else if (record.status === 'STARTED') {
            diagnosticsService.completeOperation(
              operationId,
              'degraded',
              'Concurrent idempotent request already processing',
              { idempotencyKey },
            );
            throw new ConflictError(
              'A request with this Idempotency-Key is currently processing. Please retry after a brief delay.',
            );
          }
        }
        await idempotencyService.start(idempotencyKey);
      }

      // --- Body parsing -------------------------------------------------------
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        throw new ValidationError('Invalid JSON in request body');
      }

      const validation = FundRequestSchema.safeParse(body);
      if (!validation.success) {
        throw new ValidationError('Invalid request data', validation.error.issues);
      }

      const { callerAddress: bodyAddress, network: clientNetwork } = validation.data;

      // --- Stellar address format validation ----------------------------------
      if (bodyAddress !== undefined) {
        validateStellarAddress(bodyAddress, 'callerAddress');
      }

      // --- Network passphrase check -------------------------------------------
      if (clientNetwork !== undefined) {
        const { networkPassphrase } = getBackendConfig();
        if (!clientNetwork || clientNetwork !== networkPassphrase) {
          throw new ValidationError(
            'Client network passphrase does not match server configuration',
            { expected: networkPassphrase, received: clientNetwork },
          );
        }
      }

      // --- Session-based authorization ----------------------------------------
      // Derive the authenticated wallet identity from the server-side session
      // token (Bearer header or session cookie).  We do NOT rely solely on the
      // client-supplied callerAddress to establish identity.
      const auth = verifyAuth(req);
      const sessionAddress = auth.address;

      if (bodyAddress !== undefined && bodyAddress !== sessionAddress) {
        throw new ForbiddenError(
          'callerAddress in request body does not match the authenticated session identity',
          { commitmentId: id },
        );
      }

      const callerAddress = sessionAddress;

      // --- Commitment state validation ----------------------------------------
      const commitment = await getCommitmentFromChain(id);

      if (!commitment) {
        throw new NotFoundError('Commitment', { commitmentId: id });
      }

      // INVARIANT: Only CREATED commitments can transition to FUNDED
      if (commitment.status !== 'CREATED') {
        const statusError = new ConflictError(
          `Cannot fund commitment in ${commitment.status} state. Only CREATED commitments can be funded.`,
          { commitmentId: id, currentStatus: commitment.status },
        );
        diagnosticsService.completeOperation(
          operationId,
          'failure',
          `Invalid state: ${commitment.status}`,
          { commitmentId: id },
        );
        throw statusError;
      }

      // --- Ownership check (server-side) --------------------------------------
      // Ownership is verified against the on-chain record, not inferred from
      // client state.
      if (callerAddress !== commitment.ownerAddress) {
        const authError = new ForbiddenError(
          'Only the commitment owner may fund this commitment',
          { commitmentId: id },
        );
        diagnosticsService.completeOperation(
          operationId,
          'failure',
          'Authorization failed: caller is not owner',
          { commitmentId: id },
        );
        throw authError;
      }

      // --- Numeric commitment amount sanity check -----------------------------
      const numericAmount = Number(commitment.amount);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        throw new ValidationError('Commitment amount from chain is invalid or non-positive', {
          amount: commitment.amount,
          commitmentId: id,
        });
      }

      // --- On-chain funding ---------------------------------------------------
      const funded = await fundEscrowOnChain({
        commitmentId: id,
        callerAddress,
      });

      // --- Server response shape validation -----------------------------------
      if (funded.commitmentId !== id) {
        throw new ValidationError('Chain service returned mismatched commitmentId', {
          expected: id,
          received: funded.commitmentId,
        });
      }
      if (funded.txHash !== undefined && typeof funded.txHash !== 'string') {
        throw new ValidationError('Chain service returned invalid txHash type');
      }

      const fundedAt = new Date().toISOString();

      const responseData = {
        commitmentId: id,
        txHash: funded.txHash,
        reference: funded.reference,
        fundedAt,
      };

      if (idempotencyKey) {
        await idempotencyService.complete(idempotencyKey, responseData, 200);
      }

      const duration = Date.now() - telemetry.startTime;
      const isSlow = duration > FUND_OPERATION_SLOW_THRESHOLD_MS;

      diagnosticsService.completeOperation(
        operationId,
        isSlow ? 'degraded' : 'success',
        undefined,
        {
          duration,
          idempotent: isIdempotentRetry,
          slow: isSlow,
          txHash: funded.txHash,
        },
      );

      const response = ok(responseData, undefined, 200, correlationId);
      if (isSlow) {
        response.headers.set('X-Telemetry-Status', 'slow');
      }
      return response;
    } catch (error) {
      if (idempotencyKey) {
        await idempotencyService.fail(idempotencyKey);
      }

      if (error instanceof BackendError) {
        return NextResponse.json(toBackendErrorResponse(error), { status: error.status });
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error during funding operation';
      diagnosticsService.completeOperation(operationId, 'failure', errorMessage, {
        errorType: error instanceof Error ? error.constructor.name : typeof error,
      });

      throw error;
    }
  },
  { cors: COMMITMENT_FUND_CORS_POLICY },
);

const _405 = methodNotAllowed(['POST']);
export { _405 as GET, _405 as PUT, _405 as PATCH, _405 as DELETE };
