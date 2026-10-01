import { describe, expect, it } from 'vitest';
import type { Commitment } from '@/lib/types/domain';
import {
  aggregateByAsset,
  aggregateByRiskProfile,
  formatAllocationValue,
} from '../portfolioAllocation';

type CommitmentFixture = Omit<Commitment, 'type'> & {
  type?: string | undefined;
};

/**
 * Creates a mock Commitment object for testing.
 *
 * @param overrides - Partial commitment fixture properties to override defaults
 * @returns A Commitment object populated with default test attributes
 */
function createCommitment(overrides: Partial<CommitmentFixture> = {}): Commitment {
  return {
    id: 'test-commitment',
    type: 'Safe',
    status: 'Active',
    asset: 'USDC',
    amount: '0',
    ...overrides,
  } as Commitment;
}

describe('aggregateByRiskProfile', () => {
  it('groups commitments by risk profile and sums parsed amounts', () => {
    const commitments = [
      createCommitment({ id: '1', type: 'Safe', amount: '100.50' }),
      createCommitment({ id: '2', type: 'Safe', amount: '24.50' }),
      createCommitment({ id: '3', type: 'Balanced', amount: '50' }),
      createCommitment({ id: '4', type: 'Aggressive', amount: '75.25' }),
    ];

    const result = aggregateByRiskProfile(commitments);

    expect(result).toEqual([
      { name: 'Safe', value: 125, color: '#0ff0fc' },
      { name: 'Balanced', value: 50, color: '#3b82f6' },
      { name: 'Aggressive', value: 75.25, color: '#f59e0b' },
    ]);
  });

  it('assigns fallback color #666 and defaults to Unknown for missing types', () => {
    const commitments = [createCommitment({ id: '1', type: undefined, amount: '10' })];

    const result = aggregateByRiskProfile(commitments);

    expect(result).toEqual([{ name: 'Unknown', value: 10, color: '#666' }]);
  });

  it('assigns fallback color #666 for unrecognized risk profile names', () => {
    const commitments = [
      createCommitment({ id: '1', type: 'Speculative', amount: '15' }),
      createCommitment({ id: '2', type: 'HighYield', amount: '25' }),
    ];

    const result = aggregateByRiskProfile(commitments);

    expect(result).toEqual([
      { name: 'Speculative', value: 15, color: '#666' },
      { name: 'HighYield', value: 25, color: '#666' },
    ]);
  });

  it('handles non-numeric amounts by treating them as zero', () => {
    const commitments = [
      createCommitment({ id: '1', type: 'Safe', amount: 'invalid-number' }),
      createCommitment({ id: '2', type: 'Safe', amount: 'NaN' }),
      createCommitment({ id: '3', type: 'Safe', amount: '' }),
      createCommitment({ id: '4', type: 'Safe', amount: '50' }),
    ];

    const result = aggregateByRiskProfile(commitments);

    expect(result).toEqual([{ name: 'Safe', value: 50, color: '#0ff0fc' }]);
  });

  it('returns empty array when given an empty list of commitments', () => {
    const result = aggregateByRiskProfile([]);

    expect(result).toEqual([]);
  });
});

describe('aggregateByAsset', () => {
  it('groups commitments by asset and sums parsed amounts', () => {
    const commitments = [
      createCommitment({ id: '1', asset: 'USDC', amount: '100' }),
      createCommitment({ id: '2', asset: 'XLM', amount: '25.25' }),
      createCommitment({ id: '3', asset: 'USDC', amount: '50.75' }),
    ];

    const result = aggregateByAsset(commitments);

    expect(result).toEqual([
      { name: 'USDC', value: 150.75, color: '#0ff0fc' },
      { name: 'XLM', value: 25.25, color: '#3b82f6' },
    ]);
  });

  it('defaults missing or empty asset names to Unknown', () => {
    const commitments = [
      createCommitment({ id: '1', asset: '', amount: '12' }),
      createCommitment({ id: '2', asset: undefined as unknown as string, amount: '18' }),
    ];

    const result = aggregateByAsset(commitments);

    expect(result).toEqual([{ name: 'Unknown', value: 30, color: '#0ff0fc' }]);
  });

  it('handles non-numeric amounts by treating them as zero', () => {
    const commitments = [
      createCommitment({ id: '1', asset: 'USDC', amount: 'not-a-number' }),
      createCommitment({ id: '2', asset: 'USDC', amount: '10' }),
    ];

    const result = aggregateByAsset(commitments);

    expect(result).toEqual([{ name: 'USDC', value: 10, color: '#0ff0fc' }]);
  });

  it('cycles the asset color palette past its length of ten', () => {
    const commitments = Array.from({ length: 12 }, (_, index) =>
      createCommitment({
        id: `asset-${index + 1}`,
        asset: `ASSET_${index + 1}`,
        amount: '1',
      }),
    );

    const result = aggregateByAsset(commitments);

    expect(result).toHaveLength(12);
    expect(result[0]).toEqual({ name: 'ASSET_1', value: 1, color: '#0ff0fc' });
    expect(result[9]).toEqual({ name: 'ASSET_10', value: 1, color: '#22d3ee' });
    expect(result[10]).toEqual({ name: 'ASSET_11', value: 1, color: '#0ff0fc' });
    expect(result[11]).toEqual({ name: 'ASSET_12', value: 1, color: '#3b82f6' });
  });

  it('returns empty array when given an empty list of commitments', () => {
    const result = aggregateByAsset([]);

    expect(result).toEqual([]);
  });
});

describe('formatAllocationValue', () => {
  it('formats large numbers with locale separators and up to two decimal places', () => {
    // Grouping separators depend on the runtime's default locale (e.g. en-IN groups as 12,34,567).
    const localeFormat = (value: number) =>
      value.toLocaleString(undefined, { maximumFractionDigits: 2 });
    expect(formatAllocationValue(1234567.891)).toBe(localeFormat(1234567.89));
    expect(formatAllocationValue(1000)).toBe(localeFormat(1000));
  });

  it('formats integers without unnecessary decimal points', () => {
    expect(formatAllocationValue(42)).toBe('42');
    expect(formatAllocationValue(0)).toBe('0');
  });

  it('rounds numbers beyond two decimal places', () => {
    expect(formatAllocationValue(10.555)).toBe('10.56');
    expect(formatAllocationValue(10.554)).toBe('10.55');
  });
});
