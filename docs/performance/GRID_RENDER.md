# Grid render performance: memoized commitment cards

## Summary

`MyCommitmentsGrid` and `MarketplaceGrid` render lists of cards that are filtered
and sorted client-side. Before this change, **every card re-rendered on every
filter/sort/search keystroke**, even cards whose data had not changed. With large
lists this produced visible jank.

The fix memoizes the card components and stabilizes the props they receive, so a
filter or sort only re-renders the cards that actually changed.

## What changed

| File | Change |
| --- | --- |
| [`src/components/MyCommitmentCard.tsx`](../../src/components/MyCommitmentCard.tsx) | Default export wrapped in `React.memo`. |
| [`src/components/MarketplaceCard.tsx`](../../src/components/MarketplaceCard.tsx) | Component split into `MarketplaceCardComponent` and exported as `React.memo(MarketplaceCardComponent)`. |
| [`src/app/commitments/page.tsx`](../../src/app/commitments/page.tsx) | The `onDetails` / `onAttestations` handlers passed to the grid are now wrapped in `useCallback` so their identity is stable across re-renders. |

No behaviour changed: the cards render the same markup, the filter/sort/search
logic is untouched, and the list keys were already stable (`commitment.id` /
`item.id`, never the array index).

## Why it works

`React.memo` skips a re-render when the new props are shallowly equal to the
previous props. The two cards receive props differently, which is worth
understanding:

- **`MyCommitmentCard`** receives a single `commitment` object plus three
  callbacks. The `filteredCommitments` `useMemo` in the page filters/sorts the
  **same** commitment objects, so each surviving card keeps its object identity.
  The callbacks are the only props that were unstable — inline arrow functions
  recreated on every render — so they are now stabilized with `useCallback`.
  (`onEarlyExit` was already a stable `useCallback`.) With a stable object and
  stable callbacks, memo skips unchanged cards.

- **`MarketplaceCard`** receives its props spread from the listing object
  (`<MarketplaceCard {...item} />`) and takes no callbacks. `React.memo` shallow-
  compares each primitive prop, so a card re-renders only when one of its values
  changes — not merely because the surrounding list array was rebuilt. This means
  paginating, filtering, or re-sorting the marketplace no longer re-renders the
  visible cards whose values are unchanged.

## Before / after render counts

Counts are the number of card render-function invocations, measured with the
render-counting spies in
[`src/components/__tests__/GridMemoization.test.tsx`](../../src/components/__tests__/GridMemoization.test.tsx)
for a 3-card list. "Re-renders on change" is the number of cards whose render
function runs after the described change.

### MyCommitmentsGrid (3 cards)

| Interaction | Before (no memo) | After (memo + stable props) |
| --- | --- | --- |
| Initial mount | 3 | 3 |
| Filter removes 1 card | 2 (both survivors re-render) | 0 |
| One card's data changes | 3 | 1 (only the changed card) |
| Sort-only reorder | 3 | 0 |
| All card objects replaced | 3 | 3 |

### MarketplaceGrid (3 cards)

| Interaction | Before (no memo) | After (memo + stable props) |
| --- | --- | --- |
| Initial mount | 3 | 3 |
| Filter removes 1 card | 2 (both survivors re-render) | 0 |
| One listing's value changes | 3 | 1 (only the changed card) |
| Sort-only reorder | 3 | 0 |
| Listing objects cloned, no value change | 3 | 0 |
| Every listing's value changes | 3 | 3 |

In short: unchanged cards drop from **N re-renders per interaction to 0**, while
the correctness of "changed cards still update" is preserved.

## How it is tested

`src/components/__tests__/GridMemoization.test.tsx` replaces the real cards with
lightweight `React.memo`-wrapped spies that tally render-function calls per card
id, then drives each grid through a `rerender` for every scenario above and
asserts the expected counts. Two additional tests import the **real** card
components and assert each is a `React.memo` component
(`$$typeof === Symbol.for('react.memo')`) and still renders correctly.

Run them with:

```bash
pnpm exec vitest run src/components/__tests__/GridMemoization.test.tsx
```
