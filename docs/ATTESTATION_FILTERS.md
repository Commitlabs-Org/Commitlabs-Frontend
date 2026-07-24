# Attestation Filters Documentation

## Overview

The attestation history filtering feature adds severity tabs and type filters to the attestation timeline, making it easier to scan and focus on specific attestations in long-running commitments.

## Components

### AttestationFilterBar

**Location:** `src/components/attestation/AttestationFilterBar.tsx`

A reusable filter bar component that provides:
- **Severity tabs**: All, Info, Warning, Violation
- **Type dropdown**: All attestation types (health_check, violation, fee_generation, drawdown)
- **Count badges**: Shows the number of attestations matching each filter
- **Accessible navigation**: Full keyboard support and ARIA attributes

#### Props

```typescript
interface AttestationFilterBarProps {
  attestations: Array<{
    id: string
    severity?: AttestationSeverity
    attestationType?: AttestationType
  }>
  onFilterChange: (filters: {
    severity: AttestationSeverity | 'all'
    type: AttestationType | 'all'
  }) => void
}
```

#### Usage Example

```tsx
import AttestationFilterBar from '@/components/attestation/AttestationFilterBar'

function MyComponent() {
  const [filters, setFilters] = useState({
    severity: 'all' as const,
    type: 'all' as const,
  })

  return (
    <AttestationFilterBar
      attestations={attestations}
      onFilterChange={setFilters}
    />
  )
}
```

### AttestationHistory

**Location:** `src/components/AttestationHistory.tsx`

The main attestation history component that:
- Fetches attestations from `/api/attestations`
- Displays a compliance trend summary
- Integrates the filter bar
- Renders a filtered timeline of attestations
- Shows loading and error states
- Provides empty states for filtered results

#### Features

- **Compliance Trend Summary**: Shows total, info, warning, and violation counts
- **Severity-based styling**: Color-coded borders and backgrounds for each severity level
- **Relative timestamps**: Human-readable time formatting (e.g., "2 hours ago")
- **Transaction hash truncation**: Displays shortened transaction hashes
- **Expandable details**: Collapsible JSON details for each attestation
- **Responsive design**: Works on various screen sizes

## Filtering Behavior

### Severity Filters

- **All**: Shows all attestations regardless of severity
- **Info**: Shows only attestations with `severity: 'ok'`
- **Warning**: Shows only attestations with `severity: 'warning'`
- **Violation**: Shows only attestations with `severity: 'violation'`

### Type Filters

- **All Types**: Shows all attestation types
- **Health Check**: Shows only `health_check` attestations
- **Violation**: Shows only `violation` attestations
- **Fee Generation**: Shows only `fee_generation` attestations
- **Drawdown**: Shows only `drawdown` attestations

### Combined Filtering

Severity and type filters work together. For example:
- Selecting "Warning" + "Health Check" shows only health check attestations with warning severity
- Selecting "Violation" + "All Types" shows all violation attestations regardless of type

## Accessibility

### Keyboard Navigation

- **Tab**: Move between severity tabs
- **Arrow Left/Right**: Navigate between tabs
- **Enter/Space**: Select a tab
- **Tab**: Move to the type dropdown
- **Arrow Up/Down**: Navigate dropdown options

### ARIA Attributes

- `role="tablist"` on the severity tab container
- `role="tab"` on each severity tab
- `aria-selected` indicates the active tab
- `aria-controls` links tabs to the attestation list
- `aria-label` provides descriptive labels for screen readers

## Testing

### Test Coverage

The filter bar has comprehensive test coverage in `src/components/attestation/AttestationFilterBar.test.tsx`:

- **Rendering**: Verifies tabs and dropdown display correctly
- **Counts**: Validates count badges update with data
- **Interactions**: Tests click and change events
- **Accessibility**: Checks ARIA attributes and keyboard navigation
- **Edge cases**: Empty arrays, undefined values, all-info history

### Running Tests

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Watch mode
pnpm test:watch
```

## Data Flow

1. **Fetch**: AttestationHistory fetches data from `/api/attestations`
2. **Filter**: AttestationFilterBar receives attestations and computes counts
3. **Select**: User selects severity/type filters
4. **Callback**: `onFilterChange` is called with new filter state
5. **Apply**: AttestationHistory applies filters to the attestation list
6. **Render**: Filtered attestations are displayed in the timeline

## Styling

### Severity Colors

- **Info (ok)**: Green (#05DF72) with green-50 background
- **Warning**: Orange (#FF8A04) with yellow-50 background
- **Violation**: Red (#FF6900) with red-50 background

### Tab States

- **Active**: Blue background (bg-blue-600) with white text
- **Inactive**: Gray background (bg-gray-100) with gray text
- **Hover**: Darker gray (bg-gray-200)

## Future Enhancements

Potential improvements for future iterations:

- **Date range filtering**: Filter attestations by time period
- **Search**: Text search across attestation titles and descriptions
- **Saved filters**: Allow users to save commonly used filter combinations
- **Export**: Export filtered attestations to CSV/JSON
- **Advanced filters**: Multi-select for types and severities

## Troubleshooting

### Empty State Shows When Filters Match Data

If you see "No attestations match the current filters" but expect results:
- Check that attestations have both `severity` and `kind` fields set
- Verify the attestation type matches one of: `health_check`, `violaton`, `fee_generation`, `drawdown`
- Ensure severity is one of: `ok`, `warning`, `violation`

### Counts Don't Update

If count badges don't reflect the actual data:
- Verify the `attestations` prop is being updated when data changes
- Check that attestations have the correct `severity` and `attestationType` fields
- Ensure the component re-renders when data changes

### TypeScript Errors

If you encounter TypeScript errors:
- Ensure `AttestationSeverity` and `AttestationType` are imported from `@/lib/types/domain`
- Verify the attestations array matches the expected interface
- Check that `onFilterChange` callback has the correct signature
