/** @vitest-environment happy-dom */

import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SoldHistoryTabs } from './SoldHistoryTabs';

describe('SoldHistoryTabs', () => {
  it('switches to an accessible sold-history panel', () => {
    render(
      <SoldHistoryTabs
        active={<p>Active listings</p>}
        sold={[{ id: '1', title: 'Commitment', price: '$100', soldAt: '2026-07-01' }]}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Sold history' }));
    expect(screen.getByRole('tab', { name: 'Sold history' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('Sale price: $100')).toBeInTheDocument();
  });

  it('shows an empty state when there is no sold history', () => {
    render(<SoldHistoryTabs active={<p>Active listings</p>} sold={[]} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Sold history' }));
    expect(screen.getByText('No sold listings yet.')).toBeInTheDocument();
  });
});
