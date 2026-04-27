import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { KPICard, formatNumber, formatCurrency, formatPercentage, formatCompact, calculateDelta } from './KPICard';
import React from 'react';

// Mock lucide-react icons
vi.mock('lucide-react', async () => {
  const actual = await vi.importActual('lucide-react');
  return {
    ...actual,
  };
});

describe('KPICard Component', () => {
  describe('Default State', () => {
    it('renders label and value correctly', () => {
      render(
        <KPICard label="Total Revenue" value={125000} variant="green" />
      );
      
      expect(screen.getByText('Total Revenue')).toBeInTheDocument();
      expect(screen.getByText('125,000')).toBeInTheDocument();
    });

    it('applies correct variant styles', () => {
      const { container } = render(
        <KPICard label="Test" value={100} variant="teal" />
      );
      
      const card = container.firstChild;
      expect(card).toHaveClass('teal');
    });

    it('renders with different sizes', () => {
      const { container: small } = render(
        <KPICard label="Small" value={10} size="small" />
      );
      expect(small.firstChild).toHaveClass('small');

      const { container: medium } = render(
        <KPICard label="Medium" value={10} size="medium" />
      );
      expect(medium.firstChild).toHaveClass('medium');

      const { container: large } = render(
        <KPICard label="Large" value={10} size="large" />
      );
      expect(large.firstChild).toHaveClass('large');
    });

    it('displays icon when provided', () => {
      const { container } = render(
        <KPICard 
          label="With Icon" 
          value={100} 
          icon={React.createElement('span', { 'data-testid': 'icon' }, '★')}
        />
      );
      
      expect(container.querySelector('.iconWrapper')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('renders loading state with default message', () => {
      render(<KPICard label="Loading" state="loading" />);
      
      expect(screen.getByText('Loading metrics...')).toBeInTheDocument();
    });

    it('renders loading state with custom message', () => {
      render(
        <KPICard 
          label="Loading" 
          state="loading" 
          loadingMessage="Fetching data..."
        />
      );
      
      expect(screen.getByText('Fetching data...')).toBeInTheDocument();
    });

    it('shows spinner in loading state', () => {
      const { container } = render(
        <KPICard label="Loading" state="loading" />
      );
      
      expect(container.querySelector('.spinner')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('renders error state with default message', () => {
      render(<KPICard label="Error" state="error" />);
      
      expect(screen.getByText('Failed to load')).toBeInTheDocument();
    });

    it('renders error state with custom message', () => {
      render(
        <KPICard 
          label="Error" 
          state="error" 
          errorMessage="Something went wrong"
        />
      );
      
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('shows retry button when onRetry is provided', () => {
      const handleRetry = vi.fn();
      render(
        <KPICard 
          label="Error" 
          state="error" 
          onRetry={handleRetry}
        />
      );
      
      const retryButton = screen.getByText('Retry');
      expect(retryButton).toBeInTheDocument();
      
      fireEvent.click(retryButton);
      expect(handleRetry).toHaveBeenCalled();
    });
  });

  describe('Empty State', () => {
    it('renders empty state message', () => {
      render(<KPICard label="Empty" state="empty" />);
      
      expect(screen.getByText('No data available')).toBeInTheDocument();
    });
  });

  describe('Delta/Change Indicators', () => {
    it('renders positive delta correctly', () => {
      render(
        <KPICard 
          label="Growth" 
          value={100} 
          delta={{ value: 12.5, direction: 'up', period: 'vs last month' }}
        />
      );
      
      expect(screen.getByText('12.5%')).toBeInTheDocument();
    });

    it('renders negative delta correctly', () => {
      render(
        <KPICard 
          label="Decline" 
          value={80} 
          delta={{ value: 5.2, direction: 'down' }}
        />
      );
      
      expect(screen.getByText('5.2%')).toBeInTheDocument();
    });

    it('renders neutral delta correctly', () => {
      render(
        <KPICard 
          label="Stable" 
          value={100} 
          delta={{ value: 0, direction: 'neutral' }}
        />
      );
      
      expect(screen.getByText('0.0%')).toBeInTheDocument();
    });

    it('auto-calculates delta from previousValue', () => {
      render(
        <KPICard 
          label="Auto Delta" 
          value={110} 
          previousValue={100}
        />
      );
      
      // 10% increase
      expect(screen.getByText('10.0%')).toBeInTheDocument();
    });
  });

  describe('Formatting Utilities', () => {
    describe('formatNumber', () => {
      it('formats whole numbers with separators', () => {
        expect(formatNumber(1234567)).toBe('1,234,567');
      });

      it('formats with specified decimals', () => {
        expect(formatNumber(1234.567, 2)).toBe('1,234.57');
      });

      it('handles string input', () => {
        expect(formatNumber('1234')).toBe('1,234');
      });

      it('returns -- for invalid input', () => {
        expect(formatNumber('invalid')).toBe('--');
        expect(formatNumber(NaN)).toBe('--');
      });
    });

    describe('formatCurrency', () => {
      it('formats USD currency', () => {
        expect(formatCurrency(1234.56)).toBe('$1,234.56');
      });

      it('formats with zero decimals', () => {
        expect(formatCurrency(1234, 'USD', 0)).toBe('$1,234');
      });

      it('handles invalid input', () => {
        expect(formatCurrency('invalid')).toBe('--');
      });
    });

    describe('formatPercentage', () => {
      it('formats percentage with default decimals', () => {
        expect(formatPercentage(85.234)).toBe('85.2%');
      });

      it('shows positive sign when requested', () => {
        expect(formatPercentage(85.2, 1, true)).toBe('+85.2%');
      });

      it('handles negative values', () => {
        expect(formatPercentage(-15.5, 1, true)).toBe('-15.5%');
      });
    });

    describe('formatCompact', () => {
      it('formats billions', () => {
        expect(formatCompact(1500000000)).toBe('1.5B');
      });

      it('formats millions', () => {
        expect(formatCompact(2500000)).toBe('2.5M');
      });

      it('formats thousands', () => {
        expect(formatCompact(5500)).toBe('5.5K');
      });

      it('returns small numbers as-is', () => {
        expect(formatCompact(500)).toBe('500');
      });
    });

    describe('calculateDelta', () => {
      it('calculates positive percentage change', () => {
        const delta = calculateDelta(120, 100);
        expect(delta.value).toBe(20);
        expect(delta.direction).toBe('up');
      });

      it('calculates negative percentage change', () => {
        const delta = calculateDelta(80, 100);
        expect(delta.value).toBe(20);
        expect(delta.direction).toBe('down');
      });

      it('returns neutral for equal values', () => {
        const delta = calculateDelta(100, 100);
        expect(delta.direction).toBe('neutral');
      });

      it('handles zero previous value', () => {
        const delta = calculateDelta(100, 0);
        expect(delta.direction).toBe('neutral');
      });
    });
  });

  describe('Click Handling', () => {
    it('calls onClick when card is clicked', () => {
      const handleClick = vi.fn();
      render(
        <KPICard label="Clickable" value={100} onClick={handleClick} />
      );
      
      fireEvent.click(screen.getByText('Clickable'));
      expect(handleClick).toHaveBeenCalled();
    });

    it('is keyboard accessible', () => {
      const handleClick = vi.fn();
      render(
        <KPICard label="Keyboard" value={100} onClick={handleClick} />
      );
      
      const card = screen.getByText('Keyboard').closest('div');
      fireEvent.keyDown(card!, { key: 'Enter' });
      expect(handleClick).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('generates aria-label from label and value', () => {
      render(<KPICard label="Test Metric" value={100} />);
      
      const card = screen.getByText('Test Metric').closest('div');
      expect(card).toHaveAttribute('aria-label', 'Test Metric: 100');
    });

    it('allows custom aria-label', () => {
      render(
        <KPICard 
          label="Test" 
          value={100} 
          ariaLabel="Custom aria label"
        />
      );
      
      const card = screen.getByText('Test').closest('div');
      expect(card).toHaveAttribute('aria-label', 'Custom aria label');
    });
  });
});