// @vitest-environment happy-dom

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RecentlyViewedRail } from './RecentlyViewedRail';

// Mock the details modal using React.createElement (no JSX)
vi.mock('@/components/modals/CommitmentDetailsModal', () => ({
  CommitmentDetailsModal: ({
    isOpen,
    commitmentId,
    onClose,
  }: {
    isOpen: boolean;
    commitmentId: string;
    onClose: () => void;
  }) =>
    isOpen
      ? React.createElement(
          'div',
          {
            role: 'dialog',
            'aria-modal': 'true',
            'data-testid': 'commitment-modal',
            'data-commitment-id': commitmentId,
          },
          React.createElement('button', { onClick: onClose }, 'Close'),
        )
      : null,
}));

const mockListings = [
  {
    id: '001',
    type: 'Safe' as const,
    score: 95,
    amount: '$50,000',
    duration: '25 days',
    yield: '5.2%',
    maxLoss: '2%',
    owner: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    price: '$52,000',
    forSale: true,
    trustLevel: 'verified' as const,
  },
  {
    id: '002',
    type: 'Balanced' as const,
    score: 88,
    amount: '$100,000',
    duration: '45 days',
    yield: '12.5%',
    maxLoss: '8%',
    owner: '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199',
    price: '$105,000',
    forSale: true,
    trustLevel: 'reputable' as const,
  },
];

describe('RecentlyViewedRail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when there are no recently viewed IDs', () => {
    const { container } = render(
      React.createElement(RecentlyViewedRail, {
        recentIds: [],
        listings: mockListings,
        onClear: vi.fn(),
        onViewListing: vi.fn(),
      })
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders recently viewed listings in a rail', () => {
    render(
      React.createElement(RecentlyViewedRail, {
        recentIds: ['001', '002'],
        listings: mockListings,
        onClear: vi.fn(),
        onViewListing: vi.fn(),
      })
    );

    expect(screen.getByText('Recently Viewed')).toBeInTheDocument();
    expect(screen.getByText('#CMT-001')).toBeInTheDocument();
    expect(screen.getByText('#CMT-002')).toBeInTheDocument();
    expect(screen.getByText('5.2%')).toBeInTheDocument();
    expect(screen.getByText('12.5%')).toBeInTheDocument();
  });

  it('calls onClear when clear button is clicked', () => {
    const onClear = vi.fn();
    render(
      React.createElement(RecentlyViewedRail, {
        recentIds: ['001'],
        listings: mockListings,
        onClear: onClear,
        onViewListing: vi.fn(),
      })
    );

    const clearButton = screen.getByRole('button', { name: /clear/i });
    fireEvent.click(clearButton);
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('opens details modal when a listing card is clicked, and calls onViewListing', () => {
    const onViewListing = vi.fn();
    render(
      React.createElement(RecentlyViewedRail, {
        recentIds: ['001'],
        listings: mockListings,
        onClear: vi.fn(),
        onViewListing: onViewListing,
      })
    );

    const cardButton = screen.getByRole('button', { name: /recently viewed commitment 001/i });
    
    // Dialog should not be open initially
    expect(screen.queryByTestId('commitment-modal')).not.toBeInTheDocument();

    // Click card
    fireEvent.click(cardButton);

    // onViewListing should be called with the ID
    expect(onViewListing).toHaveBeenCalledWith('001');

    // Dialog should be open
    const modal = screen.getByTestId('commitment-modal');
    expect(modal).toBeInTheDocument();
    expect(modal.getAttribute('data-commitment-id')).toBe('001');

    // Close the modal
    const closeBtn = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeBtn);
    expect(screen.queryByTestId('commitment-modal')).not.toBeInTheDocument();
  });

  it('handles horizontal scroll container keydown events', () => {
    render(
      React.createElement(RecentlyViewedRail, {
        recentIds: ['001', '002'],
        listings: mockListings,
        onClear: vi.fn(),
        onViewListing: vi.fn(),
      })
    );

    const scrollContainer = screen.getByLabelText('Recently viewed listings rail');
    
    // Mock scrollBy on the container
    const scrollByMock = vi.fn();
    scrollContainer.scrollBy = scrollByMock;

    // Press ArrowRight
    fireEvent.keyDown(scrollContainer, { key: 'ArrowRight' });
    expect(scrollByMock).toHaveBeenCalledWith({ left: 320, behavior: 'smooth' });

    // Press ArrowLeft
    fireEvent.keyDown(scrollContainer, { key: 'ArrowLeft' });
    expect(scrollByMock).toHaveBeenCalledWith({ left: -320, behavior: 'smooth' });
  });
});
