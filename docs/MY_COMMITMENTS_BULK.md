# My Commitments Bulk Actions

## Overview

The bulk actions feature allows users to select multiple commitments from the My Commitments grid and perform operations on them, such as exporting a subset of commitments. This provides a more efficient workflow for managing large portfolios.

## Features

### Multi-Select Functionality
- **Per-card selection**: Each commitment card has a checkbox for individual selection
- **Select all on page**: A master checkbox in the grid header selects/deselects all visible commitments
- **Indeterminate state**: The master checkbox shows an indeterminate state when some but not all items are selected
- **Selection persistence**: Selected items persist across filtering operations within the same session

### Bulk Action Bar
- **Fixed positioning**: Appears at the bottom of the screen when items are selected
- **Selection count**: Displays the number of selected commitments
- **Export selected**: Triggers export modal with only selected commitments
- **Clear selection**: Quickly deselects all items
- **Live region**: Uses ARIA live region for screen reader announcements

### Export Integration
- **Selected scope**: Export modal shows "Selected commitments" option when items are pre-selected
- **Count display**: Shows the number of selected commitments in the export modal
- **API integration**: Selected IDs are passed to the export endpoint as query parameters

## Architecture

### File Structure

```
src/
├── hooks/
│   └── useGridSelection.ts          # Selection state management hook
├── components/
│   ├── BulkActionBar.tsx            # Bulk action bar component
│   ├── MyCommitmentsGrid.tsx        # Updated with selection logic
│   ├── MyCommitmentCard.tsx         # Updated with selection checkbox
│   ├── export/
│   │   └── ExportCommitmentsModal.tsx # Updated to accept selectedIds
│   └── __tests__/
│       └── BulkActionBar.test.tsx   # RTL tests for bulk action bar
└── app/
    └── commitments/
        └── page.tsx                  # Updated to handle export selected
```

### Data Flow

1. **Selection State** (`useGridSelection` hook):
   - Manages `Set<string>` of selected IDs
   - Computes `isAllSelected` and `isIndeterminate` states
   - Provides `toggleSelection`, `selectAll`, `clearSelection` actions

2. **Grid Integration** (`MyCommitmentsGrid`):
   - Passes `isSelected` and `onSelect` to each card
   - Shows master checkbox with indeterminate state
   - Displays selection count in header
   - Renders `BulkActionBar` when items are selected

3. **Card Selection** (`MyCommitmentCard`):
   - Displays checkbox in top-right corner
   - Highlights selected cards with cyan border and ring
   - Prevents card click when clicking checkbox

4. **Export Flow**:
   - User selects commitments → clicks "Export selected"
   - Grid passes selected IDs to page handler
   - Page sets `selectedIdsForExport` and opens export modal
   - Modal receives `selectedIds` and shows selected scope
   - Export API receives IDs as query parameters

### Type Definitions

```typescript
// useGridSelection hook
interface UseGridSelectionOptions {
  visibleIds: string[];
  initialSelectedIds?: Set<string>;
}

interface UseGridSelectionReturn {
  selectedIds: Set<string>;
  selectedCount: number;
  isAllSelected: boolean;
  isIndeterminate: boolean;
  toggleSelection: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  setSelectedIds: (ids: Set<string>) => void;
}

// BulkActionBar props
interface BulkActionBarProps {
  selectedCount: number;
  onClear: () => void;
  onExportSelected: () => void;
  exportLabel?: string;
  isExporting?: boolean;
}

// ExportCommitmentsModal props (updated)
interface ExportCommitmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  ownerAddress?: string;
  sessionToken?: string;
  endpoint?: string;
  selectedIds?: string[]; // New prop
}
```

## Usage

### Basic Selection

```tsx
import { useGridSelection } from '@/hooks/useGridSelection';

const { selectedIds, toggleSelection, selectAll, clearSelection } = useGridSelection({
  visibleIds: commitments.map(c => c.id),
});

// Toggle individual item
toggleSelection(commitmentId);

// Select all visible
selectAll();

// Clear selection
clearSelection();
```

### Using BulkActionBar

```tsx
import { BulkActionBar } from '@/components/BulkActionBar';

<BulkActionBar
  selectedCount={selectedIds.size}
  onClear={clearSelection}
  onExportSelected={() => openExportModal(selectedIds)}
  isExporting={isExporting}
/>
```

### MyCommitmentsGrid with Selection

