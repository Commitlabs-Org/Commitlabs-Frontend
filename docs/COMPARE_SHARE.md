# Marketplace Compare Share URLs

Marketplace comparison selections are reload-safe and shareable through the
`compare` query parameter on `/marketplace`.

## Behavior

- `useCompareListings` reads `?compare=001,002` on mount and resolves those ids
  against the current marketplace listing set.
- Only listing ids are written to the URL. Full listing payloads remain in
  component state and `sessionStorage`.
- Invalid, duplicate, or expired ids are ignored.
- Restored sets are capped at `MAX_COMPARE_LISTINGS` so shared URLs cannot
  exceed the same limit enforced by the card UI.
- When a shared URL restores at least two valid listings, `CompareTray` opens
  `CompareView` once so the side-by-side view is reproduced deterministically.
- Removing a listing, toggling a card, or clearing the tray updates the URL
  immediately with `history.replaceState`.

## Usage

Pass the full set of marketplace listings to the hook so ids from the URL can
be resolved even when the current page or filters do not show those cards.

```tsx
const {
  listings,
  isPinned,
  isFull,
  toggleListing,
  removeListing,
  clearAll,
  restoredFromUrl,
} = useCompareListings(allMarketplaceListings);

<CompareTray
  listings={listings}
  onRemove={removeListing}
  onClear={clearAll}
  openOnRestore={restoredFromUrl}
/>
```

## Accessibility

The share URL does not introduce extra focus targets. When the comparison view
opens from a restored URL, it uses the existing modal focus behavior: focus
moves to the close button, Escape closes the dialog, and focus returns to the
previous element when possible.

## Tests

Coverage lives in:

- `src/hooks/useCompareListingsShare.test.ts`
- `src/hooks/useCompareListings.test.ts`
- `src/components/marketplace/CompareTray.test.tsx`
