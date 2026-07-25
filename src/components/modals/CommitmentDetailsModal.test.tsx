// @vitest-environment happy-dom

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CommitmentDetailsModal } from '@/components/modals/CommitmentDetailsModal';

const mockTypeIcon = vi.fn(({ type }: { type: 'Safe' | 'Balanced' | 'Aggressive' }) => (
  <span data-testid="type-icon" data-type={type}>
    TypeIcon: {type}
  </span>
));

const defaultComplianceItems = [
  {
    id: 'comp-1',
    label: 'Identity Verification',
    statusLabel: 'Verified',
    statusVariant: 'ok' as const,
  },
  {
    id: 'comp-2',
    label: 'Risk Assessment',
    statusLabel: 'Moderate',
    statusVariant: 'warning' as const,
  },
  {
    id: 'comp-3',
    label: 'Sanctions Check',
    statusLabel: 'Failed',
    statusVariant: 'error' as const,
  },
];

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  commitmentId: 'CMT-8888',
  typeLabel: 'Yield Optimizer',
  typeVariant: 'safe' as const,
  statusLabel: 'Active',
  currentPrice: '$1,250.00',
  amountCommitted: '$1,000.00',
  remainingDuration: '14 days',
  currentYield: '8.5%',
  maxLoss: '$50.00',
  complianceItems: defaultComplianceItems,
  onSelectComplianceItem: vi.fn(),
  TypeIcon: mockTypeIcon,
  reputationScore: 98,
  totalCommitments: 25,
  successRate: 99,
};

function renderModal(props: Partial<React.ComponentProps<typeof CommitmentDetailsModal>> = {}) {
  return render(<CommitmentDetailsModal {...defaultProps} {...props} />);
}

describe('CommitmentDetailsModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.body.style.overflow = '';
    // Mock matchMedia for Dialog prefers-reduced-motion queries
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
    document.body.style.overflow = '';
  });

  describe('Rendering with full set of props', () => {
    it('renders modal content and header with title, status, and TypeIcon', () => {
      renderModal();

      expect(screen.getByRole('dialog')).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'Yield Optimizer' })).toBeTruthy();
      expect(screen.getByText('Active')).toBeTruthy();
      expect(screen.getByTestId('type-icon')).toBeTruthy();
      expect(screen.getByTestId('type-icon').getAttribute('data-type')).toBe('Safe');
    });

    it('renders commitment statistics and price details', () => {
      renderModal();

      expect(screen.getByText('$1,250.00')).toBeTruthy();
      expect(screen.getByText('USD')).toBeTruthy();
      expect(screen.getByText('$1,000.00')).toBeTruthy();
      expect(screen.getByText('14 days')).toBeTruthy();
      expect(screen.getByText('8.5%')).toBeTruthy();
      expect(screen.getByText('$50.00')).toBeTruthy();
    });

    it('renders quick view risk indicator based on the first compliance item', () => {
      renderModal();

      expect(screen.getByText('Quick view')).toBeTruthy();
      const verifiedElements = screen.getAllByText('Verified');
      expect(verifiedElements.length).toBeGreaterThan(0);
    });

    it('renders compliance and attestations list items and count', () => {
      renderModal();

      expect(screen.getByText('3 checks')).toBeTruthy();
      expect(screen.getByText('Identity Verification')).toBeTruthy();
      expect(screen.getAllByText('Verified').length).toBe(2);
      expect(screen.getByText('Risk Assessment')).toBeTruthy();
      expect(screen.getByText('Moderate')).toBeTruthy();
      expect(screen.getByText('Sanctions Check')).toBeTruthy();
      expect(screen.getByText('Failed')).toBeTruthy();
    });

    it('renders the "View full details" link with correct href', () => {
      renderModal();

      const link = screen.getByRole('link', { name: /view full details/i });
      expect(link).toBeTruthy();
      expect(link.getAttribute('href')).toBe('/commitments/CMT-8888');
    });

    it('capitalizes balanced and aggressive type variants for TypeIcon', () => {
      const { rerender } = renderModal({ typeVariant: 'balanced' });
      expect(screen.getByTestId('type-icon').getAttribute('data-type')).toBe('Balanced');

      rerender(<CommitmentDetailsModal {...defaultProps} typeVariant="aggressive" />);
      expect(screen.getByTestId('type-icon').getAttribute('data-type')).toBe('Aggressive');
    });

    it('omits status label when statusLabel is undefined', () => {
      renderModal({ statusLabel: undefined });
      expect(screen.queryByText('Active')).toBeNull();
    });

    it('renders N/A for quick view risk when complianceItems is empty', () => {
      renderModal({ complianceItems: [] });
      expect(screen.getByText('0 checks')).toBeTruthy();
      expect(screen.getByText('N/A')).toBeTruthy();
    });
  });

  describe('Compliance items list interactions', () => {
    it('triggers onSelectComplianceItem with item id on item click', () => {
      const onSelectComplianceItem = vi.fn();
      renderModal({ onSelectComplianceItem });

      const itemButton = screen.getByRole('button', {
        name: 'Identity Verification: Verified',
      });
      fireEvent.click(itemButton);

      expect(onSelectComplianceItem).toHaveBeenCalledTimes(1);
      expect(onSelectComplianceItem).toHaveBeenCalledWith('comp-1');

      const secondItemButton = screen.getByRole('button', {
        name: 'Risk Assessment: Moderate',
      });
      fireEvent.click(secondItemButton);

      expect(onSelectComplianceItem).toHaveBeenCalledTimes(2);
      expect(onSelectComplianceItem).toHaveBeenCalledWith('comp-2');
    });

    it('disables compliance item buttons when onSelectComplianceItem is not provided', () => {
      renderModal({ onSelectComplianceItem: undefined });

      const itemButton = screen.getByRole('button', {
        name: 'Identity Verification: Verified',
      });
      expect(itemButton).toBeDisabled();
    });
  });

  describe('Modal open and close behavior', () => {
    it('does not render dialog when isOpen is false', () => {
      renderModal({ isOpen: false });

      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('calls onClose when close icon button (X) is clicked', () => {
      const onClose = vi.fn();
      renderModal({ onClose });

      const closeButton = screen.getByRole('button', { name: /close modal/i });
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when "Done" button is clicked', () => {
      const onClose = vi.fn();
      renderModal({ onClose });

      const doneButton = screen.getByRole('button', { name: 'Done' });
      fireEvent.click(doneButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Escape key is pressed', () => {
      const onClose = vi.fn();
      renderModal({ onClose });

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when clicking backdrop', () => {
      const onClose = vi.fn();
      renderModal({ onClose });

      const backdrop = screen.getByRole('presentation');
      fireEvent.click(backdrop);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('locks body scroll while open and restores on unmount', () => {
      const { unmount } = renderModal();

      expect(document.body.style.overflow).toBe('hidden');

      unmount();

      expect(document.body.style.overflow).toBe('');
    });
  });
});
