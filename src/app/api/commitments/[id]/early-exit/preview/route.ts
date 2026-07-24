import { NextRequest } from "next/server";
import { ok } from "@/lib/backend/apiResponse";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  TooManyRequestsError,
} from "@/lib/backend/errors";
import { withApiHandler } from "@/lib/backend/withApiHandler";
import { checkRateLimit } from "@/lib/backend/rateLimit";
import { getCommitmentFromChain } from "@/lib/backend/services/contracts";
import {
  getProtocolConstants,
  PenaltyTier,
} from "@/lib/backend/services/protocolConstants";

/**
 * GET /api/commitments/{id}/early-exit/preview
 *
 * Returns a preview of the early‑exit penalty for a specific commitment.
 * The calculation uses the penalty tiers defined in `protocolConstants.ts` and
 * the commitment data fetched from the blockchain.
 */
function getPenaltyPercent(
  commitment: Record<string, any>,
  tier: PenaltyTier,
): number {
  const basePenaltyPercent = tier.earlyExitPenaltyPercent;
  const createdAtMs = new Date(commitment.createdAt ?? "").getTime();
  const expiresAtMs = new Date(commitment.expiresAt ?? "").getTime();

  if (
    !Number.isFinite(createdAtMs) ||
    !Number.isFinite(expiresAtMs) ||
    expiresAtMs <= createdAtMs
  ) {
    return basePenaltyPercent;
  }

  const now = Date.now();
  if (now >= expiresAtMs) {
    return 0;
  }

  if (now <= createdAtMs) {
    return basePenaltyPercent;
  }

  const totalDurationMs = expiresAtMs - createdAtMs;
  const remainingDurationMs = expiresAtMs - now;
  const scaledPenaltyPercent =
    basePenaltyPercent * (remainingDurationMs / totalDurationMs);

  return +Math.max(
    0,
    Math.min(basePenaltyPercent, scaledPenaltyPercent),
  ).toFixed(4);
}

export const GET = withApiHandler(async (req: NextRequest, { params }) => {
  const ip = req.ip ?? req.headers.get("x-forwarded-for") ?? "anonymous";
  const allowed = await checkRateLimit(
    ip,
    "api/commitments/early-exit/preview",
  );
  if (!allowed) {
    throw new TooManyRequestsError("Rate limit exceeded");
  }

  const commitmentId = params.id?.trim();
  if (!commitmentId) {
    throw new BadRequestError("Missing commitment id");
  }

  const commitment = await getCommitmentFromChain(commitmentId).catch(() => {
    throw new NotFoundError("Commitment", { commitmentId });
  });

  if (!commitment) {
    throw new NotFoundError("Commitment", { commitmentId });
  }

  if (commitment.status === "SETTLED") {
    throw new ConflictError("Commitment has already been settled");
  }

  if (commitment.status === "VIOLATED") {
    throw new ConflictError(
      "Commitment has been violated and cannot be exited early",
    );
  }

  if (commitment.status !== "ACTIVE") {
    throw new ConflictError(
      "Commitment must be active to preview an early exit",
    );
  }

  const protocol = getProtocolConstants();
  const defaultTier = protocol.penalties[0];
  if (!defaultTier) {
    throw new ConflictError("Protocol penalty configuration is missing");
  }
  const tier: PenaltyTier = (commitment as any).type
    ? (protocol.penalties.find((t) => t.type === (commitment as any).type) ?? defaultTier)
    : defaultTier;

  const principal = Number(commitment.amount);
  const penaltyPercent = getPenaltyPercent(
    commitment as Record<string, any>,
    tier,
  );
  const penaltyAmount = +(principal * (penaltyPercent / 100)).toFixed(2);
  const netRefund = +(principal - penaltyAmount).toFixed(2);

  return ok({
    principal,
    penaltyPercent,
    penaltyAmount,
    netRefund,
  });
});
