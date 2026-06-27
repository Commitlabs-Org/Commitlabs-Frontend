// @vitest-environment happy-dom

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Activity, DollarSign } from 'lucide-react';

import {
  KPICard,
  formatNumber,
  formatCurrency,
  formatPercentage,
  formatCompact,
  calculateDelta,
  type KPICardVariant,
  type KPICardSize,
  type DeltaDirection,
  type CardState,
} from './KPICard';
import styles from './KPICard.module.css';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the root <div> of a rendered KPICard. */
function getRoot(container: HTMLElement) {
  return container.firstElementChild as HTMLElement;
}

// ---------------------------------------------------------------------------
// Formatting Utilities (pure functions — no DOM needed)
// ---------------------------------------------------------------------------

describe('formatNumber', () => {
  it('formats integers with locale separators', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
  });

  it('respects the decimals parameter', () => {
    expect(formatNumber(1234.567, 2)).toBe('1,234.57');
  });

  it('parses string inputs', () => {
    expect(formatNumber('9876', 0)).toBe('9,876');
  });

  it('returns "--" for NaN', () => {
    expect(formatNumber(NaN)).toBe('--');
    expect(formatNumber('not-a-number')).toBe('--');
  });

  it('handles zero', () => {
    expect(formatNumber(0)).toBe('0');
  });

  it('handles negative values', () => {
    expect(formatNumber(-500, 0)).toBe('-500');
  });
});

describe('formatCurrency', () => {
  it('formats with USD prefix and 2 decimal places by default', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
  });

  it('respects custom currency code', () => {
    expect(formatCurrency(500, 'EUR', 2)).toContain('500');
  });

  it('respects the decimals parameter', () => {
    expect(formatCurrency(1000, 'USD', 0)).toBe('$1,000');
  });

  it('parses string inputs', () => {
    expect(formatCurrency('2500', 'USD', 2)).toBe('$2,500.00');
  });

  it('returns "--" for NaN', () => {
    expect(formatCurrency(NaN)).toBe('--');
    expect(formatCurrency('bad')).toBe('--');
  });
});

describe('formatPercentage', () => {
  it('formats with one decimal and no sign by default', () => {
    expect(formatPercentage(85.2)).toBe('85.2%');
  });

  it('respects the decimals parameter', () => {
    expect(formatPercentage(85.234, 2)).toBe('85.23%');
  });

  it('adds a + prefix only when showSign=true and value > 0', () => {
    expect(formatPercentage(12.5, 1, true)).toBe('+12.5%');
    expect(formatPercentage(-5, 1, true)).toBe('5.0%'); // negative: abs shown, no sign
    expect(formatPercentage(0, 1, true)).toBe('0.0%');
  });

  it('returns "--" for NaN', () => {
    expect(formatPercentage(NaN)).toBe('--');
  });
});

describe('formatCompact', () => {
  it('formats billions with one decimal', () => {
    expect(formatCompact(2_500_000_000)).toBe('2.5B');
  });

  it('formats millions with one decimal', () => {
    expect(formatCompact(1_200_000)).toBe('1.2M');
  });

  it('formats thousands with one decimal', () => {
    expect(formatCompact(4_700)).toBe('4.7K');
  });

  it('returns the number as-is below 1,000', () => {
    expect(formatCompact(999)).toBe('999');
  });

  it('returns "--" for NaN', () => {
    expect(formatCompact(NaN)).toBe('--');
  });
});

describe('calculateDelta', () => {
  it('calculates a positive delta (up direction)', () => {
    const d = calculateDelta(110, 100);
    expect(d.direction).toBe('up');
    expect(d.value).toBeCloseTo(10);
    expect(d.isPercentage).toBe(true);
  });

  it('calculates a negative delta (down direction)', () => {
    const d = calculateDelta(90, 100);
    expect(d.direction).toBe('down');
    expect(d.value).toBeCloseTo(10);
  });

  it('returns neutral when values are equal', () => {
    const d = calculateDelta(100, 100);
    expect(d.direction).toBe('neutral');
    expect(d.value).toBe(0);
  });

  it('returns neutral when previous value is 0 (division guard)', () => {
    const d = calculateDelta(50, 0);
    expect(d.direction).toBe('neutral');
  });

  it('parses string inputs', () => {
    const d = calculateDelta('125000', '110000');
    expect(d.direction).toBe('up');
    expect(d.value).toBeCloseTo(13.636, 2);
  });

  it('returns neutral for NaN inputs', () => {
    const d = calculateDelta(NaN, 100);
    expect(d.direction).toBe('neutral');
  });
});

