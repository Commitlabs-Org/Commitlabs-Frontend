// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

import CommitmentHealthMetrics from './CommitmentHealthMetrics';

// ---------------------------------------------------------------------------
// Mock the four child charts.
//
// We don't care what recharts renders internally — that's covered by each
// chart's own test file. What THIS component is responsible for is:
//   1. picking the right chart for the active tab
//   2. passing it the right data/props
// So each mock renders a simple, inspectable stand-in that dumps its props
// as text, which lets us assert on exactly what was passed in.
// ---------------------------------------------------------------------------

vi.mock('./HealthMetricsValueHistoryChart', () => ({
    HealthMetricsValueHistoryChart: vi.fn((props: Record<string, unknown>) => (
        <div data-testid="value-chart">{JSON.stringify(props)}</div>
    )),
}));

vi.mock('./HealthMetricsDrawdownChart', () => ({
    HealthMetricsDrawdownChart: vi.fn((props: Record<string, unknown>) => (
        <div data-testid="drawdown-chart">{JSON.stringify(props)}</div>
    )),
}));

vi.mock('./HealthMetricsFeeGenerationChart', () => ({
    HealthMetricsFeeGenerationChart: vi.fn((props: Record<string, unknown>) => (
        <div data-testid="fee-chart">{JSON.stringify(props)}</div>
    )),
}));

vi.mock('./HealthMetricsComplianceChart', () => ({
    HealthMetricsComplianceChart: vi.fn((props: Record<string, unknown>) => (
        <div data-testid="compliance-chart">{JSON.stringify(props)}</div>
    )),
}));

// Pull in the mocked modules so we can assert on call args directly too.
import { HealthMetricsValueHistoryChart } from './HealthMetricsValueHistoryChart';
import { HealthMetricsDrawdownChart } from './HealthMetricsDrawdownChart';
import { HealthMetricsFeeGenerationChart } from './HealthMetricsFeeGenerationChart';
import { HealthMetricsComplianceChart } from './HealthMetricsComplianceChart';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const valueHistoryData = [
    { date: '2026-01-01', currentValue: 1000, initialAmount: 900 },
    { date: '2026-02-01', currentValue: 1100, initialAmount: 900 },
];

const drawdownData = [
    { date: '2026-01-01', drawdownPercent: 2.5 },
    { date: '2026-02-01', drawdownPercent: 4.1 },
];

const feeGenerationData = [
    { date: '2026-01-01', feeAmount: 12.5 },
    { date: '2026-02-01', feeAmount: 9.75 },
];

const complianceData = [
    { date: '2026-01-01', complianceScore: 98 },
    { date: '2026-02-01', complianceScore: 95 },
];

const baseProps = {
    valueHistoryData,
    drawdownData,
    feeGenerationData,
    complianceData,
    thresholdPercent: 10,
    volatilityPercent: 3.2,
};

function renderComponent(overrides: Partial<typeof baseProps> = {}) {
    return render(<CommitmentHealthMetrics {...baseProps} {...overrides} />);
}

// Tab button labels exactly as rendered by the component.
const TAB_LABELS = {
    value: 'Value History',
    drawdown: 'Drawdown',
    fee: 'Fee Generation',
    compliance: 'Compliance',
} as const;

