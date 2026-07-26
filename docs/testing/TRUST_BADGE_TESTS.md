# TrustBadge Test Coverage

This document summarizes the RTL/Vitest coverage for `src/components/TrustBadge.tsx`.

## Cases covered

| Area | Assertions |
| :--- | :--------- |
| Trust levels | `verified`, `reputable`, and `unverified` each render the expected label, icon (`svg`), and color class |
| Tooltip | Tooltip content is present with `role="tooltip"` when `showTooltip` is true; omitted when false |
| Accessibility | Badge uses `role="status"`, `aria-label`, and `aria-describedby` linked to the tooltip id |
| Non-color signal | Visible text label is present and exposed as the accessible name |
| className merge | Custom classes are merged with default badge styling |
| Fallback | Unknown levels fall back to the unverified badge configuration |
| Edge cases | Empty `className` preserves default layout and color classes |

## Running tests

```bash
pnpm test src/components/__tests__/TrustBadge.test.tsx
```
