import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MyCommitmentsHeader from './MyCommitmentsHeader';

// Mock next/link to render standard <a> element with all passed props
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
    onClick,
    'aria-label': ariaLabel,
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) =>
    React.createElement('a', { href, className, onClick, 'aria-label': ariaLabel }, children),
}));

describe('MyCommitmentsHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Export button conditional rendering', () => {
    it('renders the Export button when onExport prop is provided and triggers callback on click', () => {
      const onExport = vi.fn();
      render(<MyCommitmentsHeader onExport={onExport} />);

      const exportButton = screen.getByRole('button', { name: /export/i });
      expect(exportButton).toBeInTheDocument();

      fireEvent.click(exportButton);
      expect(onExport).toHaveBeenCalledTimes(1);
    });

    it('does not render the Export button when onExport prop is omitted', () => {
      render(<MyCommitmentsHeader />);

      const exportButton = screen.queryByRole('button', { name: /export/i });
      expect(exportButton).not.toBeInTheDocument();
    });
  });

  describe('Back button navigation & callback handling', () => {
    it('calls onBack and prevents default navigation when onBack is provided', () => {
      const onBack = vi.fn();
      render(<MyCommitmentsHeader onBack={onBack} />);

      const backLink = screen.getByRole('link', { name: /back to home/i });
      const event = fireEvent.click(backLink);

      expect(onBack).toHaveBeenCalledTimes(1);
      expect(event).toBe(false);
    });

    it('does not prevent default navigation when onBack is omitted', () => {
      render(<MyCommitmentsHeader />);

      const backLink = screen.getByRole('link', { name: /back to home/i });
      const event = fireEvent.click(backLink);

      expect(event).toBe(true);
    });

    it('sets correct backHref link attribute', () => {
      render(<MyCommitmentsHeader backHref="/dashboard" />);

      const backLink = screen.getByRole('link', { name: /back to home/i });
      expect(backLink).toHaveAttribute('href', '/dashboard');
    });
  });

  describe('Create New Commitment navigation & callback handling', () => {
    it('calls onCreateNew and prevents default navigation when onCreateNew is provided', () => {
      const onCreateNew = vi.fn();
      render(<MyCommitmentsHeader onCreateNew={onCreateNew} />);

      const createLink = screen.getByRole('link', { name: /create new commitment/i });
      const event = fireEvent.click(createLink);

      expect(onCreateNew).toHaveBeenCalledTimes(1);
      expect(event).toBe(false);
    });

    it('does not prevent default navigation when onCreateNew is omitted', () => {
      render(<MyCommitmentsHeader />);

      const createLink = screen.getByRole('link', { name: /create new commitment/i });
      const event = fireEvent.click(createLink);

      expect(event).toBe(true);
    });

    it('sets correct createHref link attribute', () => {
      render(<MyCommitmentsHeader createHref="/commitments/new" />);

      const createLink = screen.getByRole('link', { name: /create new commitment/i });
      expect(createLink).toHaveAttribute('href', '/commitments/new');
    });
  });

  describe('Title and Subtitle rendering', () => {
    it('renders default title and subtitle when no props are provided', () => {
      render(<MyCommitmentsHeader />);

      expect(screen.getByRole('heading', { level: 1, name: 'My Commitments' })).toBeInTheDocument();
      expect(screen.getByText('View and manage all your liquidity commitments')).toBeInTheDocument();
    });

    it('renders custom title and subtitle when provided', () => {
      render(
        <MyCommitmentsHeader
          title="Custom Title"
          subtitle="Custom Subtitle Description"
        />
      );

      expect(screen.getByRole('heading', { level: 1, name: 'Custom Title' })).toBeInTheDocument();
      expect(screen.getByText('Custom Subtitle Description')).toBeInTheDocument();
    });
  });
});
