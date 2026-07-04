import { render, screen } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
import RecentlyViewedCommitments from './RecentlyViewedCommitments';
import type { Commitment } from '@/types/commitment';
import {
  normalizeRecentlyViewedCommitmentIds,
  readRecentlyViewedCommitmentIds,
  recordRecentlyViewedCommitment,
  RECENTLY_VIEWED_COMMITMENTS_KEY,
} from '@/lib/recentlyViewedCommitments';

const commitments = [
  {
    id: 'CMT-ABC123',
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
    id: 'CMT-XYZ789',
    type: 'Balanced',
    status: 'Settled',
    asset: 'USDC',
    amount: '100,000',
    currentValue: '112,500',
    changePercent: 12.5,
    durationProgress: 100,
    daysRemaining: 0,
    complianceScore: 88,
    maxLoss: '8%',
    currentDrawdown: '0%',
    createdDate: 'Dec 15, 2025',
    expiryDate: 'Feb 13, 2026',
  },
] satisfies Commitment[];

function createStorage(initialValue?: string) {
  const values = new Map<string, string>();
  if (initialValue) {
    values.set(RECENTLY_VIEWED_COMMITMENTS_KEY, initialValue);
  }

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe('recently viewed commitment helpers', () => {
  it('normalizes ids by trimming, deduping, and bounding the list', () => {
    expect(
      normalizeRecentlyViewedCommitmentIds(
        [' CMT-ABC123 ', 'CMT-ABC123', '', null, 'CMT-XYZ789', 'CMT-DEF456'],
        2,
      ),
    ).toEqual(['CMT-ABC123', 'CMT-XYZ789']);
  });

  it('reads invalid storage as an empty list', () => {
    expect(readRecentlyViewedCommitmentIds(createStorage('{bad json'))).toEqual([]);
  });

  it('records the newest id first and keeps previous ids deduped', () => {
    const storage = createStorage(JSON.stringify(['CMT-ABC123', 'CMT-XYZ789']));

    expect(recordRecentlyViewedCommitment('CMT-XYZ789', storage)).toEqual([
      'CMT-XYZ789',
      'CMT-ABC123',
    ]);
  });
});

describe('RecentlyViewedCommitments', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('does not render when there is no local history', () => {
    const { container } = render(<RecentlyViewedCommitments commitments={commitments} />);

    expect(container.firstChild).toBeNull();
  });

  it('renders stored commitments in recent order and skips missing ids', async () => {
    window.localStorage.setItem(
      RECENTLY_VIEWED_COMMITMENTS_KEY,
      JSON.stringify(['CMT-MISSING', 'CMT-XYZ789', 'CMT-ABC123']),
    );

    render(<RecentlyViewedCommitments commitments={commitments} />);

    expect(
      await screen.findByRole('heading', { name: 'Recently viewed commitments' }),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open commitment CMT-XYZ789' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open commitment CMT-ABC123' })).toBeTruthy();
    expect(screen.queryByText('CMT-MISSING')).toBeNull();
  });
});
