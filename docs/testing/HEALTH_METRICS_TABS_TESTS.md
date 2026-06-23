# Health Metrics Tabs Tests

`src/components/dashboard/CommitmentHealthMetrics.test.tsx` covers the tab behavior for the health metrics card.

## Coverage

- Default Value History tab selection.
- `role="tablist"`, `role="tab"`, `aria-selected`, and tabpanel labelling.
- Click switching across Value History, Drawdown, Fee Generation, and Compliance.
- Data handoff from each tab to its corresponding chart component.
- Arrow key, Home, and End keyboard navigation.

The chart components are mocked in the test so the suite can focus on tab state, accessibility, and prop routing without rendering Recharts internals.
