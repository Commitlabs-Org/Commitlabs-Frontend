import { describe, expect, it } from 'vitest';
import { sortCommitments, SortOption } from '../sortCommitments';
import { Commitment } from '@/types/commitment';

const mockCommitments: Commitment[] = [
  {
    id: 'CMT-1',
    type: 'Safe',
    status: 'Active',
    asset: 'XLM',
    amount: '50,000',
    currentValue: '52,600',
    changePercent: 5.2,
    durationProgress: 75,
    daysRemaining: 15,
    complianceScore: 95,
    maxLoss: '2%',
    currentDrawdown: '0.8%',
    createdDate: 'Jan 10, 2026',
    expiryDate: 'Feb 9, 2026',
  },
  {
    id: 'CMT-2',
    type: 'Balanced',
    status: 'Active',
    asset: 'USDC',
    amount: '100,000',
    currentValue: '112,500',
    changePercent: 12.5,
    durationProgress: 30,
    daysRemaining: 42,
    complianceScore: 88,
    maxLoss: '8%',
    currentDrawdown: '3.2%',
    createdDate: 'Dec 15, 2025',
    expiryDate: 'Feb 13, 2026',
  },
  {
    id: 'CMT-3',
    type: 'Aggressive',
    status: 'Active',
    asset: 'XLM',
    amount: '250,000',
    currentValue: '296,750',
    changePercent: 18.7,
    durationProgress: 17,
    daysRemaining: 75,
    complianceScore: 76,
    maxLoss: 'No limit',
    currentDrawdown: '12.5%',
    createdDate: 'Nov 20, 2025',
    expiryDate: 'Feb 10, 2026',
  },
];

describe('sortCommitments', () => {
  it('sorts by newest created date', () => {
    const sorted = sortCommitments(mockCommitments, 'Newest');
    expect(sorted[0].id).toBe('CMT-1');
    expect(sorted[1].id).toBe('CMT-2');
    expect(sorted[2].id).toBe('CMT-3');
  });

  it('sorts by oldest created date', () => {
    const sorted = sortCommitments(mockCommitments, 'Oldest');
    expect(sorted[0].id).toBe('CMT-3');
    expect(sorted[1].id).toBe('CMT-2');
    expect(sorted[2].id).toBe('CMT-1');
  });

  it('sorts by value high to low', () => {
    const sorted = sortCommitments(mockCommitments, 'ValueHighLow');
    expect(sorted[0].id).toBe('CMT-3');
    expect(sorted[1].id).toBe('CMT-2');
    expect(sorted[2].id).toBe('CMT-1');
  });

  it('sorts by value low to high', () => {
    const sorted = sortCommitments(mockCommitments, 'ValueLowHigh');
    expect(sorted[0].id).toBe('CMT-1');
    expect(sorted[1].id).toBe('CMT-2');
    expect(sorted[2].id).toBe('CMT-3');
  });

  it('sorts by maturity soonest', () => {
    const sorted = sortCommitments(mockCommitments, 'MaturitySoonest');
    expect(sorted[0].id).toBe('CMT-1');
    expect(sorted[1].id).toBe('CMT-2');
    expect(sorted[2].id).toBe('CMT-3');
  });

  it('sorts by maturity latest', () => {
    const sorted = sortCommitments(mockCommitments, 'MaturityLatest');
    expect(sorted[0].id).toBe('CMT-3');
    expect(sorted[1].id).toBe('CMT-2');
    expect(sorted[2].id).toBe('CMT-1');
  });

  it('sorts by compliance high to low', () => {
    const sorted = sortCommitments(mockCommitments, 'ComplianceHighLow');
    expect(sorted[0].id).toBe('CMT-1');
    expect(sorted[1].id).toBe('CMT-2');
    expect(sorted[2].id).toBe('CMT-3');
  });

  it('sorts by compliance low to high', () => {
    const sorted = sortCommitments(mockCommitments, 'ComplianceLowHigh');
    expect(sorted[0].id).toBe('CMT-3');
    expect(sorted[1].id).toBe('CMT-2');
    expect(sorted[2].id).toBe('CMT-1');
  });

  it('sorts by yield high to low', () => {
    const sorted = sortCommitments(mockCommitments, 'YieldHighLow');
    expect(sorted[0].id).toBe('CMT-3');
    expect(sorted[1].id).toBe('CMT-2');
    expect(sorted[2].id).toBe('CMT-1');
  });

  it('sorts by yield low to high', () => {
    const sorted = sortCommitments(mockCommitments, 'YieldLowHigh');
    expect(sorted[0].id).toBe('CMT-1');
    expect(sorted[1].id).toBe('CMT-2');
    expect(sorted[2].id).toBe('CMT-3');
  });
});
