# TrustBadge Test Coverage

`src/components/__tests__/TrustBadge.test.tsx` covers the TrustBadge component with React Testing Library and Vitest.

Covered behavior:

- Every supported `TrustLevel` value renders its visible label and icon.
- Tooltip-enabled badges expose the tooltip text through `aria-describedby`.
- `showTooltip={false}` removes the tooltip and accessible description.
- Custom `className` values are merged without dropping trust-level styling.
- Unknown trust levels fall back to the unverified badge copy.

Run the focused test locally with:

```bash
pnpm test -- --run src/components/__tests__/TrustBadge.test.tsx
```
