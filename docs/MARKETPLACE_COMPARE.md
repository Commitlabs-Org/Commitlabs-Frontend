# Marketplace Compare Tray

Buyers can pin up to three marketplace listings and open a side-by-side comparison without leaving the browse view.

## User flow

1. Each grid card exposes a **Compare** toggle in the header.
2. Pinned listings appear in a fixed bottom **Compare tray** with a count badge.
3. Click **Compare** in the tray (requires at least two listings) to open the comparison dialog.
4. Use **Clear** or **Dismiss** to empty the tray, or remove individual pins from the tray chips.

## Implementation

| Piece | Location |
|-------|----------|
| Selection state + session persistence | `src/hooks/useCompareListings.ts` |
| Bottom tray UI | `src/components/marketplace/CompareTray.tsx` |
| Side-by-side table | `src/components/marketplace/CompareView.tsx` |
| Card toggle | `src/components/MarketplaceCard.tsx` |
| Grid wiring | `src/components/MarketplaceGrid.tsx` |
| Page orchestration | `src/app/marketplace/page.tsx` |

## Persistence

Pinned listing payloads are stored in `sessionStorage` under `marketplace-compare-listings`. The set survives filter, sort, and pagination changes within the same browser tab.

## Limits and accessibility

- Maximum **3** pinned listings; additional cards show a disabled compare control with an explanatory `aria-label`.
- The tray is a dismissible `region`; the comparison view is a focus-trapped dialog closed with **Escape** or **Close**.
- Compare controls use `aria-pressed` to reflect pin state.

## Compared fields

The comparison table shows type, compliance score, amount, duration, yield (APY), max loss, price, and seller reputation (address + trust badge) using fields already present on `MarketplaceCardProps`.
