/**
 * Protocol Constants Service
 *
 * Provides public protocol constants used by UX copy and calculations
 * (fees, penalty ranges, commitment limits, etc.).
 *
 * These values are sourced from environment variables (with sensible defaults)
 * and may eventually be read from on-chain contract storage.
 *
 * The result is cached in-memory for the lifetime of the process (or until
 * `invalidateProtocolConstantsCache()` is called) so that hot paths never
 * re-parse env vars.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PenaltyTier {
  /** Commitment type label (e.g. "safe", "balanced", "aggressive"). */
  type: string;
  /** Early-exit penalty as a percentage of committed amount (basis-point-free for readability). */
  earlyExitPenaltyPercent: number;
  /** Human-readable description shown in UX copy. */
  description: string;
}

export interface FeeConstants {
  /** Stellar network base fee in stroops. */
  networkBaseFeeStroops: number;
  /** Platform fee percentage applied to commitment creation. */
  platformFeePercent: number;
}

export interface CommitmentLimits {
  /** Minimum commitment amount (in base asset units, e.g. XLM). */
  minAmountXlm: number;
  /** Maximum commitment amount (in base asset units). */
  maxAmountXlm: number;
  /** Minimum commitment duration in days. */
  minDurationDays: number;
  /** Maximum commitment duration in days. */
  maxDurationDays: number;
  /** Maximum allowed drawdown / loss percentage (0–100). */
  maxLossPercentCeiling: number;
}

export interface ProtocolConstants {
  /** Protocol version string (e.g. "v1"). */
  protocolVersion: string;
  /** Stellar network passphrase the protocol is deployed on. */
  network: string;
  /** Fee-related constants. */
  fees: FeeConstants;
  /** Early-exit penalty tiers per commitment type. */
  penalties: PenaltyTier[];
  /** Commitment amount and duration limits. */
  commitmentLimits: CommitmentLimits;
  /** ISO-8601 timestamp of when these constants were last refreshed. */
  cachedAt: string;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_NETWORK_BASE_FEE_STROOPS = 100;
const DEFAULT_PLATFORM_FEE_PERCENT = 0;

const DEFAULT_MIN_AMOUNT_XLM = 10;
const DEFAULT_MAX_AMOUNT_XLM = 1_000_000;
const DEFAULT_MIN_DURATION_DAYS = 1;
const DEFAULT_MAX_DURATION_DAYS = 365;
const DEFAULT_MAX_LOSS_PERCENT_CEILING = 100;

const DEFAULT_PENALTY_TIERS: PenaltyTier[] = [
  {
    type: "safe",
    earlyExitPenaltyPercent: 2,
    description: "Low-risk commitment with a 2% early-exit penalty.",
  },
  {
    type: "balanced",
    earlyExitPenaltyPercent: 3,
    description: "Moderate-risk commitment with a 3% early-exit penalty.",
  },
  {
    type: "aggressive",
    earlyExitPenaltyPercent: 5,
    description: "High-risk commitment with a 5% early-exit penalty.",
  },
];

// ─── Environment parsing helpers ──────────────────────────────────────────────

function envInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envFloat(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined) return fallback;
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envString(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function parsePenaltyTiersFromEnv(): PenaltyTier[] | null {
  const raw = process.env.COMMITLABS_PENALTY_TIERS_JSON;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error("COMMITLABS_PENALTY_TIERS_JSON must be a JSON array");
    }

    return parsed.map((tier: Record<string, unknown>, i: number) => {
      if (typeof tier.type !== "string" || !tier.type) {
        throw new Error(`Penalty tier at index ${i} is missing a valid "type".`);
      }
      if (typeof tier.earlyExitPenaltyPercent !== "number") {
        throw new Error(`Penalty tier "${tier.type}" is missing a numeric "earlyExitPenaltyPercent".`);
      }
      return {
        type: tier.type,
        earlyExitPenaltyPercent: tier.earlyExitPenaltyPercent,
        description:
          typeof tier.description === "string"
            ? tier.description
            : `${tier.type} commitment with a ${tier.earlyExitPenaltyPercent}% early-exit penalty.`,
      };
    });
  } catch (err) {
    throw new Error(`Failed to parse COMMITLABS_PENALTY_TIERS_JSON: ${(err as Error).message}`);
  }
}

let cached: ProtocolConstants | null = null;

export function invalidateProtocolConstantsCache(): void {
  cached = null;
}

export function getProtocolConstants(): ProtocolConstants {
  if (cached) return cached;

  const protocolVersion = envString("NEXT_PUBLIC_ACTIVE_CONTRACT_VERSION", envString("ACTIVE_CONTRACT_VERSION", "v1"));
  const network = envString("SOROBAN_NETWORK_PASSPHRASE", envString("NEXT_PUBLIC_NETWORK_PASSPHRASE", "Test SDF Network ; September 2015"));

  cached = {
    protocolVersion,
    network,
    fees: {
      networkBaseFeeStroops: envInt("COMMITLABS_NETWORK_BASE_FEE_STROOPS", DEFAULT_NETWORK_BASE_FEE_STROOPS),
      platformFeePercent: envFloat("COMMITLABS_PLATFORM_FEE_PERCENT", DEFAULT_PLATFORM_FEE_PERCENT),
    },
    penalties: parsePenaltyTiersFromEnv() ?? DEFAULT_PENALTY_TIERS,
    commitmentLimits: {
      minAmountXlm: envInt("COMMITLABS_MIN_AMOUNT_XLM", DEFAULT_MIN_AMOUNT_XLM),
      maxAmountXlm: envInt("COMMITLABS_MAX_AMOUNT_XLM", DEFAULT_MAX_AMOUNT_XLM),
      minDurationDays: envInt("COMMITLABS_MIN_DURATION_DAYS", DEFAULT_MIN_DURATION_DAYS),
      maxDurationDays: envInt("COMMITLABS_MAX_DURATION_DAYS", DEFAULT_MAX_DURATION_DAYS),
      maxLossPercentCeiling: envInt("COMMITLABS_MAX_LOSS_PERCENT_CEILING", DEFAULT_MAX_LOSS_PERCENT_CEILING),
    },
    cachedAt: new Date().toISOString(),
  };

  return cached;
}