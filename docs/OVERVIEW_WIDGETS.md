# Overview Widgets — Customizable, Reorderable Layout

This document describes the customizable widget system for the commitments overview page (`src/app/commitments/overview/page.tsx`).

## Feature Overview

Users can show/hide and reorder the widgets on the overview page. The layout is persisted in `localStorage` so preferences survive page refreshes.

## Components

### `OverviewWidgetGrid` (`src/components/dashboard/OverviewWidgetGrid.tsx`)

Renders a list of widgets with show/hide toggles, drag-and-drop reordering, and keyboard-accessible reordering controls.

#### Props

| Prop | Type | Description |
|------|------|-------------|
| `widgets` | `WidgetConfig[]` | Ordered list of widget configurations |
| `onReorder` | `(fromIndex: number, toIndex: number) => void` | Called when widget order changes |
| `onToggleVisibility` | `(id: string) => void` | Called to show or hide a widget by id |
| `onReset` | `() => void` | Called to reset layout to defaults |
| `children` | `(id: string) => React.ReactNode` | Render function per widget id |

#### `WidgetConfig`

```ts
interface WidgetConfig {
  id: string;       // Unique identifier
  label: string;    // Human-readable name shown in the control bar
  visible: boolean; // Whether the widget content is rendered
  order: number;    // Ascending sort order
}
```

### `useWidgetLayout` (`src/hooks/useWidgetLayout.ts`)

Custom hook that manages widget state and persists it to `localStorage`.

```ts
const { widgets, reorder, toggleVisibility, reset } = useWidgetLayout();
```

| Return | Type | Description |
|--------|------|-------------|
| `widgets` | `WidgetConfig[]` | Current sorted widget configs |
| `reorder` | `(from: number, to: number) => void` | Move widget at `from` to `to` |
| `toggleVisibility` | `(id: string) => void` | Toggle a widget's `visible` flag |
| `reset` | `() => void` | Restore `DEFAULT_WIDGET_LAYOUT` |

## Usage Example

```tsx
import { OverviewWidgetGrid } from "@/components/dashboard/OverviewWidgetGrid";
import { useWidgetLayout } from "@/hooks/useWidgetLayout";

export default function MyPage() {
  const { widgets, reorder, toggleVisibility, reset } = useWidgetLayout();

  return (
    <OverviewWidgetGrid
      widgets={widgets}
      onReorder={reorder}
      onToggleVisibility={toggleVisibility}
      onReset={reset}
    >
      {(id) => {
        if (id === "my-widget") return <MyWidget />;
        return null;
      }}
    </OverviewWidgetGrid>
  );
}
```

## Accessibility

- **Keyboard reordering**: Focus a widget's grip handle, then press `ArrowUp`/`ArrowDown` to move it.
- **Screen reader announcements**: The widget list container uses `aria-live="polite"` to announce reorder changes.
- **Show/hide buttons**: Each toggle button has a descriptive `aria-label` and `aria-pressed` state.
- **`prefers-reduced-motion`**: Drag-and-drop uses no CSS transitions; the layout snaps without animation.
- **Focus management**: Keyboard focus remains on the reorder handle after a move, allowing repeated presses.

## Persistence

Layout is stored in `localStorage` under the key `overview-widget-layout`. The server-side preferences API (`/api/user/preferences`) also accepts an `overviewWidgetLayout` field for future cross-device sync.

## Reset to Default

Clicking **Reset to default** restores the two built-in widgets in their original order, both visible:

1. At-Risk Commitments
2. Commitment Detail

## Hidden Widgets and Data Fetching

When a widget is hidden (`visible: false`), its content is not rendered and any associated data fetches are skipped. For example, the at-risk commitments API call only runs when that widget is visible, avoiding unnecessary network requests.
