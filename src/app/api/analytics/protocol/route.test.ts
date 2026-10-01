import { describe, expect, it } from 'vitest';
import type { ChainCommitment } from '@/lib/backend/services/contracts';
import { buildProtocolAnalytics } from './route';

function commitment(overrides: Partial<ChainCommitment> = {}): ChainCommitment {
  return {
    id: 'commitment-1',
    ownerAddress: 'GOWNER',
    asset: 'USDC',
    amount: '100',
    status: 'ACTIVE',
    complianceScore: 90,
    currentValue: '100',
    feeEarned: '2.50',
    violationCount: 0,
    ...overrides,
  };
}

describe('buildProtocolAnalytics', () => {
  it('aggregates a valid protocol snapshot with explicit invariants', () => {
    const analytics = buildProtocolAnalytics(
      [
        commitment({ id: 'a', ownerAddress: 'G1', amount: '100.25', status: 'ACTIVE' }),
        commitment({
          id: 'b',
          ownerAddress: 'G2',
          amount: '200',
          status: 'SETTLED',
          complianceScore: 80,
          feeEarned: '4.00',
          violationCount: 1,
        }),
        commitment({
          id: 'c',
          ownerAddress: 'G1',
          amount: '50',
          status: 'VIOLATED',
          complianceScore: 70,
          feeEarned: '0.50',
          violationCount: 2,
        }),
      ],
      'mock',
    );

    expect(analytics).toMatchObject({
      totalCommitments: 3,
      activeCommitments: 1,
      settledCommitments: 1,
      violatedCommitments: 1,
      totalValueLocked: '350.25',
      totalFeesEarned: '7.00',
      averageComplianceScore: 80,
      totalViolations: 3,
      uniqueOwners: 2,
      snapshot: {
        window: 'protocol-lifetime',
        source: 'mock',
        rejectedRecords: 0,
      },
      invariants: {
        statusTotalsMatch: true,
        nonNegativeTotals: true,
        complianceScoreBounded: true,
      },
    });
    expect(Date.parse(analytics.snapshot.generatedAt)).not.toBeNaN();
  });

  it('keeps empty snapshots deterministic', () => {
    const analytics = buildProtocolAnalytics([], 'chain');

    expect(analytics.totalCommitments).toBe(0);
    expect(analytics.totalValueLocked).toBe('0.00');
    expect(analytics.totalFeesEarned).toBe('0.00');
    expect(analytics.averageComplianceScore).toBe(0);
    expect(analytics.snapshot.source).toBe('chain');
  });

  it('rejects adversarial numeric inputs instead of corrupting totals', () => {
    const analytics = buildProtocolAnalytics([
      commitment({ id: 'valid', amount: '1,000', feeEarned: '', complianceScore: 100 }),
      commitment({ id: 'negative-amount', amount: '-1' }),
      commitment({ id: 'invalid-fee', feeEarned: 'NaN' }),
      commitment({ id: 'bad-score', complianceScore: 101 }),
      commitment({ id: 'fractional-violations', violationCount: 1.5 }),
    ]);

    expect(analytics.totalCommitments).toBe(1);
    expect(analytics.totalValueLocked).toBe('1000.00');
    expect(analytics.totalFeesEarned).toBe('0.00');
    expect(analytics.snapshot.rejectedRecords).toBe(4);
  });

  it('does not let uncounted statuses create contradictory status totals', () => {
    const analytics = buildProtocolAnalytics([
      commitment({ id: 'created', status: 'CREATED' }),
      commitment({ id: 'disputed', status: 'DISPUTED' }),
      commitment({ id: 'active', status: 'ACTIVE' }),
    ]);

    expect(analytics.totalCommitments).toBe(3);
    expect(analytics.activeCommitments).toBe(1);
    expect(analytics.settledCommitments).toBe(0);
    expect(analytics.violatedCommitments).toBe(0);
    expect(
      analytics.activeCommitments + analytics.settledCommitments + analytics.violatedCommitments,
    ).toBeLessThanOrEqual(analytics.totalCommitments);
  });

  it('excludes missing owners from unique owner counts while preserving valid records', () => {
    const analytics = buildProtocolAnalytics([
      commitment({ id: 'blank-owner', ownerAddress: '' }),
      commitment({ id: 'trimmed-owner', ownerAddress: ' G1 ' }),
      commitment({ id: 'same-owner', ownerAddress: 'G1' }),
    ]);

    expect(analytics.totalCommitments).toBe(3);
    expect(analytics.uniqueOwners).toBe(1);
  });
});