beforeEach(() => {
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Default tab / initial render
// ---------------------------------------------------------------------------

describe('CommitmentHealthMetrics - initial render', () => {
    it('defaults to the Value History tab and renders the value chart', () => {
        renderComponent();

        expect(screen.getByTestId('value-chart')).toBeInTheDocument();
        expect(screen.queryByTestId('drawdown-chart')).not.toBeInTheDocument();
        expect(screen.queryByTestId('fee-chart')).not.toBeInTheDocument();
        expect(screen.queryByTestId('compliance-chart')).not.toBeInTheDocument();
    });

    it('renders all four tab buttons', () => {
        renderComponent();

        Object.values(TAB_LABELS).forEach((label) => {
            expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
        });
    });

    it('applies the active styling class only to the default Value History button', () => {
        renderComponent();

        const valueButton = screen.getByRole('button', { name: TAB_LABELS.value });
        const drawdownButton = screen.getByRole('button', { name: TAB_LABELS.drawdown });

        // The component has no role="tab"/aria-selected — "active" is communicated
        // purely via this Tailwind class. We assert on that real mechanism instead
        // of an ARIA attribute that doesn't exist in the markup.
        expect(valueButton.className).toContain('bg-[#222]');
        expect(valueButton.className).toContain('text-[#0ff0fc]');
        expect(drawdownButton.className).not.toContain('bg-[#222]');
    });

    it('passes valueHistoryData and volatilityPercent to the value chart on initial render', () => {
        renderComponent();

        expect((HealthMetricsValueHistoryChart as Mock).mock.calls[0][0]).toMatchObject({
                data: valueHistoryData,
                volatilityPercent: baseProps.volatilityPercent,
            });
    });
});

// ---------------------------------------------------------------------------
// Switching to each tab (mouse clicks)
// ---------------------------------------------------------------------------

describe('CommitmentHealthMetrics - tab switching via click', () => {
    it('switches to Drawdown and renders only the drawdown chart with correct props', async () => {
        const user = userEvent.setup();
        renderComponent();

        await user.click(screen.getByRole('button', { name: TAB_LABELS.drawdown }));

        expect(screen.getByTestId('drawdown-chart')).toBeInTheDocument();
        expect(screen.queryByTestId('value-chart')).not.toBeInTheDocument();
        expect(screen.queryByTestId('fee-chart')).not.toBeInTheDocument();
        expect(screen.queryByTestId('compliance-chart')).not.toBeInTheDocument();

        expect((HealthMetricsDrawdownChart as Mock).mock.calls[0][0]).toMatchObject({
                data: drawdownData,
                thresholdPercent: baseProps.thresholdPercent,
                volatilityPercent: baseProps.volatilityPercent,
            });
    });

    it('switches to Fee Generation and renders only the fee chart with correct props', async () => {
        const user = userEvent.setup();
        renderComponent();

        await user.click(screen.getByRole('button', { name: TAB_LABELS.fee }));

        expect(screen.getByTestId('fee-chart')).toBeInTheDocument();
        expect(screen.queryByTestId('value-chart')).not.toBeInTheDocument();
        expect(screen.queryByTestId('drawdown-chart')).not.toBeInTheDocument();
        expect(screen.queryByTestId('compliance-chart')).not.toBeInTheDocument();

        expect((HealthMetricsFeeGenerationChart as Mock).mock.calls[0][0]).toMatchObject({
                data: feeGenerationData,
                volatilityPercent: baseProps.volatilityPercent,
            });
    });

    it('switches to Compliance and renders only the compliance chart with correct props', async () => {
        const user = userEvent.setup();
        renderComponent();

        await user.click(screen.getByRole('button', { name: TAB_LABELS.compliance }));

        expect(screen.getByTestId('compliance-chart')).toBeInTheDocument();
        expect(screen.queryByTestId('value-chart')).not.toBeInTheDocument();
        expect(screen.queryByTestId('drawdown-chart')).not.toBeInTheDocument();
        expect(screen.queryByTestId('fee-chart')).not.toBeInTheDocument();

        // Compliance chart only ever takes `data` - no thresholdPercent/volatilityPercent.
        expect((HealthMetricsComplianceChart as Mock).mock.calls[0][0]).toEqual({ data: complianceData });
    });

    it('switches back to Value History after visiting another tab', async () => {
        const user = userEvent.setup();
        renderComponent();

        await user.click(screen.getByRole('button', { name: TAB_LABELS.compliance }));
        expect(screen.getByTestId('compliance-chart')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: TAB_LABELS.value }));

        expect(screen.getByTestId('value-chart')).toBeInTheDocument();
        expect(screen.queryByTestId('compliance-chart')).not.toBeInTheDocument();
    });

    it('moves the active styling class to whichever tab was just clicked', async () => {
        const user = userEvent.setup();
        renderComponent();

        const feeButton = screen.getByRole('button', { name: TAB_LABELS.fee });
        const valueButton = screen.getByRole('button', { name: TAB_LABELS.value });

        await user.click(feeButton);

        expect(feeButton.className).toContain('bg-[#222]');
        expect(valueButton.className).not.toContain('bg-[#222]');
    });
});

// ---------------------------------------------------------------------------
// Keyboard interaction
//
// NOTE: the real component renders plain <button> elements with only an
// onClick handler - there is no role="tablist"/role="tab" ARIA widget and no
// custom arrow-key handler. What we CAN legitimately test is the native
// keyboard behavior browsers give buttons for free: they're focusable via
// Tab, and Enter/Space trigger a click. That's the real, honest scope of
// "keyboard navigation" for this component as written.
// ---------------------------------------------------------------------------

describe('CommitmentHealthMetrics - keyboard interaction', () => {
    it('is focusable via Tab key and activates on Enter', async () => {
        const user = userEvent.setup();
        renderComponent();

        const drawdownButton = screen.getByRole('button', { name: TAB_LABELS.drawdown });

        drawdownButton.focus();
        expect(drawdownButton).toHaveFocus();

        await user.keyboard('{Enter}');

        expect(screen.getByTestId('drawdown-chart')).toBeInTheDocument();
    });

    it('activates a focused tab on Space key press', async () => {
        const user = userEvent.setup();
        renderComponent();

        const feeButton = screen.getByRole('button', { name: TAB_LABELS.fee });

        feeButton.focus();
        expect(feeButton).toHaveFocus();

        await user.keyboard(' ');

        expect(screen.getByTestId('fee-chart')).toBeInTheDocument();
    });

    it('moves focus between tab buttons in DOM order using Tab', async () => {
        const user = userEvent.setup();
        renderComponent();

        const valueButton = screen.getByRole('button', { name: TAB_LABELS.value });
        const drawdownButton = screen.getByRole('button', { name: TAB_LABELS.drawdown });

        valueButton.focus();
        expect(valueButton).toHaveFocus();

        await user.tab();
        expect(drawdownButton).toHaveFocus();
    });
});

