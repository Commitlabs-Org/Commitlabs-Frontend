import { describe, it, expect } from 'vitest';
import { calculateFeeBreakdown } from '@/lib/backend/feeCalculator';
import type { ProtocolConstants } from '@/lib/backend/services/protocolConstants';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal ProtocolConstants object for testing. */
function makeConstants(
  platformFeePercent: number,
  networkBaseFeeStroops: number,
): ProtocolConstants {
  return {
    protocolVersion: 'v1',
    network: 'Test SDF Network ; September 2015',
    fees: { platformFeePercent, networkBaseFeeStroops },
    penalties: [],
    commitmentLimits: {
      minAmountXlm: 10,
      maxAmountXlm: 1_000_000,
      minDurationDays: 1,
      maxDurationDays: 365,
      maxLossPercentCeiling: 100,
    },
    cachedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Example-based unit tests
// ---------------------------------------------------------------------------

describe('calculateFeeBreakdown — example-based unit tests', () => {
  // ── Req 4.2: platformFeePercent = 0 → platformFeeAmount = "0" ────────────

  it('returns platformFeeAmount "0" when platformFeePercent is 0', () => {
    const constants = makeConstants(0, 100);
    const result = calculateFeeBreakdown('1000', constants);
    expect(result.creationFee.platformFeeAmount).toBe('0');
    expect(result.settlementFee.platformFeeAmount).toBe('0');
  });

  // ── Req 4.3: networkBaseFeeStroops = 100 → networkFeeAmount = "0.0000100" ─

  it('returns networkFeeAmount "0.0000100" when networkBaseFeeStroops is 100', () => {
    const constants = makeConstants(1, 100);
    const result = calculateFeeBreakdown('1000', constants);
    expect(result.creationFee.networkFeeAmount).toBe('0.0000100');
    expect(result.settlementFee.networkFeeAmount).toBe('0.0000100');
  });

  // ── Req 4.4: truncation (not rounding) ───────────────────────────────────

  it('truncates platform fee: amount "101", platformFeePercent 1 → "1" (not "2")', () => {
    const constants = makeConstants(1, 100);
    const result = calculateFeeBreakdown('101', constants);
    expect(result.creationFee.platformFeeAmount).toBe('1');
    expect(result.settlementFee.platformFeeAmount).toBe('1');
  });

  it('truncates platform fee: amount "199", platformFeePercent 1 → "1" (not "2")', () => {
    const constants = makeConstants(1, 100);
    const result = calculateFeeBreakdown('199', constants);
    expect(result.creationFee.platformFeeAmount).toBe('1');
    expect(result.settlementFee.platformFeeAmount).toBe('1');
  });

  // ── Req 4.5 / 4.10: totalFeeAmount = string sum of platform + network ────

  describe('totalFeeAmount equals string sum of platformFeeAmount + networkFeeAmount', () => {
    const constants = makeConstants(1, 100); // networkFeeAmount = "0.0000100"

    const cases: Array<{ amount: string; expectedPlatform: string }> = [
      { amount: '0',       expectedPlatform: '0' },
      { amount: '1',       expectedPlatform: '0' },
      { amount: '100',     expectedPlatform: '1' },
      { amount: '1000000', expectedPlatform: '10000' },
    ];

    for (const { amount, expectedPlatform } of cases) {
      it(`amount "${amount}" → totalFeeAmount = "${expectedPlatform}" + "0.0000100"`, () => {
        const result = calculateFeeBreakdown(amount, constants);
        const { platformFeeAmount, networkFeeAmount, totalFeeAmount } = result.creationFee;

        expect(platformFeeAmount).toBe(expectedPlatform);
        expect(networkFeeAmount).toBe('0.0000100');

        const expectedTotal = String(Number(platformFeeAmount) + Number(networkFeeAmount));
        expect(totalFeeAmount).toBe(expectedTotal);

        // Same for settlementFee
        expect(result.settlementFee.totalFeeAmount).toBe(expectedTotal);
      });
    }
  });

  // ── Req 3.4: amount = "0" → platformFeeAmount = "0", network still computed

  it('amount "0" → platformFeeAmount "0" but network fee is still computed normally', () => {
    const constants = makeConstants(1, 100);
    const result = calculateFeeBreakdown('0', constants);
    expect(result.creationFee.platformFeeAmount).toBe('0');
    expect(result.settlementFee.platformFeeAmount).toBe('0');
    // Network fee is independent of amount
    expect(result.creationFee.networkFeeAmount).toBe('0.0000100');
    expect(result.settlementFee.networkFeeAmount).toBe('0.0000100');
  });

  // ── Req 1.8: invalid amounts → no throw, platformFeeAmount = "0" ─────────

  describe('invalid amount strings are treated as "0" and do not throw', () => {
    const invalidAmounts = ['', '-1', '1.5', ' 100', 'abc'];
    const constants = makeConstants(1, 100);

    for (const invalid of invalidAmounts) {
      it(`amount "${invalid}" → no throw, platformFeeAmount = "0"`, () => {
        expect(() => calculateFeeBreakdown(invalid, constants)).not.toThrow();
        const result = calculateFeeBreakdown(invalid, constants);
        expect(result.creationFee.platformFeeAmount).toBe('0');
        expect(result.settlementFee.platformFeeAmount).toBe('0');
      });
    }
  });

  // ── Req 1.7: rateSnapshot fields are numbers, not strings ────────────────

  it('rateSnapshot.platformFeePercent is a number, not a string', () => {
    const constants = makeConstants(1, 100);
    const result = calculateFeeBreakdown('1000', constants);
    expect(typeof result.rateSnapshot.platformFeePercent).toBe('number');
    expect(result.rateSnapshot.platformFeePercent).toBe(1);
  });

  it('rateSnapshot.networkBaseFeeStroops is a number, not a string', () => {
    const constants = makeConstants(1, 100);
    const result = calculateFeeBreakdown('1000', constants);
    expect(typeof result.rateSnapshot.networkBaseFeeStroops).toBe('number');
    expect(result.rateSnapshot.networkBaseFeeStroops).toBe(100);
  });

  it('rateSnapshot reflects the exact constants passed in', () => {
    const constants = makeConstants(2.5, 500);
    const result = calculateFeeBreakdown('1000', constants);
    expect(result.rateSnapshot.platformFeePercent).toBe(2.5);
    expect(result.rateSnapshot.networkBaseFeeStroops).toBe(500);
  });
});
