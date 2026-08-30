/**
 * @vitest-environment happy-dom
 */

import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { RecentlyViewedCommitmentsRail } from '@/components/RecentlyViewedCommitmentsRail';

describe('RecentlyViewedCommitmentsRail', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders nothing when there are no entries', () => {
    const { container } = render(<RecentlyViewedCommitmentsRail entries={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a link per entry with type and duration', () => {
    render(
      <RecentlyViewedCommitmentsRail
        entries={[
          { id: '2', type: 'Safe', durationDays: 30 },
          { id: '3', type: 'Aggressive', durationDays: 90 },
        ]}
      />,
    );

    const rail = screen.getByTestId('recently-viewed-commitments-rail');
    expect(rail).toBeTruthy();

    const link2 = screen.getByText('Safe Commitment').closest('a');
    expect(link2?.getAttribute('href')).toBe('/commitments/2');
    expect(screen.getByText('30d')).toBeTruthy();

    const link3 = screen.getByText('Aggressive Commitment').closest('a');
    expect(link3?.getAttribute('href')).toBe('/commitments/3');
    expect(screen.getByText('90d')).toBeTruthy();
  });

  it('exposes an accessible nav label', () => {
    render(
      <RecentlyViewedCommitmentsRail entries={[{ id: '1', type: 'Balanced', durationDays: 60 }]} />,
    );
    expect(screen.getByRole('navigation', { name: 'Recently viewed commitments' })).toBeTruthy();
  });
});
