// @vitest-environment happy-dom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import CommitmentHealthMetrics from './CommitmentHealthMetrics'

vi.mock('./HealthMetricsValueHistoryChart', () => ({
    HealthMetricsValueHistoryChart: ({
        data,
        volatilityPercent,
    }: {
        data: Array<{ date: string; currentValue: number; initialAmount?: number }>
        volatilityPercent?: number
    }) => (
        <div data-testid="value-chart">
            {JSON.stringify({ data, volatilityPercent })}
        </div>
    ),
}))

vi.mock('./HealthMetricsDrawdownChart', () => ({
    HealthMetricsDrawdownChart: ({
        data,
        thresholdPercent,
        volatilityPercent,
    }: {
        data: Array<{ date: string; drawdownPercent: number }>
        thresholdPercent?: number
        volatilityPercent?: number
    }) => (
        <div data-testid="drawdown-chart">
            {JSON.stringify({ data, thresholdPercent, volatilityPercent })}
        </div>
    ),
}))

vi.mock('./HealthMetricsFeeGenerationChart', () => ({
    HealthMetricsFeeGenerationChart: ({
        data,
        volatilityPercent,
    }: {
        data: Array<{ date: string; feeAmount: number }>
        volatilityPercent?: number
    }) => (
        <div data-testid="fee-chart">
            {JSON.stringify({ data, volatilityPercent })}
        </div>
    ),
}))

vi.mock('./HealthMetricsComplianceChart', () => ({
    HealthMetricsComplianceChart: ({
        data,
    }: {
        data: Array<{ date: string; complianceScore: number }>
    }) => (
        <div data-testid="compliance-chart">
            {JSON.stringify({ data })}
        </div>
    ),
}))

const props = {
    complianceData: [{ date: 'Jun 3', complianceScore: 98 }],
    drawdownData: [{ date: 'Jun 2', drawdownPercent: 0.12 }],
    valueHistoryData: [{ date: 'Jun 1', currentValue: 1500, initialAmount: 1000 }],
    feeGenerationData: [{ date: 'Jun 4', feeAmount: 42 }],
    thresholdPercent: 0.2,
    volatilityPercent: 17,
}

function getTabs() {
    return {
        value: screen.getByRole('tab', { name: /value history/i }),
        drawdown: screen.getByRole('tab', { name: /drawdown/i }),
        fee: screen.getByRole('tab', { name: /fee generation/i }),
        compliance: screen.getByRole('tab', { name: /compliance/i }),
    }
}

describe('CommitmentHealthMetrics', () => {
    it('renders the value tab by default with tab semantics and value data', () => {
        render(<CommitmentHealthMetrics {...props} />)

        const tabs = getTabs()

        expect(screen.getByRole('tablist', { name: 'Health metric charts' })).toBeInTheDocument()
        expect(tabs.value).toHaveAttribute('aria-selected', 'true')
        expect(tabs.drawdown).toHaveAttribute('aria-selected', 'false')
        expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'health-metric-tab-value')
        expect(screen.getByTestId('value-chart')).toHaveTextContent('"currentValue":1500')
        expect(screen.getByTestId('value-chart')).toHaveTextContent('"volatilityPercent":17')
    })

    it('switches to each chart tab and passes the matching data props', () => {
        render(<CommitmentHealthMetrics {...props} />)

        fireEvent.click(getTabs().drawdown)
        expect(getTabs().drawdown).toHaveAttribute('aria-selected', 'true')
        expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'health-metric-tab-drawdown')
        expect(screen.getByTestId('drawdown-chart')).toHaveTextContent('"drawdownPercent":0.12')
        expect(screen.getByTestId('drawdown-chart')).toHaveTextContent('"thresholdPercent":0.2')

        fireEvent.click(getTabs().fee)
        expect(getTabs().fee).toHaveAttribute('aria-selected', 'true')
        expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'health-metric-tab-fee')
        expect(screen.getByTestId('fee-chart')).toHaveTextContent('"feeAmount":42')

        fireEvent.click(getTabs().compliance)
        expect(getTabs().compliance).toHaveAttribute('aria-selected', 'true')
        expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'health-metric-tab-compliance')
        expect(screen.getByTestId('compliance-chart')).toHaveTextContent('"complianceScore":98')
    })

    it('supports arrow, Home, and End keyboard navigation across tabs', async () => {
        render(<CommitmentHealthMetrics {...props} />)

        const tabs = getTabs()

        tabs.value.focus()
        fireEvent.keyDown(tabs.value, { key: 'ArrowRight' })

        await waitFor(() => expect(getTabs().drawdown).toHaveAttribute('aria-selected', 'true'))
        expect(getTabs().drawdown).toHaveFocus()

        fireEvent.keyDown(getTabs().drawdown, { key: 'ArrowLeft' })

        await waitFor(() => expect(getTabs().value).toHaveAttribute('aria-selected', 'true'))
        expect(getTabs().value).toHaveFocus()

        fireEvent.keyDown(getTabs().value, { key: 'End' })

        await waitFor(() => expect(getTabs().compliance).toHaveAttribute('aria-selected', 'true'))
        expect(getTabs().compliance).toHaveFocus()

        fireEvent.keyDown(getTabs().compliance, { key: 'Home' })

        await waitFor(() => expect(getTabs().value).toHaveAttribute('aria-selected', 'true'))
        expect(getTabs().value).toHaveFocus()
    })
})
