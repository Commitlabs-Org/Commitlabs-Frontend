/** @vitest-environment happy-dom */

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  filterListingsBySeller,
  MarketplaceFilters,
  truncateSellerAddress,
} from './MarketplaceFilters';

describe('MarketplaceFilters', () => {
  it('filters and safely truncates seller addresses', () => {
    const listings = [{ sellerAddress: 'GABC123456789' }, { sellerAddress: 'GXYZ987654321' }];
    expect(filterListingsBySeller(listings, 'xyz')).toHaveLength(1);
    expect(truncateSellerAddress('GABC123456789')).toBe('GABC12…4321');
  });

  it('emits seller changes and clear actions', () => {
    const onSellerChange = vi.fn();
    const onClear = vi.fn();
    render(<MarketplaceFilters seller="GABC" onSellerChange={onSellerChange} onClear={onClear} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Filter by seller' }), {
      target: { value: 'GXYZ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Clear seller filter' }));
    expect(onSellerChange).toHaveBeenCalledWith('GXYZ');
    expect(onClear).toHaveBeenCalledOnce();
  });
});