```tsx
<MyCommitmentsGrid
  commitments={filteredCommitments}
  onDetails={handleViewDetails}
  onAttestations={handleViewAttestations}
  onEarlyExit={openEarlyExitModal}
  onListForSale={openListForSaleModal}
  onExportSelected={handleExportSelected}
  isExporting={isExporting}
/>
```

## Accessibility

### Keyboard Navigation
- **Tab order**: Checkboxes are keyboard accessible via Tab key
- **Space/Enter**: Toggles checkbox state when focused
- **Master checkbox**: Selects/deselects all visible items

### ARIA Labels
- Checkboxes have descriptive labels: "Select commitment {id}"
- Master checkbox: "Select all commitments" / "Deselect all commitments"
- Action buttons: "Export {n} selected commitments", "Clear selection"

### Live Regions
- Bulk action bar uses `role="status"` with `aria-live="polite"`
- Screen readers announce selection count changes
- `aria-atomic="true"` ensures complete announcements

### Visual Indicators
- Selected cards: Cyan border (`border-[#0FF0FC]/50`) with ring
- Unselected cards: Default border with hover state
- Indeterminate checkbox: Native browser indeterminate state
- Focus rings: Visible on all interactive elements

## Testing

### Test Coverage

The `BulkActionBar` component has comprehensive RTL tests covering:

- Rendering with zero selections (hidden)
- Rendering with selections (visible)
- Singular/plural count display
- Export button click handler
- Clear button click handler
- Loading state (isExporting)
- Custom export label
- ARIA labels for accessibility
- Live region attributes

### Running Tests

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test src/components/__tests__/BulkActionBar.test.tsx

# Run with coverage
pnpm test:coverage
```

### Test Scenarios

- **Empty selection**: Bar should not render
- **Single selection**: Should show "1 commitment selected"
- **Multiple selection**: Should show "N commitments selected"
- **Export action**: Should call onExportSelected callback
- **Clear action**: Should call onClear callback
- **Loading state**: Export button should be disabled and show loading text

## API Integration

### Export Endpoint

When exporting selected commitments, the selected IDs are passed as query parameters:

```typescript
// URL construction
const url = new URL('/api/commitments/export', window.location.origin);
url.searchParams.set('ownerAddress', normalizedAddress);

// Add selected IDs
selectedIds.forEach(id => url.searchParams.append('ids', id));

// Result: /api/commitments/export?ownerAddress=GABC123&ids=CMT-001&ids=CMT-002&ids=CMT-003
```

### Backend Handling

The backend should:
1. Parse the `ids` query parameter array
2. Filter commitments to only include those IDs
3. Generate CSV with filtered results
4. Return CSV file for download

## Edge Cases

### Filtering While Selected
- Selected items persist even when filtered out
- Master checkbox only considers visible items
- Selection count shows total selected (not just visible)

### Empty Grid
- Master checkbox is disabled when grid is empty
- Bulk action bar doesn't render with zero selections
- Export modal shows "All commitments" when no selection

### Large Selections
- URL length limits: Consider POST for very large selections
- Performance: Selection state uses Set for O(1) lookups
- UI: Count displays without performance impact

## Future Enhancements

Potential improvements for future iterations:

- **Bulk actions beyond export**: Delete, archive, batch update
- **Selection persistence across sessions**: Save to user preferences
- **Keyboard shortcuts**: Ctrl+A to select all, Escape to clear
- **Selection ranges**: Shift+click for range selection
- **Select by filter**: Select all matching current filter
- **Bulk operations API**: Dedicated endpoints for batch operations

## Troubleshooting

### Selection Not Persisting
- Ensure `useGridSelection` is called with correct `visibleIds`
- Check that `toggleSelection` is properly passed to cards
- Verify selection state is not being reset by parent re-renders

### Export Not Using Selection
- Confirm `selectedIds` are passed to `ExportCommitmentsModal`
- Check that `handleExportSelected` sets state before opening modal
- Verify modal receives and displays selected count

### Indeterminate State Not Showing
- Ensure checkbox ref is properly set in `MyCommitmentsGrid`
- Check that `isIndeterminate` is computed correctly
- Verify `visibleIds` are up-to-date with filtered commitments

## Related Documentation

- [Export Commitments Modal](../src/components/export/ExportCommitmentsModal.tsx)
- [My Commitments Grid](../src/components/MyCommitmentsGrid.tsx)
- [My Commitment Card](../src/components/MyCommitmentCard.tsx)
- [Grid Selection Hook](../src/hooks/useGridSelection.ts)
- [Testing Guide](./DEVELOPER_GUIDE.md#testing)