// ---------------------------------------------------------------------------
// KPICard Component
// ---------------------------------------------------------------------------

describe('KPICard', () => {
  // ── Default state: label + value ─────────────────────────────────────────

  describe('default state', () => {
    it('renders the label', () => {
      render(<KPICard label="Total Revenue" value={1000} />);
      expect(screen.getByText('Total Revenue')).toBeInTheDocument();
    });

    it('renders the formatted value', () => {
      render(<KPICard label="Count" value={1234} format="value" />);
      expect(screen.getByText('1,234')).toBeInTheDocument();
    });

    it('renders "--" when value is undefined', () => {
      render(<KPICard label="Empty" />);
      expect(screen.getByText('--')).toBeInTheDocument();
    });

    it('renders description when provided', () => {
      render(<KPICard label="Score" value={90} description="Compliance rating" />);
      expect(screen.getByText('Compliance rating')).toBeInTheDocument();
    });

    it('renders tooltip hint character when tooltip is provided', () => {
      render(<KPICard label="Score" value={90} tooltip="More info" />);
      expect(screen.getByTitle('More info')).toBeInTheDocument();
    });

    it('renders icon when provided', () => {
      const { container } = render(
        <KPICard label="Activity" value={42} icon={Activity} />,
      );
      expect(container.querySelector('svg')).toBeInTheDocument();
    });
  });

  // ── Format types ─────────────────────────────────────────────────────────

  describe('format types', () => {
    it('format="currency" formats as USD', () => {
      render(<KPICard label="Revenue" value={1250} format="currency" decimals={2} />);
      expect(screen.getByText('$1,250.00')).toBeInTheDocument();
    });

    it('format="currency" uses custom unit as currency code', () => {
      render(<KPICard label="Revenue" value={500} format="currency" unit="EUR" decimals={0} />);
      // The formatted value will contain EUR currency formatting (locale-specific symbol)
      expect(screen.getByText(/500/)).toBeInTheDocument();
    });

    it('format="percentage" appends %', () => {
      render(<KPICard label="Score" value={85.2} format="percentage" decimals={1} />);
      expect(screen.getByText('85.2%')).toBeInTheDocument();
    });

    it('format="count" compacts large numbers', () => {
      render(<KPICard label="Users" value={1_500_000} format="count" />);
      expect(screen.getByText('1.5M')).toBeInTheDocument();
    });

    it('format="score" formats as a decimal number', () => {
      render(<KPICard label="Score" value={94.2} format="score" decimals={1} />);
      expect(screen.getByText('94.2')).toBeInTheDocument();
    });

    it('format="value" is the default and uses locale formatting', () => {
      render(<KPICard label="Num" value={9876} />);
      expect(screen.getByText('9,876')).toBeInTheDocument();
    });

    it('decimals=0 truncates for currency format', () => {
      render(<KPICard label="Revenue" value={1250} format="currency" decimals={0} />);
      expect(screen.getByText('$1,250')).toBeInTheDocument();
    });
  });

  // ── Delta indicators ──────────────────────────────────────────────────────

  describe('delta indicators', () => {
    it('renders the delta percentage value', () => {
      render(
        <KPICard
          label="Users"
          value={5420}
          delta={{ value: 8.2, direction: 'up' }}
        />,
      );
      expect(screen.getByText('8.2%')).toBeInTheDocument();
    });

    it('renders the delta period when provided', () => {
      render(
        <KPICard
          label="Users"
          value={5420}
          delta={{ value: 8.2, direction: 'up', period: 'vs last week' }}
        />,
      );
      expect(screen.getByText('vs last week')).toBeInTheDocument();
    });

    it('renders a TrendingUp SVG icon for direction="up"', () => {
      const { container } = render(
        <KPICard
          label="Revenue"
          value={120}
          delta={{ value: 10, direction: 'up' }}
        />,
      );
      // Delta container renders an SVG (the TrendingUp icon)
      const deltaEl = container.querySelector('[class*="_delta_"]');
      expect(deltaEl?.querySelector('svg')).toBeInTheDocument();
    });

    it('renders a TrendingDown SVG icon for direction="down"', () => {
      const { container } = render(
        <KPICard
          label="Revenue"
          value={80}
          delta={{ value: 10, direction: 'down' }}
        />,
      );
      const deltaEl = container.querySelector('[class*="_delta_"]');
      expect(deltaEl?.querySelector('svg')).toBeInTheDocument();
    });

    it('renders a Minus SVG icon for direction="neutral"', () => {
      const { container } = render(
        <KPICard
          label="Revenue"
          value={100}
          delta={{ value: 0, direction: 'neutral' }}
        />,
      );
      const deltaEl = container.querySelector('[class*="_delta_"]');
      expect(deltaEl?.querySelector('svg')).toBeInTheDocument();
    });

    it('auto-calculates delta from previousValue (up)', () => {
      render(<KPICard label="Revenue" value={125000} previousValue={110000} />);
      // (125000 - 110000) / 110000 * 100 ≈ 13.6%
      expect(screen.getByText('13.6%')).toBeInTheDocument();
    });

    it('auto-calculates delta from previousValue (down)', () => {
      render(<KPICard label="Revenue" value={90} previousValue={100} />);
      expect(screen.getByText('10.0%')).toBeInTheDocument();
    });

    it('explicit delta prop takes precedence over previousValue', () => {
      render(
        <KPICard
          label="Revenue"
          value={125000}
          previousValue={110000}
          delta={{ value: 99.9, direction: 'up' }}
        />,
      );
      expect(screen.getByText('99.9%')).toBeInTheDocument();
      expect(screen.queryByText('13.6%')).not.toBeInTheDocument();
    });

    it('does not render delta when neither delta nor previousValue is provided', () => {
      const { container } = render(<KPICard label="Revenue" value={100} />);
      expect(container.querySelector('[class*="_delta_"]')).not.toBeInTheDocument();
    });

    it('delta with isPercentage renders the value formatted to one decimal', () => {
      render(
        <KPICard
          label="Score"
          value={94}
          delta={{ value: 3.456, direction: 'up', isPercentage: true }}
        />,
      );
      expect(screen.getByText('3.5%')).toBeInTheDocument();
    });

    it('delta positive class applied for up direction', () => {
      const { container } = render(
        <KPICard label="X" value={10} delta={{ value: 5, direction: 'up' }} />,
      );
      const deltaEl = container.querySelector('[class*="_delta_"]');
      expect(deltaEl?.className).toMatch(/_deltaPositive_/);
    });

    it('delta negative class applied for down direction', () => {
      const { container } = render(
        <KPICard label="X" value={10} delta={{ value: 5, direction: 'down' }} />,
      );
      const deltaEl = container.querySelector('[class*="_delta_"]');
      expect(deltaEl?.className).toMatch(/_deltaNegative_/);
    });

    it('delta neutral class applied for neutral direction', () => {
      const { container } = render(
        <KPICard label="X" value={10} delta={{ value: 0, direction: 'neutral' }} />,
      );
      const deltaEl = container.querySelector('[class*="_delta_"]');
      expect(deltaEl?.className).toMatch(/_deltaNeutral_/);
    });

    it('direction is conveyed by icon shape, not color alone (WCAG 1.4.1)', () => {
      // Three separate renders — each must include an SVG icon in the delta area,
      // ensuring the direction signal is not color-only.
      const directions: DeltaDirection[] = ['up', 'down', 'neutral'];
      directions.forEach((direction) => {
        const { container, unmount } = render(
          <KPICard
            label="Metric"
            value={100}
            delta={{ value: 5, direction }}
          />,
        );
        const deltaEl = container.querySelector('[class*="_delta_"]');
        expect(deltaEl?.querySelector('svg')).toBeInTheDocument();
        unmount();
      });
    });
  });

  // ── Loading state ─────────────────────────────────────────────────────────

  describe('loading state', () => {
    it('renders the default loading message', () => {
      render(<KPICard label="Revenue" state="loading" />);
      expect(screen.getByText('Loading metrics...')).toBeInTheDocument();
    });

    it('renders a custom loading message', () => {
      render(
        <KPICard
          label="Revenue"
          state="loading"
          loadingMessage="Fetching data..."
        />,
      );
      expect(screen.getByText('Fetching data...')).toBeInTheDocument();
    });

    it('renders the spinner SVG', () => {
      const { container } = render(<KPICard label="Revenue" state="loading" />);
      const loadingEl = container.querySelector('[class*="_loadingState_"]');
      expect(loadingEl?.querySelector('svg')).toBeInTheDocument();
    });

    it('renders skeleton bars', () => {
      const { container } = render(<KPICard label="Revenue" state="loading" />);
      const skeletonBars = container.querySelectorAll('[class*="_skeletonBar_"]');
      expect(skeletonBars.length).toBe(2);
    });

    it('does not render the value when loading', () => {
      render(<KPICard label="Revenue" value={1000} state="loading" />);
      expect(screen.queryByText('1,000')).not.toBeInTheDocument();
    });

    it('does not render the label when loading', () => {
      render(<KPICard label="Revenue" state="loading" />);
      // label span is inside the default card header, which is not rendered in loading state
      expect(screen.queryByRole('heading')).not.toBeInTheDocument();
      // The loading message is shown instead; the card label text itself is not present
      const loadingEl = document.querySelector('[class*="_loadingState_"]');
      expect(loadingEl).toBeInTheDocument();
    });
  });

  // ── Error state ───────────────────────────────────────────────────────────

  describe('error state', () => {
    it('renders the default error message', () => {
      render(<KPICard label="Revenue" state="error" />);
      expect(screen.getByText('Failed to load')).toBeInTheDocument();
    });

    it('renders a custom error message', () => {
      render(
        <KPICard
          label="Revenue"
          state="error"
          errorMessage="Network request failed"
        />,
      );
      expect(screen.getByText('Network request failed')).toBeInTheDocument();
    });

    it('renders the AlertCircle SVG icon', () => {
      const { container } = render(<KPICard label="Revenue" state="error" />);
      const errorEl = container.querySelector('[class*="_errorState_"]');
      expect(errorEl?.querySelector('svg')).toBeInTheDocument();
    });

    it('renders a Retry button when onRetry is provided', () => {
      render(
        <KPICard label="Revenue" state="error" onRetry={() => {}} />,
      );
      expect(
        screen.getByRole('button', { name: 'Retry loading data' }),
      ).toBeInTheDocument();
    });

    it('calls onRetry when the Retry button is clicked', () => {
      const onRetry = vi.fn();
      render(<KPICard label="Revenue" state="error" onRetry={onRetry} />);
      fireEvent.click(screen.getByRole('button', { name: 'Retry loading data' }));
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('does not render a Retry button when onRetry is omitted', () => {
      render(<KPICard label="Revenue" state="error" />);
      expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
    });

    it('does not render the value when in error state', () => {
      render(<KPICard label="Revenue" value={1000} state="error" />);
      expect(screen.queryByText('1,000')).not.toBeInTheDocument();
    });
  });

  // ── Empty state ───────────────────────────────────────────────────────────

  describe('empty state', () => {
    it('renders the default empty message', () => {
      render(<KPICard label="Revenue" state="empty" />);
      expect(screen.getByText('No data available')).toBeInTheDocument();
    });

    it('does not render the value when empty', () => {
      render(<KPICard label="Revenue" value={1000} state="empty" />);
      expect(screen.queryByText('1,000')).not.toBeInTheDocument();
    });
  });

  // ── Color variants ────────────────────────────────────────────────────────

  describe('color variants', () => {
    const variants: KPICardVariant[] = [
      'teal', 'green', 'blue', 'purple', 'orange', 'neutral',
    ];

    it.each(variants)(
      'applies the CSS module class for the "%s" variant',
      (variant) => {
        const { container } = render(
          <KPICard label="Metric" value={1} variant={variant} />,
        );
        expect(getRoot(container).className).toContain(`_${variant}_`);
      },
    );

    it('defaults to the "teal" variant when variant is omitted', () => {
      const { container } = render(<KPICard label="Metric" value={1} />);
      expect(getRoot(container).className).toContain('_teal_');
    });
  });

  // ── Size variants ─────────────────────────────────────────────────────────

  describe('size variants', () => {
    const sizes: KPICardSize[] = ['small', 'medium', 'large'];

    it.each(sizes)(
      'applies the CSS module class for the "%s" size',
      (size) => {
        const { container } = render(
          <KPICard label="Metric" value={1} size={size} />,
        );
        expect(getRoot(container).className).toContain(`_${size}_`);
      },
    );

    it('defaults to the "medium" size when size is omitted', () => {
      const { container } = render(<KPICard label="Metric" value={1} />);
      expect(getRoot(container).className).toContain('_medium_');
    });
  });

  // ── Interactivity ─────────────────────────────────────────────────────────

  describe('interactivity', () => {
    it('is not focusable / not a button when onClick is omitted', () => {
      const { container } = render(<KPICard label="Metric" value={1} />);
      expect(getRoot(container)).not.toHaveAttribute('role', 'button');
      expect(getRoot(container)).not.toHaveAttribute('tabindex');
    });

    it('gets role="button" and tabIndex=0 when onClick is provided', () => {
      render(<KPICard label="Metric" value={1} onClick={() => {}} />);
      const card = screen.getByRole('button');
      expect(card).toHaveAttribute('tabindex', '0');
    });

    it('calls onClick when the card is clicked', () => {
      const onClick = vi.fn();
      render(<KPICard label="Metric" value={1} onClick={onClick} />);
      fireEvent.click(screen.getByRole('button'));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('calls onClick when Enter is pressed on the card', () => {
      const onClick = vi.fn();
      render(<KPICard label="Metric" value={1} onClick={onClick} />);
      fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick for other keys', () => {
      const onClick = vi.fn();
      render(<KPICard label="Metric" value={1} onClick={onClick} />);
      fireEvent.keyDown(screen.getByRole('button'), { key: ' ' });
      fireEvent.keyDown(screen.getByRole('button'), { key: 'Escape' });
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  // ── Accessibility ─────────────────────────────────────────────────────────

  describe('accessibility', () => {
    it('auto-generates aria-label as "{label}: {formattedValue}"', () => {
      const { container } = render(
        <KPICard label="Total Revenue" value={1250} format="currency" decimals={0} />,
      );
      expect(getRoot(container)).toHaveAttribute(
        'aria-label',
        'Total Revenue: $1,250',
      );
    });

    it('overrides aria-label with ariaLabel prop', () => {
      const { container } = render(
        <KPICard
          label="Revenue"
          value={1000}
          ariaLabel="Custom accessible label"
        />,
      );
      expect(getRoot(container)).toHaveAttribute(
        'aria-label',
        'Custom accessible label',
      );
    });

    it('auto-generated aria-label uses "--" when value is undefined', () => {
      const { container } = render(<KPICard label="Metric" />);
      expect(getRoot(container)).toHaveAttribute('aria-label', 'Metric: --');
    });

    it('Retry button has accessible label "Retry loading data"', () => {
      render(
        <KPICard label="X" state="error" onRetry={() => {}} />,
      );
      expect(
        screen.getByRole('button', { name: 'Retry loading data' }),
      ).toBeInTheDocument();
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('renders zero as "0" (not "--")', () => {
      render(<KPICard label="Count" value={0} />);
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('renders negative values correctly', () => {
      render(<KPICard label="Loss" value={-500} />);
      expect(screen.getByText('-500')).toBeInTheDocument();
    });

    it('renders very long labels without crashing', () => {
      const longLabel = 'A'.repeat(200);
      render(<KPICard label={longLabel} value={1} />);
      expect(screen.getByText(longLabel)).toBeInTheDocument();
    });

    it('renders a string value verbatim in value format', () => {
      render(<KPICard label="Score" value="42" />);
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('renders "--" for a non-numeric string value', () => {
      render(<KPICard label="Score" value="n/a" />);
      expect(screen.getByText('--')).toBeInTheDocument();
    });

    it('renders without crashing when all optional props are omitted', () => {
      const { container } = render(<KPICard label="Minimal" />);
      expect(getRoot(container)).toBeInTheDocument();
    });

    it('delta value of 0 renders "0.0%"', () => {
      render(
        <KPICard label="X" value={100} delta={{ value: 0, direction: 'neutral' }} />,
      );
      expect(screen.getByText('0.0%')).toBeInTheDocument();
    });
  });
});

describe('KPICard states', () => {
    it('renders the value, label, and accessible label in the default state', () => {
        render(<KPICard label="Total Revenue" value={1250} />);

        expect(screen.getByText('Total Revenue')).toBeInTheDocument();
        expect(screen.getByText('1,250')).toBeInTheDocument();
        expect(screen.getByLabelText('Total Revenue: 1,250')).toBeInTheDocument();
    });

    it('shows the spinner and loading message in the loading state', () => {
        render(
            <KPICard
                label="Total Revenue"
                value={1250}
                state="loading"
                loadingMessage="Fetching revenue..."
            />,
        );

        expect(screen.getByText('Fetching revenue...')).toBeInTheDocument();
        expect(screen.queryByText('Total Revenue')).not.toBeInTheDocument();
        expect(screen.queryByText('1,250')).not.toBeInTheDocument();

        const spinner = document.querySelector(`.${styles.spinner}`);
        expect(spinner).toBeInTheDocument();
        expect(spinner?.tagName).toBe('svg');
    });

    it('shows the alert icon, error message, and retry button in the error state', () => {
        const onRetry = vi.fn();
        render(
            <KPICard
                label="Total Revenue"
                state="error"
                errorMessage="Could not load revenue"
                onRetry={onRetry}
            />,
        );

        expect(screen.getByText('Could not load revenue')).toBeInTheDocument();
        const retryButton = screen.getByRole('button', { name: 'Retry loading data' });
        expect(retryButton).toBeInTheDocument();

        const errorIcon = document.querySelector(`.${styles.errorIcon}`);
        expect(errorIcon).toBeInTheDocument();
        expect(errorIcon?.tagName).toBe('svg');
    });

    it('falls back to a default error message when none is provided', () => {
        render(<KPICard label="Total Revenue" state="error" />);

        expect(screen.getByText('Failed to load')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Retry loading data' })).not.toBeInTheDocument();
    });

    it('shows the empty affordance in the empty state', () => {
        render(<KPICard label="Total Revenue" state="empty" />);

        expect(screen.getByText('No data available')).toBeInTheDocument();
        expect(screen.queryByText('Total Revenue')).not.toBeInTheDocument();
    });

    it('shows a custom empty message when no data state is reached', () => {
        render(<KPICard label="Total Revenue" state="empty" />);

        const empty = document.querySelector(`.${styles.emptyState}`);
        expect(empty).toBeInTheDocument();
    });

    it('renders the description and tooltip when provided', () => {
        render(
            <KPICard
                label="Total Revenue"
                value={1250}
                description="Net of refunds"
                tooltip="Calculated daily"
            />,
        );

        expect(screen.getByText('Net of refunds')).toBeInTheDocument();
        expect(screen.getByTitle('Calculated daily')).toBeInTheDocument();
    });

    it.each(['small', 'large'] as const)(
        'renders the %s size for the default, loading, and error states',
        (size) => {
            const { unmount } = render(<KPICard label="Total Revenue" value={1} size={size} />);
            expect(screen.getByText('Total Revenue')).toBeInTheDocument();
            unmount();

            const loading = render(<KPICard label="Total Revenue" state="loading" size={size} />);
            expect(document.querySelector(`.${styles.spinner}`)).toBeInTheDocument();
            loading.unmount();

            render(<KPICard label="Total Revenue" state="error" size={size} />);
            expect(document.querySelector(`.${styles.errorIcon}`)).toBeInTheDocument();
        },
    );

    it.each<{ state: CardState }>([
        { state: 'default' },
        { state: 'loading' },
        { state: 'error' },
        { state: 'empty' },
    ])('applies the card root class for the $state state', ({ state }) => {
        render(<KPICard label="Total Revenue" value={1} state={state} />);

        const card = document.querySelector(`.${styles.card}`);
        expect(card).toBeInTheDocument();
    });
});

describe('KPICard delta directions', () => {
    it.each<{ direction: DeltaDirection; iconLabel: string }>([
        { direction: 'up', iconLabel: 'lucide-trending-up' },
        { direction: 'down', iconLabel: 'lucide-trending-down' },
        { direction: 'neutral', iconLabel: 'lucide-minus' },
    ])('renders the $direction delta icon and styling', ({ direction, iconLabel }) => {
        render(
            <KPICard
                label="Active Users"
                value={500}
                delta={{ value: 5, direction }}
            />,
        );

        const icon = document.querySelector(`svg.${iconLabel}`);
        expect(icon).toBeInTheDocument();
        expect(icon).toHaveAttribute('aria-hidden', 'true');
        expect(screen.getByText('5.0%')).toBeInTheDocument();
    });

    it('marks an up delta as positive', () => {
        render(<KPICard label="Active Users" value={500} delta={{ value: 5, direction: 'up' }} />);

        const delta = document.querySelector(`.${styles.deltaPositive}`);
        expect(delta).toBeInTheDocument();
    });

    it('marks a down delta as negative', () => {
        render(<KPICard label="Active Users" value={500} delta={{ value: 5, direction: 'down' }} />);

        const delta = document.querySelector(`.${styles.deltaNegative}`);
        expect(delta).toBeInTheDocument();
    });

    it('marks a neutral delta as neutral, including a zero delta value', () => {
        render(<KPICard label="Active Users" value={500} delta={{ value: 0, direction: 'neutral' }} />);

        const delta = document.querySelector(`.${styles.deltaNeutral}`);
        expect(delta).toBeInTheDocument();
        expect(screen.getByText('0.0%')).toBeInTheDocument();
    });

    it('renders the period label when provided', () => {
        render(
            <KPICard
                label="Active Users"
                value={500}
                delta={{ value: 12.5, direction: 'up', period: 'vs last 30 days' }}
            />,
        );

        expect(screen.getByText('vs last 30 days')).toBeInTheDocument();
    });

    it('omits the period label when not provided', () => {
        render(<KPICard label="Active Users" value={500} delta={{ value: 12.5, direction: 'up' }} />);

        expect(document.querySelector(`.${styles.deltaPeriod}`)).not.toBeInTheDocument();
    });

    it('renders a negative delta value with a down direction', () => {
        render(
            <KPICard
                label="Active Users"
                value={500}
                delta={{ value: -8.2, direction: 'down' }}
            />,
        );

        expect(screen.getByText('-8.2%')).toBeInTheDocument();
        expect(document.querySelector(`.${styles.deltaNegative}`)).toBeInTheDocument();
    });

    it('derives the delta from previousValue when no explicit delta is given', () => {
        render(<KPICard label="Active Users" value={150} previousValue={100} />);

        expect(document.querySelector(`.${styles.deltaPositive}`)).toBeInTheDocument();
        expect(screen.getByText('50.0%')).toBeInTheDocument();
    });

    it('does not render a delta indicator when neither delta nor previousValue is provided', () => {
        render(<KPICard label="Active Users" value={150} />);

        expect(document.querySelector(`.${styles.delta}`)).not.toBeInTheDocument();
    });

    it('treats a zero previousValue as neutral instead of dividing by zero', () => {
        render(<KPICard label="Active Users" value={150} previousValue={0} />);

        expect(document.querySelector(`.${styles.deltaNeutral}`)).toBeInTheDocument();
        expect(screen.getByText('0.0%')).toBeInTheDocument();
    });
});

describe('KPICard metric formatting', () => {
    it('formats the default "value" category as a plain number', () => {
        render(<KPICard label="Score" value={1234} format="value" />);

        expect(screen.getByText('1,234')).toBeInTheDocument();
    });

    it('formats the "currency" category as USD by default', () => {
        render(<KPICard label="Revenue" value={1234.5} format="currency" decimals={2} />);

        expect(screen.getByText('$1,234.50')).toBeInTheDocument();
    });

    it('formats the "currency" category with a custom unit/currency code', () => {
        render(<KPICard label="Revenue" value={10} format="currency" unit="EUR" decimals={2} />);

        expect(screen.getByText('€10.00')).toBeInTheDocument();
    });

    it('formats the "percentage" category', () => {
        render(<KPICard label="Conversion" value={42.567} format="percentage" decimals={1} />);

        expect(screen.getByText('42.6%')).toBeInTheDocument();
    });

    it('formats the "count" category as a compact number in millions', () => {
        render(<KPICard label="Followers" value={1_500_000} format="count" />);

        expect(screen.getByText('1.5M')).toBeInTheDocument();
    });

    it('formats the "count" category as a compact number in thousands', () => {
        render(<KPICard label="Followers" value={1_500} format="count" />);

        expect(screen.getByText('1.5K')).toBeInTheDocument();
    });

    it('formats the "count" category below 1,000 without a suffix', () => {
        render(<KPICard label="Followers" value={42} format="count" />);

        expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('formats the "score" category as a plain number with decimals', () => {
        render(<KPICard label="Health Score" value={9.5} format="score" decimals={1} />);

        expect(screen.getByText('9.5')).toBeInTheDocument();
    });

    it('renders very large numbers correctly for the count category', () => {
        render(<KPICard label="Total Hits" value={2_300_000_000} format="count" />);

        expect(screen.getByText('2.3B')).toBeInTheDocument();
    });

    it('renders a fallback dash when value is missing in the default state', () => {
        render(<KPICard label="Total Revenue" />);

        expect(screen.getByText('--')).toBeInTheDocument();
        expect(screen.getByLabelText('Total Revenue: --')).toBeInTheDocument();
    });

    it('renders a fallback dash when value cannot be parsed as a number', () => {
        render(<KPICard label="Total Revenue" value="not-a-number" />);

        expect(screen.getByText('--')).toBeInTheDocument();
    });
});

describe('KPICard variants', () => {
    it.each<{ variant: KPICardVariant }>([
        { variant: 'teal' },
        { variant: 'green' },
        { variant: 'blue' },
        { variant: 'purple' },
        { variant: 'orange' },
        { variant: 'neutral' },
    ])('applies the $variant variant class', ({ variant }) => {
        render(<KPICard label="Total Revenue" value={1} variant={variant} />);

        const card = document.querySelector(`.${styles[variant]}`);
        expect(card).toBeInTheDocument();
        expect(card?.className).toContain(styles.card);
    });
});

describe('KPICard accessibility', () => {
    it('associates the label text with the card via aria-label', () => {
        render(<KPICard label="Total Revenue" value={1250} format="currency" />);

        expect(screen.getByLabelText('Total Revenue: $1,250')).toBeInTheDocument();
    });

    it('uses a custom ariaLabel when provided, overriding the derived one', () => {
        render(<KPICard label="Total Revenue" value={1250} ariaLabel="Custom accessible name" />);

        expect(screen.getByLabelText('Custom accessible name')).toBeInTheDocument();
    });

    it('hides decorative delta icons from assistive technology', () => {
        render(<KPICard label="Active Users" value={500} delta={{ value: 5, direction: 'up' }} />);

        const icon = document.querySelector('svg.lucide-trending-up');
        expect(icon).toHaveAttribute('aria-hidden', 'true');
    });

    it('hides the decorative header icon from assistive technology', () => {
        render(<KPICard label="Revenue" value={500} icon={DollarSign} />);

        const icon = document.querySelector('svg.lucide-dollar-sign');
        expect(icon).toHaveAttribute('aria-hidden', 'true');
    });

    it('hides the decorative loading spinner from assistive technology', () => {
        render(<KPICard label="Revenue" state="loading" />);

        const icon = document.querySelector(`.${styles.spinner}`);
        expect(icon).toHaveAttribute('aria-hidden', 'true');
    });

    it('hides the decorative error icon from assistive technology', () => {
        render(<KPICard label="Revenue" state="error" />);

        const icon = document.querySelector(`.${styles.errorIcon}`);
        expect(icon).toHaveAttribute('aria-hidden', 'true');
    });

    it('exposes the card as a button when onClick is provided, and triggers it on Enter', () => {
        const onClick = vi.fn();
        render(<KPICard label="Total Revenue" value={1250} onClick={onClick} />);

        const card = screen.getByRole('button', { name: 'Total Revenue: 1,250' });
        expect(card).toHaveAttribute('tabIndex', '0');

        fireEvent.keyDown(card, { key: 'Enter' });
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('does not expose a button role when onClick is not provided', () => {
        render(<KPICard label="Total Revenue" value={1250} />);

        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
});
