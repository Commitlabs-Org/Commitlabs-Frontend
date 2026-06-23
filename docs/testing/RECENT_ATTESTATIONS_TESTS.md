# Recent Attestations Panel Tests

`src/components/RecentAttestationsPanel/RecentAttestationsPanel.test.tsx` covers the user-facing states requested for the panel.

## Coverage

- Empty state rendering while the footer summary remains visible.
- Populated list rendering in the caller-provided order.
- Relative timestamp text for immediate, hourly, and multi-day attestations.
- Severity conveyance through accessible row labels and severity-specific classes.
- Compact transaction hash rendering for dense rows.
- `View All` and row selection callback behavior.

The test freezes system time with Vitest fake timers so relative timestamp assertions stay deterministic.
