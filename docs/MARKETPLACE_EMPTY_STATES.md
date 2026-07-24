# Marketplace Empty States

## Overview

This feature adds distinct empty, filtered-empty, and error states to the MarketplaceResultsLayout component, along with retry and clear filters functionality.

## New/Updated Files

- `src/components/MarketplaceEmptyState.tsx` - Component for displaying empty/filtered/error states
- `src/components/MarketplaceResultsLayout.tsx` - Updated to use the new empty state component
- `src/components/__tests__/MarketplaceEmptyState.test.tsx` - Test suite for the new component
- `docs/MARKETPLACE_EMPTY_STATES.md` - This documentation file

## Usage

```tsx
import { MarketplaceResultsLayout } from '@/components/MarketplaceResultsLayout';

// Empty state
<MarketplaceResultsLayout
  totalCount={0}
  viewMode="grid"
  onViewModeChange={() => {}}
  currentPage={1}
  totalPages={0}
  onPageChange={() => {}}
  emptyStateType="empty"
>
  {/* children will not be shown when totalCount is 0 */}
</MarketplaceResultsLayout>

// Filtered empty state
<MarketplaceResultsLayout
  totalCount={0}
  viewMode="grid"
  onViewModeChange={() => {}}
  currentPage={1}
  totalPages={0}
  onPageChange={() => {}}
  emptyStateType="filtered"
  onClearFilters={handleClearFilters}
>
  {/* children will not be shown when totalCount is 0 */}
</MarketplaceResultsLayout>

// Error state
<MarketplaceResultsLayout
  totalCount={0}
  viewMode="grid"
  onViewModeChange={() => {}}
  currentPage={1}
  totalPages={0}
  onPageChange={() => {}}
  emptyStateType="error"
  onRetry={handleRetry}
>
  {/* children will not be shown in error state */}
</MarketplaceResultsLayout>
```

## Props

### MarketplaceEmptyStateProps
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| type | 'empty' \| 'filtered' \| 'error' | - | The type of state to display |
| onRetry | () => void | undefined | Callback for retry button (only shown in error state) |
| onClearFilters | () => void | undefined | Callback for clear filters button (only shown in filtered state) |

### MarketplaceResultsLayoutProps Extensions
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| emptyStateType | 'empty' \| 'filtered' \| 'error' | 'empty' | Determines which empty state to show when totalCount is 0 or error |
| onRetry | () => void | undefined | Passed to MarketplaceEmptyState for retry functionality |
| onClearFilters | () => void | undefined | Passed to MarketplaceEmptyState for clearing filters |

## Features

- **Empty State**: Shows when there are no commitments available at all
- **Filtered Empty State**: Shows when no commitments match the current filters, with Clear Filters button
- **Error State**: Shows when listings fail to load, with Try Again button
- **Accessible**: All buttons have proper ARIA labels and focus indicators
- **Reusable**: Uses ErrorLayout component for consistent error state styling

## Tests

The test suite covers:
- Rendering of all three states
- Callback functionality (onClearFilters, onRetry)
- Button visibility (shown only when callbacks provided)
