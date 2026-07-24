import { describe, expect, it } from 'vitest';

import type { Commitment } from '@/lib/types/domain';
import {
  aggregateByAsset,
  aggregateByRiskProfile,
  formatAllocationValue,
} from '../portfolioAllocation';

type CommitmentFixture = Omit<Commitment, 'type'> & {
  type?: string;
};

function commitment(overrides: Partial<CommitmentFixture> = {}): Commitment {
  return {
    id: 'commitment-1',
    type: 'Safe',
    status: 'Active',
    asset: 'USDC',
    amount: '0',
    ...overrides,
  } as Commitment;
}

describe('aggregateByRiskProfile', () => {
  it('groups commitments by risk profile and sums parsed amounts', () => {
    expect(
      aggregateByRiskProfile([
        commitment({ id: 'safe-1', type: 'Safe', amount: '100.50' }),
        commitment({ id: 'safe-2', type: 'Safe', amount: '24.5' }),
        commitment({ id: 'balanced-1', type: 'Balanced', amount: '50' }),
      ]),
    ).toEqual([
      { name: 'Safe', value: 125, color: '#0ff0fc' },
      { name: 'Balanced', value: 50, color: '#3b82f6' },
    ]);
  });

  it('uses Unknown and fallback color for missing or unrecognized profiles', () => {
    expect(
      aggregateByRiskProfile([
        commitment({ id: 'missing-type', type: undefined, amount: '10' }),
        commitment({ id: 'custom-type', type: 'Speculative', amount: '15' }),
      ]),
    ).toEqual([
      { name: 'Unknown', value: 10, color: '#666' },
      { name: 'Speculative', value: 15, color: '#666' },
    ]);
  });

  it('treats non-numeric amounts as zero', () => {
    expect(
      aggregateByRiskProfile([
        commitment({ id: 'valid', type: 'Aggressive', amount: '75' }),
        commitment({ id: 'invalid', type: 'Aggressive', amount: 'not-a-number' }),
      ]),
    ).toEqual([{ name: 'Aggressive', value: 75, color: '#f59e0b' }]);
  });
});

describe('aggregateByAsset', () => {
  it('groups commitments by asset and sums parsed amounts', () => {
    expect(
      aggregateByAsset([
        commitment({ id: 'usdc-1', asset: 'USDC', amount: '100' }),
        commitment({ id: 'xlm-1', asset: 'XLM', amount: '25.25' }),
        commitment({ id: 'usdc-2', asset: 'USDC', amount: '50.75' }),
      ]),
    ).toEqual([
      { name: 'USDC', value: 150.75, color: '#0ff0fc' },
      { name: 'XLM', value: 25.25, color: '#3b82f6' },
    ]);
  });

  it('defaults missing assets to Unknown and treats non-numeric amounts as zero', () => {
    expect(
      aggregateByAsset([
        commitment({ id: 'missing-asset', asset: '', amount: '12' }),
        commitment({ id: 'invalid-amount', asset: 'USDC', amount: 'nope' }),
      ]),
    ).toEqual([
      { name: 'Unknown', value: 12, color: '#0ff0fc' },
      { name: 'USDC', value: 0, color: '#3b82f6' },
    ]);
  });

  it('cycles the asset color palette after the tenth asset', () => {
    const commitments = Array.from({ length: 11 }, (_, index) =>
      commitment({
        id: `asset-${index + 1}`,
        asset: `ASSET_${index + 1}`,
        amount: '1',
      }),
    );

    const slices = aggregateByAsset(commitments);

    expect(slices[0]).toEqual({ name: 'ASSET_1', value: 1, color: '#0ff0fc' });
    expect(slices[9]).toEqual({ name: 'ASSET_10', value: 1, color: '#22d3ee' });
    expect(slices[10]).toEqual({ name: 'ASSET_11', value: 1, color: '#0ff0fc' });
  });
});

describe('formatAllocationValue', () => {
  it('formats allocation values with separators and up to two decimals', () => {
    expect(formatAllocationValue(1234567.891)).toBe('1,234,567.89');
    expect(formatAllocationValue(1000)).toBe('1,000');
  });
});
