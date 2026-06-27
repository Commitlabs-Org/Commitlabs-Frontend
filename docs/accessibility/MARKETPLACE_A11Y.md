# Marketplace Keyboard & Focus Accessibility

This document summarizes the audit and fixes for keyboard navigation and `:focus-visible` rings across marketplace filters, results layout, grid, and cards.

## Audit findings

| Component | Issue | Fix |
| :--- | :--- | :--- |
| `MarketplaceFilters` | Section headers were non-focusable `div` click targets | Replaced with `button` toggles using `aria-expanded` / `aria-controls` |
| `MarketplaceFilters` | Reset control lacked explicit button semantics | Added `type="button"` and retained `focus-ring` |
| `MarketplaceResultsLayout` | Icon-only view toggles lacked accessible names | Added `aria-label` for grid/list view buttons |
| `MarketplaceResultsLayout` | Pagination controls used ad-hoc focus styles | Standardized on shared `focus-ring` utility |
| `MarketplaceCard` | Card wrapper was an extra tab stop (`tabIndex={0}`) | Removed wrapper tab stop; actions remain keyboard reachable |
| `MarketplaceCard` | View actions missing explicit button type | Added `type="button"` to view controls |
| `MarketplaceGrid` | Empty results had no programmatic focus target | Added focusable empty-state container (`tabIndex={-1}`) |

## Keyboard expectations

- Filter section headers are reachable via Tab and toggle with Enter/Space.
- Filter chips, range inputs, reset, view toggles, pagination, and card actions are all operable without a pointer.
- Focus rings use the shared `focus-ring` class defined in `src/app/globals.css`.

## Tests

Coverage lives in `src/components/__tests__/MarketplaceKeyboardA11y.test.tsx` and validates:

- Section toggle `aria-expanded` behavior
- Keyboard activation for chips and reset
- Tab order across filters, view toggles, and card actions
- View mode keyboard toggling
- Empty-state focus target presence
- `focus-ring` class on card actions

Run:

```bash
pnpm test src/components/__tests__/MarketplaceKeyboardA11y.test.tsx
```
