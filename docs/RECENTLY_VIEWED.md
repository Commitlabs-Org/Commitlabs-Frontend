# Recently-Viewed Listings Rail

This document describes the design, architecture, and implementation of the "Recently Viewed" listings rail added to the marketplace.

## Overview
To improve user continuity across marketplace browsing sessions, a client-side "Recently Viewed" rail tracks which listings the user has opened details for. It displays these recently viewed items in a compact, accessible, horizontal rail above the main listings grid.

```
+---------------------------------------------------------------+
|                        Marketplace Header                     |
+---------------------------------------------------------------+
|  (R) Recently Viewed                                 [Clear]  |
|  [<]  [ #CMT-001 ]  [ #CMT-002 ]  [ #CMT-003 ]           [>]  |
+---------------------------------------------------------------+
|  Filters             |  Marketplace Grid                      |
|                      |  [ Card ]  [ Card ]  [ Card ]          |
|                      |  [ Card ]  [ Card ]  [ Card ]          |
+---------------------------------------------------------------+
```

## Architecture

The feature consists of three main parts:
1. **State Management Hook (`src/hooks/useRecentlyViewed.ts`)**: Manages the persistence, eviction, and deduplication of viewed listing IDs.
2. **UI Component (`src/components/marketplace/RecentlyViewedRail.tsx`)**: Renders a compact scrollable list of viewed items with horizontal navigation controls.
3. **Integration (`src/app/marketplace/page.tsx` & `src/components/MarketplaceCard.tsx`)**: Listens to detail modal openings to track views and renders the rail.

---

## 1. The state hook: `useRecentlyViewed`
Located at `src/hooks/useRecentlyViewed.ts`, this hook:
- **Persists views**: Uses `localStorage` to persist listing IDs across page refreshes and filter/sort modifications.
- **Limits history**: Capped at `10` listings by default (`MAX_RECENT_LISTINGS`). If the cap is reached, the oldest viewed item is evicted.
- **Deduplicates repeat views**: If a user views a listing they've already viewed, the ID is moved to the front (beginning) of the history rail, rather than creating a duplicate entry.
- **Hydration safety**: Avoids hydration mismatch errors in Next.js by waiting until the component is mounted on the client (`isHydrated = true`) before reading or writing to `localStorage`.

---

## 2. The component: `RecentlyViewedRail`
Located at `src/components/marketplace/RecentlyViewedRail.tsx`, this component:
- **Survives filter changes**: Resolves listing metadata by mapping stored IDs against the static mock listings list. Therefore, even if the active filters hide a listing in the main grid, it remains visible in the recently viewed rail.
- **Accessible keyboard navigation**:
  - The scroll container is focusable via keyboard (`tabIndex={0}`) and responds to `ArrowLeft` and `ArrowRight` keystrokes.
  - Individual cards are `<button>` elements that can be focused and clicked using `Enter`/`Space` keys. Focus states automatically scroll the focused card into view.
- **Horizontal Scroll Controls**:
  - Automatically checks if content overflows the view container.
  - Dynamically displays and enables smooth-scrolling `ChevronLeft` and `ChevronRight` buttons.
- **Integrated Details Modal**: Clicking a rail card launches the `CommitmentDetailsModal` for that listing, making it easy for users to pick up where they left off.
- **Clear Action**: A "Clear" button empties the rail and resets the client storage.

---

## 3. Integration
- **`src/components/MarketplaceCard.tsx`**: Triggers the `onView` prop inside a `useEffect` hooked to the `isModalOpen` state.
- **`src/components/MarketplaceGrid.tsx`**: Passes the `onView` prop from the page down to each marketplace card.
- **`src/app/marketplace/page.tsx`**: Initializes `useRecentlyViewed` and renders `<RecentlyViewedRail />` above the grid inside the main content area.

---

## Coverage and Tests
Comprehensive test suites cover:
- Hook functionality (`src/hooks/useRecentlyViewed.test.ts`):
  - Storage restoration.
  - Deduplication and re-ordering on repeat view.
  - History capping and eviction.
  - Rail clearing.
- Component accessibility & interaction (`src/components/marketplace/RecentlyViewedRail.test.tsx`):
  - Empty-state rendering (renders nothing).
  - Accurate card rendering.
  - Clear button action.
  - Modal opening and closing on card click.
  - Arrow key scrolling keyboard interaction.
