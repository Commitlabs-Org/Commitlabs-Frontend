import { describe, it, expect } from 'vitest';
import { classifyAtRiskCommitments } from '@/utils/classification';
import type { Commitment } from '@/lib/types/domain';

const base: Commitment = {
  id: 'c1',
  type: 'Balanced',
  status: 'Active',
  asset: 'XLM',
  amount: '1000',
};

describe('classifyAtRiskCommitments', () => {
  it('returns empty array when no commitments are at risk', () => {
    const safe: Commitment = {
      ...base,
      complianceScore: 90,
      daysRemaining: 30,
      status: 'Active',
    };
    const result = classifyAtRiskCommitments([safe], null);
    expect(result).toHaveLength(0);
  });

  it('classifies low compliance score (< 70) as low_compliance', () => {
    const commitment: Commitment = { ...base, complianceScore: 69 };
    const result = classifyAtRiskCommitments([commitment], null);
    expect(result).toHaveLength(1);
    expect(result[0].riskCategories).toContain('low_compliance');
  });

  it('does not classify compliance score of exactly 70 as low_compliance', () => {
    const commitment: Commitment = { ...base, complianceScore: 70 };
    const result = classifyAtRiskCommitments([commitment], null);
    expect(result).toHaveLength(0);
  });

  it('classifies daysRemaining <= 7 as maturing_soon', () => {
    const atBoundary: Commitment = { ...base, daysRemaining: 7 };
    const justOver: Commitment = { ...base, id: 'c2', daysRemaining: 8 };
    const resultBoundary = classifyAtRiskCommitments([atBoundary], null);
    const resultOver = classifyAtRiskCommitments([justOver], null);

    expect(resultBoundary).toHaveLength(1);
    expect(resultBoundary[0].riskCategories).toContain('maturing_soon');
    expect(resultOver).toHaveLength(0);
  });

  it('classifies Violated status as action_required', () => {
    const commitment: Commitment = { ...base, status: 'Violated' };
    const result = classifyAtRiskCommitments([commitment], null);
    expect(result).toHaveLength(1);
    expect(result[0].riskCategories).toContain('action_required');
  });

  it('classifies drawdown >= 80% of maxLoss as action_required', () => {
    const atThreshold: Commitment = {
      ...base,
      currentDrawdown: '80',
      maxLoss: '100',
    };
    const belowThreshold: Commitment = {
      ...base,
      id: 'c2',
      currentDrawdown: '79',
      maxLoss: '100',
    };
    const atResult = classifyAtRiskCommitments([atThreshold], null);
    const belowResult = classifyAtRiskCommitments([belowThreshold], null);

    expect(atResult).toHaveLength(1);
    expect(atResult[0].riskCategories).toContain('action_required');
    expect(belowResult).toHaveLength(0);
  });

  it('handles non-numeric drawdown/maxLoss gracefully', () => {
    const commitment: Commitment = {
      ...base,
      currentDrawdown: 'N/A',
      maxLoss: '100',
    };
    const result = classifyAtRiskCommitments([commitment], null);
    expect(result).toHaveLength(0);
  });

  it('assigns multiple risk categories when multiple conditions are met', () => {
    const commitment: Commitment = {
      ...base,
      complianceScore: 50,
      daysRemaining: 3,
      status: 'Violated',
    };
    const result = classifyAtRiskCommitments([commitment], null);
    expect(result).toHaveLength(1);
    expect(result[0].riskCategories).toContain('low_compliance');
    expect(result[0].riskCategories).toContain('maturing_soon');
    expect(result[0].riskCategories).toContain('action_required');
  });

  it('filters out commitments with no risk categories', () => {
    const commitments: Commitment[] = [
      { ...base, id: 'c1', complianceScore: 80, daysRemaining: 30, status: 'Active' },
      { ...base, id: 'c2', complianceScore: 50 },
      { ...base, id: 'c3', daysRemaining: 5 },
    ];
    const result = classifyAtRiskCommitments(commitments, null);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual(['c2', 'c3']);
  });

  it('returns empty array for empty input', () => {
    const result = classifyAtRiskCommitments([], null);
    expect(result).toHaveLength(0);
  });

  it('returns exact risk category tokens (pin styling contract)', () => {
    const low: Commitment = { ...base, complianceScore: 0 };
    const soon: Commitment = { ...base, id: 'c2', daysRemaining: 0 };
    const action: Commitment = { ...base, id: 'c3', status: 'Violated' };

    const [lowResult] = classifyAtRiskCommitments([low], null);
    const [soonResult] = classifyAtRiskCommitments([soon], null);
    const [actionResult] = classifyAtRiskCommitments([action], null);

    expect(lowResult.riskCategories[0]).toBe('low_compliance');
    expect(soonResult.riskCategories[0]).toBe('maturing_soon');
    expect(actionResult.riskCategories[0]).toBe('action_required');
  });
});
