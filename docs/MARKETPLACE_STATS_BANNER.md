# Marketplace Stats Banner

## Overview

The `MarketStatsBanner` is a React component that displays real-time, market-wide statistics at the top of the Marketplace. Its primary goal is to **orient buyers with market-wide context before they filter** listings.

It fetches data directly from the `/api/marketplace/stats` endpoint and visually represents it using our standard `KPICard` component.

## Implementation Details

- **Location**: `src/components/MarketplaceHeader/MarketStatsBanner.tsx`
- **Data Source**: `/api/marketplace/stats`

### KPI Chips Displayed
Based on the current API structure, the following KPI chips are displayed:
1. **Total Listings**: (`activeListings`) 
2. **Average APY**: (`averageYield`)
3. **Median Price**: (`medianPrice`)

*Note: The original requirements mentioned displaying "24h volume" and "active sellers". However, these fields are not currently exposed by the `MarketplaceStats` backend interface, so the component strictly uses the real available fields to prevent fabricated data.*

## Features & States

- **Loading State**: Displays skeleton-loading `KPICard` chips while the data is fetched, ensuring a layout-stable experience.
- **Success State**: Uses the `format="count/percentage/currency"` props of `KPICard` for locale-aware and accessible number formatting.
- **Error State**: Degrades gracefully. If the fetch fails, it replaces the chips with a subtle, inline error message and a "Retry" button. It avoids bringing down or breaking the larger header structure.
- **Responsive**: Adapts layout to wrap chips gracefully on mobile using flexbox styling.
- **Accessibility**: Includes `aria-live="polite"` and proper ARIA labels so screen readers are updated when the market stats finish loading or fail.

## Usage

The component is entirely self-contained and manages its own data-fetching and state. It is injected into the `MarketplaceHeader`:

```tsx
import { MarketStatsBanner } from './MarketStatsBanner';

export function MarketplaceHeader() {
  return (
    <header>
      {/* ...other header content... */}
      <MarketStatsBanner />
      {/* ...other header content... */}
    </header>
  );
}
```
