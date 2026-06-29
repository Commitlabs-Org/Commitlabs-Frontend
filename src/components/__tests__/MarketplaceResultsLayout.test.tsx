/**
 * @vitest-environment happy-dom
 */

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MarketplaceResultsLayout } from '../MarketplaceResultsLayout';

describe('MarketplaceResultsLayout', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const defaultProps = {
    totalCount: 42,
    viewMode: 'grid' as const,
    onViewModeChange: vi.fn(),
    currentPage: 1,
    totalPages: 5,
    onPageChange: vi.fn(),
  };

  it('renders totalCount, active view-mode correctly, and children', () => {
    render(
      <MarketplaceResultsLayout {...defaultProps}>
        <div data-testid="test-child">Child Content</div>
      </MarketplaceResultsLayout>
    );

    // Assert count display
    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText(/commitments found/i)).toBeTruthy();

    // Assert active view mode
    const gridButton = screen.getByRole('button', { name: 'Grid view' });
    const listButton = screen.getByRole('button', { name: 'List view' });
    expect(gridButton).toHaveAttribute('aria-pressed', 'true');
    expect(listButton).toHaveAttribute('aria-pressed', 'false');

    // Assert children render
    expect(screen.getByTestId('test-child')).toBeTruthy();
  });

  it('fires onViewModeChange with the correct mode when view buttons are clicked', () => {
    render(
      <MarketplaceResultsLayout {...defaultProps} viewMode="list" />
    );

    const gridButton = screen.getByRole('button', { name: 'Grid view' });
    fireEvent.click(gridButton);

    expect(defaultProps.onViewModeChange).toHaveBeenCalledWith('grid');

    const listButton = screen.getByRole('button', { name: 'List view' });
    fireEvent.click(listButton);
    expect(defaultProps.onViewModeChange).toHaveBeenCalledWith('list');
  });

  it('handles pagination correctly (middle page)', () => {
    render(
      <MarketplaceResultsLayout {...defaultProps} currentPage={3} />
    );

    const prevButton = screen.getByRole('button', { name: 'Previous page' });
    const nextButton = screen.getByRole('button', { name: 'Next page' });
    
    // Both should be enabled on a middle page
    expect(prevButton).not.toBeDisabled();
    expect(nextButton).not.toBeDisabled();

    // Click previous
    fireEvent.click(prevButton);
    expect(defaultProps.onPageChange).toHaveBeenCalledWith(2);

    // Click next
    fireEvent.click(nextButton);
    expect(defaultProps.onPageChange).toHaveBeenCalledWith(4);
    
    // Click a specific page
    const pageButton = screen.getByRole('button', { name: 'Page 5' });
    fireEvent.click(pageButton);
    expect(defaultProps.onPageChange).toHaveBeenCalledWith(5);
  });

  it('disables both previous and next buttons on a single page', () => {
    render(
      <MarketplaceResultsLayout {...defaultProps} totalPages={1} currentPage={1} />
    );

    const prevButton = screen.getByRole('button', { name: 'Previous page' });
    const nextButton = screen.getByRole('button', { name: 'Next page' });

    expect(prevButton).toBeDisabled();
    expect(nextButton).toBeDisabled();
  });

  it('shows empty state and hides children and pagination when totalCount is 0', () => {
    render(
      <MarketplaceResultsLayout 
        {...defaultProps} 
        totalCount={0} 
        totalPages={0} 
        emptyStateType="empty"
      >
        <div data-testid="test-child">Child Content</div>
      </MarketplaceResultsLayout>
    );

    // Children should not render
    expect(screen.queryByTestId('test-child')).toBeNull();

    // Pagination should not render
    expect(screen.queryByRole('button', { name: 'Previous page' })).toBeNull();
    
    // Empty state should render
    expect(screen.getByText('No commitments available')).toBeTruthy();
  });
});
