/**
 * @vitest-environment happy-dom
 */

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MarketplaceEmptyState } from '../MarketplaceEmptyState';

describe('MarketplaceEmptyState', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders empty state correctly', () => {
    render(<MarketplaceEmptyState type="empty" />);
    
    expect(screen.getByText('No commitments available')).toBeTruthy();
    expect(screen.getByText('New offers will appear here once they are listed.')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders filtered empty state correctly', () => {
    const onClearFilters = vi.fn();
    
    render(<MarketplaceEmptyState type="filtered" onClearFilters={onClearFilters} />);
    
    expect(screen.getByText('No commitments match your filters')).toBeTruthy();
    expect(screen.getByText('Try adjusting or clearing your filters to see more results.')).toBeTruthy();
    
    const clearButton = screen.getByRole('button', { name: 'Clear all filters' });
    expect(clearButton).toBeTruthy();
    expect(clearButton).toHaveTextContent('Clear Filters');
  });

  it('renders error state correctly', () => {
    const onRetry = vi.fn();
    
    render(<MarketplaceEmptyState type="error" onRetry={onRetry} />);
    
    expect(screen.getByText('Failed to load commitments')).toBeTruthy();
    expect(screen.getByText('Something went wrong while fetching the listings. Please try again.')).toBeTruthy();
    
    const retryButton = screen.getByRole('button', { name: 'Retry loading listings' });
    expect(retryButton).toBeTruthy();
    expect(retryButton).toHaveTextContent('Try Again');
  });

  it('calls onClearFilters when clear button is clicked', () => {
    const onClearFilters = vi.fn();
    
    render(<MarketplaceEmptyState type="filtered" onClearFilters={onClearFilters} />);
    
    const clearButton = screen.getByRole('button', { name: 'Clear all filters' });
    fireEvent.click(clearButton);
    
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });

  it('calls onRetry when retry button is clicked', () => {
    const onRetry = vi.fn();
    
    render(<MarketplaceEmptyState type="error" onRetry={onRetry} />);
    
    const retryButton = screen.getByRole('button', { name: 'Retry loading listings' });
    fireEvent.click(retryButton);
    
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not show buttons when callbacks are not provided', () => {
    render(<MarketplaceEmptyState type="filtered" />);
    expect(screen.queryByRole('button', { name: 'Clear all filters' })).toBeNull();
    
    render(<MarketplaceEmptyState type="error" />);
    expect(screen.queryByRole('button', { name: 'Retry loading listings' })).toBeNull();
  });
});
