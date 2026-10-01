import { describe, expect, it } from 'vitest';
import { sortCommitments, type SortOption } from '../sortCommitments';
import type { Commitment } from '@/types/commitment';

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

  it('returns the input order unchanged for an unrecognized sortBy value', () => {
    const sorted = sortCommitments(mockCommitments, 'UnrecognizedOption' as SortOption);
    expect(sorted).toEqual(mockCommitments);
    expect(sorted).toBe(mockCommitments);
  });

  it('returns empty array unchanged for an unrecognized sortBy value', () => {
    const empty: Commitment[] = [];
    const sorted = sortCommitments(empty, 'UnrecognizedOption' as SortOption);
    expect(sorted).toEqual([]);
    expect(sorted).toBe(empty);
  });

  it('preserves the original array immutability during sorting', () => {
    const original = [...mockCommitments];
    const sorted = sortCommitments(original, 'Oldest');
    expect(original[0].id).toBe('CMT-1');
    expect(sorted).not.toBe(original);
  });

  it('handles malformed string amount gracefully in ValueHighLow and ValueLowHigh sorts', () => {
    const malformedCommitments: Commitment[] = [
      { ...mockCommitments[0], id: 'CMT-MALFORMED', amount: 'invalid-amount' },
      { ...mockCommitments[1], id: 'CMT-20K', amount: '20,000' },
      { ...mockCommitments[2], id: 'CMT-10K', amount: '10,000' },
    ];
    const highLow = sortCommitments(malformedCommitments, 'ValueHighLow');
    expect(highLow[0].id).toBe('CMT-20K');
    expect(highLow[1].id).toBe('CMT-10K');
    expect(highLow[2].id).toBe('CMT-MALFORMED');

    const lowHigh = sortCommitments(malformedCommitments, 'ValueLowHigh');
    expect(lowHigh[0].id).toBe('CMT-MALFORMED');
    expect(lowHigh[1].id).toBe('CMT-10K');
    expect(lowHigh[2].id).toBe('CMT-20K');
  });

  it('handles non-string and numeric amount types gracefully', () => {
    const variedAmountCommitments: Commitment[] = [
      { ...mockCommitments[0], id: 'CMT-NUMERIC', amount: 300000 as unknown as string },
      { ...mockCommitments[1], id: 'CMT-NULL', amount: null as unknown as string },
      { ...mockCommitments[2], id: 'CMT-UNDEFINED', amount: undefined as unknown as string },
      { ...mockCommitments[2], id: 'CMT-NAN-NUM', amount: NaN as unknown as string },
    ];
    const sorted = sortCommitments(variedAmountCommitments, 'ValueHighLow');
    expect(sorted[0].id).toBe('CMT-NUMERIC');
    expect(sorted.slice(1).map((c) => c.id)).toContain('CMT-NULL');
    expect(sorted.slice(1).map((c) => c.id)).toContain('CMT-UNDEFINED');
    expect(sorted.slice(1).map((c) => c.id)).toContain('CMT-NAN-NUM');
  });

  it('handles malformed daysRemaining in MaturitySoonest and MaturityLatest sorts', () => {
    const malformedDays: Commitment[] = [
      { ...mockCommitments[0], id: 'CMT-VALID-30', daysRemaining: 30 },
      { ...mockCommitments[1], id: 'CMT-NULL-DAYS', daysRemaining: null as unknown as number },
      { ...mockCommitments[2], id: 'CMT-NAN-DAYS', daysRemaining: NaN as unknown as number },
      {
        ...mockCommitments[0],
        id: 'CMT-UNDEF-DAYS',
        daysRemaining: undefined as unknown as number,
      },
      { ...mockCommitments[1], id: 'CMT-STR-DAYS', daysRemaining: 'invalid' as unknown as number },
    ];
    const soonest = sortCommitments(malformedDays, 'MaturitySoonest');
    expect(soonest[soonest.length - 1].id).toBe('CMT-VALID-30');

    const latest = sortCommitments(malformedDays, 'MaturityLatest');
    expect(latest[0].id).toBe('CMT-VALID-30');
  });

  it('handles malformed complianceScore in ComplianceHighLow and ComplianceLowHigh sorts', () => {
    const malformedCompliance: Commitment[] = [
      { ...mockCommitments[0], id: 'CMT-SCORE-99', complianceScore: 99 },
      { ...mockCommitments[1], id: 'CMT-SCORE-NULL', complianceScore: null as unknown as number },
      {
        ...mockCommitments[2],
        id: 'CMT-SCORE-UNDEF',
        complianceScore: undefined as unknown as number,
      },
      {
        ...mockCommitments[0],
        id: 'CMT-SCORE-STR',
        complianceScore: 'bad-score' as unknown as number,
      },
      { ...mockCommitments[1], id: 'CMT-SCORE-NAN', complianceScore: NaN as unknown as number },
    ];
    const highLow = sortCommitments(malformedCompliance, 'ComplianceHighLow');
    expect(highLow[0].id).toBe('CMT-SCORE-99');

    const lowHigh = sortCommitments(malformedCompliance, 'ComplianceLowHigh');
    expect(lowHigh[lowHigh.length - 1].id).toBe('CMT-SCORE-99');
  });

  it('handles malformed changePercent in YieldHighLow and YieldLowHigh sorts', () => {
    const malformedYield: Commitment[] = [
      { ...mockCommitments[0], id: 'CMT-YIELD-25', changePercent: 25.5 },
      { ...mockCommitments[1], id: 'CMT-YIELD-NULL', changePercent: null as unknown as number },
      {
        ...mockCommitments[2],
        id: 'CMT-YIELD-UNDEF',
        changePercent: undefined as unknown as number,
      },
      {
        ...mockCommitments[0],
        id: 'CMT-YIELD-STR',
        changePercent: 'invalid-yield' as unknown as number,
      },
      { ...mockCommitments[1], id: 'CMT-YIELD-NAN', changePercent: NaN as unknown as number },
    ];
    const highLow = sortCommitments(malformedYield, 'YieldHighLow');
    expect(highLow[0].id).toBe('CMT-YIELD-25');

    const lowHigh = sortCommitments(malformedYield, 'YieldLowHigh');
    expect(lowHigh[lowHigh.length - 1].id).toBe('CMT-YIELD-25');
  });

  it('handles malformed createdDate in Newest and Oldest sorts', () => {
    const malformedDates: Commitment[] = [
      { ...mockCommitments[0], id: 'CMT-DATE-RECENT', createdDate: '2026-03-01' },
      { ...mockCommitments[1], id: 'CMT-DATE-INVALID', createdDate: 'not-a-valid-date' },
      { ...mockCommitments[2], id: 'CMT-DATE-NULL', createdDate: null as unknown as string },
      { ...mockCommitments[0], id: 'CMT-DATE-UNDEF', createdDate: undefined as unknown as string },
    ];
    const newest = sortCommitments(malformedDates, 'Newest');
    expect(newest[0].id).toBe('CMT-DATE-RECENT');

    const oldest = sortCommitments(malformedDates, 'Oldest');
    expect(oldest[oldest.length - 1].id).toBe('CMT-DATE-RECENT');
  });
});
