# Portfolio Allocation Donut Chart

Visualizes how a user's committed capital is distributed across risk profiles
and assets on the commitments overview page.

## Component

`PortfolioAllocationChartInner` — `src/components/dashboard/PortfolioAllocationChart.tsx`

- Recharts `PieChart` rendered as a donut (`innerRadius={60}`, `outerRadius={100}`).
- Toggle between **By Risk Profile** (Safe / Balanced / Aggressive) and **By Asset** views.
- Accessible legend with color swatches and percentage breakdown.
- Screen-reader-accessible table (`.sr-only`) mirrors chart data.

## Aggregation

`src/utils/portfolioAllocation.ts`

| Function | Description |
|---|---|
| `aggregateByRiskProfile` | Groups by `Commitment.type`, sums `amount`. |
| `aggregateByAsset` | Groups by `Commitment.asset`, sums `amount`. |

## Empty State

When `commitments` is empty, the component shows a prompt to create a commitment.

## Lazy Loading

The chart is lazy-loaded on the overview page via `next/dynamic({ ssr: false })`
to avoid bloating the initial bundle with Recharts.
