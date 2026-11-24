import { describe, expect, it } from 'vitest';
import mathVectors from '../../../contracts/golden/math_vectors.json';
import { partialExitBreakdown, penaltyOf, yieldOf } from '../amount';
import { projectYieldStroops, type RiskProfile } from '../yield';

function riskProfile(value: string): RiskProfile {
  if (value === 'safe' || value === 'balanced' || value === 'aggressive') return value;
  throw new Error(`Unknown golden-vector risk profile: ${value}`);
}

const APY_PERCENT: Record<RiskProfile, number> = {
  safe: 5,
  balanced: 7,
  aggressive: 10,
};

describe('shared Rust/TypeScript math vectors', () => {
  it('projectYieldStroops and yieldOf match every contract yield vector', () => {
    for (const vector of mathVectors.yield_vectors) {
      const amount = BigInt(vector.amount);
      const risk = riskProfile(vector.risk);
      const expected = BigInt(vector.expected_yield);

      expect(projectYieldStroops(amount, vector.days, risk)).toBe(expected);
      expect(yieldOf(amount, APY_PERCENT[risk], vector.days)).toBe(expected);
    }
  });

  it('penaltyOf matches every contract penalty and refund vector', () => {
    for (const vector of mathVectors.penalty_vectors) {
      const amount = BigInt(vector.amount);
      const penalty = penaltyOf(amount, vector.bps / 100);

      expect(penalty).toBe(BigInt(vector.expected_penalty));
      expect(amount - penalty).toBe(BigInt(vector.expected_refund));
      expect(partialExitBreakdown(amount, amount, vector.bps)).toMatchObject({
        ok: true,
        value: {
          penalty: BigInt(vector.expected_penalty),
          refund: BigInt(vector.expected_refund),
        },
      });
    }
  });
});
