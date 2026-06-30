// @vitest-environment happy-dom

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MarketplaceResultsLayout } from '../MarketplaceResultsLayout';

function mkProps(overrides: Partial<Parameters<typeof MarketplaceResultsLayout>[0]> = {}) {
  return {
    totalCount: 12,
    viewMode: 'grid' as const,
    onViewModeChange: vi.fn(),
    currentPage: 1,
    totalPages: 3,
    onPageChange: vi.fn(),
    children: <div data-testid="child-content">cards</div>,
    ...overrides,
  };
}

describe('MarketplaceResultsLayout — view toggle', () => {
  it('renders grid view button as pressed when viewMode is grid', () => {
    render(<MarketplaceResultsLayout {...mkProps({ viewMode: 'grid' })} />);
    expect(screen.getByRole('button', { name: 'Grid view' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'List view' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders list view button as pressed when viewMode is list', () => {
    render(<MarketplaceResultsLayout {...mkProps({ viewMode: 'list' })} />);
    expect(screen.getByRole('button', { name: 'List view' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Grid view' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onViewModeChange("list") when list button is clicked', () => {
    const onViewModeChange = vi.fn();
    render(<MarketplaceResultsLayout {...mkProps({ onViewModeChange })} />);
    fireEvent.click(screen.getByRole('button', { name: 'List view' }));
    expect(onViewModeChange).toHaveBeenCalledWith('list');
  });

  it('calls onViewModeChange("grid") when grid button is clicked', () => {
    const onViewModeChange = vi.fn();
    render(<MarketplaceResultsLayout {...mkProps({ viewMode: 'list', onViewModeChange })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Grid view' }));
    expect(onViewModeChange).toHaveBeenCalledWith('grid');
  });

  it('displays the total count', () => {
    render(<MarketplaceResultsLayout {...mkProps({ totalCount: 42 })} />);
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders children', () => {
    render(<MarketplaceResultsLayout {...mkProps()} />);
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });
});

describe('MarketplaceResultsLayout — pagination', () => {
  it('renders a page button for each page', () => {
    render(<MarketplaceResultsLayout {...mkProps({ totalPages: 4 })} />);
    expect(screen.getByRole('button', { name: 'Page 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Page 4' })).toBeInTheDocument();
  });

  it('calls onPageChange when a page button is clicked', () => {
    const onPageChange = vi.fn();
    render(<MarketplaceResultsLayout {...mkProps({ currentPage: 1, totalPages: 3, onPageChange })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Page 2' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('Previous button is disabled on the first page', () => {
    render(<MarketplaceResultsLayout {...mkProps({ currentPage: 1 })} />);
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
  });

  it('Next button is disabled on the last page', () => {
    render(<MarketplaceResultsLayout {...mkProps({ currentPage: 3, totalPages: 3 })} />);
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
  });

  it('Previous button advances page backwards when clicked', () => {
    const onPageChange = vi.fn();
    render(<MarketplaceResultsLayout {...mkProps({ currentPage: 2, onPageChange })} />);
    fireEvent.click(screen.getByRole('button', { name: /previous/i }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('Next button advances page forwards when clicked', () => {
    const onPageChange = vi.fn();
    render(<MarketplaceResultsLayout {...mkProps({ currentPage: 1, totalPages: 3, onPageChange })} />);
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('hides pagination when totalPages is 0', () => {
    render(<MarketplaceResultsLayout {...mkProps({ totalPages: 0 })} />);
    expect(screen.queryByRole('button', { name: /page/i })).not.toBeInTheDocument();
  });
});
