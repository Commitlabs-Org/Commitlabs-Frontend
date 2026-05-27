/**
 * feeCalculator.ts
 *
 * Pure, side-effect-free module for computing commitment fee breakdowns.
 *
 * Rounding contract:
 *   - Platform fees: truncated to zero decimal places (Math.trunc, floor toward zero).
 *     The result is an integer string with no fractional part.
 *   - Network fees: expressed to exactly seven decimal places (stroops ÷ 10_000_000).
 *     No further rounding is applied beyond what toFixed(7) provides.
 *
 * Any `amount` string that does not match /^\d+$/ (one or more ASCII digits,
 * no sign, no decimal point, no whitespace) is silently treated as "0" for all
 * platform fee computations. The function never throws on invalid input.
 */

import type { ProtocolConstants } from './services/protocolConstants';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface FeeTotals {
  /** Integer string, truncated (floor toward zero, zero decimal places). */
  platformFeeAmount: string;
  /** 7-decimal-place string (stroop-to-XLM conversion). */
  networkFeeAmount: string;
  /** String sum of platform + network fee amounts. */
  totalFeeAmount: string;
}

export interface FeeBreakdown {
  creationFee: FeeTotals;
  settlementFee: FeeTotals;
  rateSnapshot: {
    /** Platform fee percentage used during computation (number, not string). */
    platformFeePercent: number;
    /** Stellar network base fee in stroops used during computation (number, not string). */
    networkBaseFeeStroops: number;
  };
}

// ─── Implementation ───────────────────────────────────────────────────────────

/**
 * Compute a FeeBreakdown from a commitment amount and the current protocol constants.
 *
 * Rounding contract:
 *   - Platform fees: truncated to zero decimal places (Math.trunc, floor toward zero).
 *   - Network fees: expressed to exactly seven decimal places (stroops ÷ 10_000_000).
 *
 * @param amount - Commitment amount as a string of non-negative integer digits.
 *                 Any string not matching /^\d+$/ is treated as "0".
 * @param constants - Protocol constants from getProtocolConstants().
 */
export function calculateFeeBreakdown(
  amount: string,
  constants: ProtocolConstants,
): FeeBreakdown {
  const { platformFeePercent, networkBaseFeeStroops } = constants.fees;

  // Validate amount: only accept strings of one or more ASCII digits (no sign, no decimal, no whitespace).
  const parsedAmount = /^\d+$/.test(amount) ? parseInt(amount, 10) : 0;

  // Platform fee: truncate to zero decimal places (floor toward zero).
  const platformFeeAmount = String(
    Math.trunc(parsedAmount * platformFeePercent / 100), // truncation: floor toward zero, zero decimal places
  );

  // Network fee: convert stroops to XLM with exactly seven decimal places.
  const networkFeeAmount = (networkBaseFeeStroops / 10_000_000).toFixed(7); // stroop-to-XLM: exactly seven decimal places, no further rounding

  // Total fee: string representation of the numeric sum of platform and network fees.
  const totalFeeAmount = String(Number(platformFeeAmount) + Number(networkFeeAmount));

  const feeTotals: FeeTotals = {
    platformFeeAmount,
    networkFeeAmount,
    totalFeeAmount,
  };

  return {
    creationFee: feeTotals,
    settlementFee: feeTotals,
    rateSnapshot: {
      platformFeePercent,
      networkBaseFeeStroops,
    },
  };
}
