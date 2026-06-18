// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MarketplaceFilters from '../../src/components/MarketplaceFilter/MarketplaceFilters';

const defaultFilters = {
  sortBy: 'price',
  commitmentType: ['balanced' as const],
  priceRange: [0, 1000000] as [number, number],
  durationRange: [0, 90] as [number, number],
  minCompliance: 0,
  maxLoss: 100,
};

describe('MarketplaceFilters', () => {
  it('renders accessible filter controls and tracks sidebar search text', () => {
    render(<MarketplaceFilters filters={defaultFilters} />);

    const searchInput = screen.getByPlaceholderText('Search filters...');
    fireEvent.change(searchInput, { target: { value: 'balanced only' } });

    expect(searchInput).toHaveValue('balanced only');
    expect(screen.getByRole('button', { name: /balanced/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByLabelText('Maximum price')).toBeInTheDocument();
    expect(screen.getByLabelText('Maximum duration remaining')).toBeInTheDocument();
    expect(screen.getByLabelText('Minimum compliance score')).toBeInTheDocument();
    expect(screen.getByLabelText('Maximum loss threshold')).toBeInTheDocument();
  });

  it('emits updated filters for type toggles, ranges, and reset', () => {
    const onFilterChange = vi.fn();
    render(
      <MarketplaceFilters
        filters={{
          ...defaultFilters,
          commitmentType: ['balanced', 'aggressive'],
          priceRange: [0, 250000],
          durationRange: [0, 30],
          minCompliance: 25,
          maxLoss: 60,
        }}
        onFilterChange={onFilterChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /safe/i }));
    expect(onFilterChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        commitmentType: ['balanced', 'aggressive', 'conservative'],
      }),
    );

    fireEvent.change(screen.getByLabelText('Maximum price'), {
      target: { value: '500000' },
    });
    expect(onFilterChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ priceRange: [0, 500000] }),
    );

    fireEvent.change(screen.getByLabelText('Maximum duration remaining'), {
      target: { value: '45' },
    });
    expect(onFilterChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ durationRange: [0, 45] }),
    );

    fireEvent.change(screen.getByLabelText('Minimum compliance score'), {
      target: { value: '70' },
    });
    expect(onFilterChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ minCompliance: 70 }),
    );

    fireEvent.change(screen.getByLabelText('Maximum loss threshold'), {
      target: { value: '35' },
    });
    expect(onFilterChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ maxLoss: 35 }),
    );

    fireEvent.click(screen.getByRole('button', { name: /reset filters/i }));
    expect(onFilterChange).toHaveBeenLastCalledWith(defaultFilters);
  });
});
