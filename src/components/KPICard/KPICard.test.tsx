// @vitest-environment happy-dom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DollarSign } from 'lucide-react';

import {
    KPICard,
    type CardState,
    type DeltaDirection,
    type KPICardVariant,
} from './KPICard';
import styles from './KPICard.module.css';

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