// ---------------------------------------------------------------------------
// Edge cases: empty datasets per tab
// ---------------------------------------------------------------------------

describe('CommitmentHealthMetrics - empty datasets', () => {
    it('renders the value chart with an empty array when valueHistoryData is empty', () => {
        renderComponent({ valueHistoryData: [] });

        expect(screen.getByTestId('value-chart')).toBeInTheDocument();
        expect((HealthMetricsValueHistoryChart as Mock).mock.calls[0][0]).toMatchObject({ data: [] });
    });

    it('renders the drawdown chart with an empty array when drawdownData is empty', async () => {
        const user = userEvent.setup();
        renderComponent({ drawdownData: [] });

        await user.click(screen.getByRole('button', { name: TAB_LABELS.drawdown }));

        expect(screen.getByTestId('drawdown-chart')).toBeInTheDocument();
        expect((HealthMetricsDrawdownChart as Mock).mock.calls[0][0]).toMatchObject({ data: [] });
    });

    it('renders the fee chart with an empty array when feeGenerationData is empty', async () => {
        const user = userEvent.setup();
        renderComponent({ feeGenerationData: [] });

        await user.click(screen.getByRole('button', { name: TAB_LABELS.fee }));

        expect(screen.getByTestId('fee-chart')).toBeInTheDocument();
        expect((HealthMetricsFeeGenerationChart as Mock).mock.calls[0][0]).toMatchObject({ data: [] });
    });

    it('renders the compliance chart with an empty array when complianceData is empty', async () => {
        const user = userEvent.setup();
        renderComponent({ complianceData: [] });

        await user.click(screen.getByRole('button', { name: TAB_LABELS.compliance }));

        expect(screen.getByTestId('compliance-chart')).toBeInTheDocument();
        expect((HealthMetricsComplianceChart as Mock).mock.calls[0][0]).toEqual({ data: [] });
    });

    it('still renders all four tab buttons even when every dataset is empty', () => {
        renderComponent({
            valueHistoryData: [],
            drawdownData: [],
            feeGenerationData: [],
            complianceData: [],
        });

        Object.values(TAB_LABELS).forEach((label) => {
            expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
        });
    });
});

// ---------------------------------------------------------------------------
// Edge cases: optional props omitted
// ---------------------------------------------------------------------------

describe('CommitmentHealthMetrics - optional props', () => {
    it('renders the drawdown chart without thresholdPercent/volatilityPercent when omitted', async () => {
        const user = userEvent.setup();
        renderComponent({ thresholdPercent: undefined, volatilityPercent: undefined });

        await user.click(screen.getByRole('button', { name: TAB_LABELS.drawdown }));

        expect((HealthMetricsDrawdownChart as Mock).mock.calls[0][0]).toMatchObject({
                data: drawdownData,
                thresholdPercent: undefined,
                volatilityPercent: undefined,
            });
    });
});

// ---------------------------------------------------------------------------
// Edge cases: rapid tab switching
// ---------------------------------------------------------------------------

describe('CommitmentHealthMetrics - rapid tab switching', () => {
    it('settles on the last clicked tab when switching tabs rapidly in succession', async () => {
        const user = userEvent.setup();
        renderComponent();

        await user.click(screen.getByRole('button', { name: TAB_LABELS.drawdown }));
        await user.click(screen.getByRole('button', { name: TAB_LABELS.fee }));
        await user.click(screen.getByRole('button', { name: TAB_LABELS.compliance }));
        await user.click(screen.getByRole('button', { name: TAB_LABELS.value }));
        await user.click(screen.getByRole('button', { name: TAB_LABELS.fee }));

        // Only the final tab's chart should be mounted.
        expect(screen.getByTestId('fee-chart')).toBeInTheDocument();
        expect(screen.queryByTestId('value-chart')).not.toBeInTheDocument();
        expect(screen.queryByTestId('drawdown-chart')).not.toBeInTheDocument();
        expect(screen.queryByTestId('compliance-chart')).not.toBeInTheDocument();
    });

    it('clicking the already-active tab repeatedly keeps the same chart mounted without error', async () => {
        const user = userEvent.setup();
        renderComponent();

        const valueButton = screen.getByRole('button', { name: TAB_LABELS.value });

        await user.click(valueButton);
        await user.click(valueButton);
        await user.click(valueButton);

        expect(screen.getByTestId('value-chart')).toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Static content
// ---------------------------------------------------------------------------

describe('CommitmentHealthMetrics - static content', () => {
    it('renders the "Health Metrics" heading', () => {
        renderComponent();

        expect(
            screen.getByRole('heading', { name: 'Health Metrics' }),
        ).toBeInTheDocument();
    });
});
