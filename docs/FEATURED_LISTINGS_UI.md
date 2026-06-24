# Featured Listings Carousel

The marketplace featured carousel reads from `GET /api/marketplace/featured` and presents the returned curated listings before the full marketplace results area.

## Data source

The endpoint returns the standard API wrapper with `data.listings` and `data.total`. Each listing uses the backend `MarketplacePublicListing` shape:

- `listingId`
- `commitmentId`
- `type`
- `amount`
- `remainingDays`
- `maxLoss`
- `currentYield`
- `complianceScore`
- `price`

The carousel also accepts an unwrapped `{ listings, total }` payload in case local mocks bypass the API wrapper.

## UI behavior

- Loading: renders a compact status panel while the request is in flight.
- Empty: returns `null`, so the marketplace page keeps the existing grid flow.
- Error: renders an inline alert with a retry button.
- Success: maps each listing into the existing `MarketplaceCard` and adds a small trust/risk strip using `TrustBadge` plus max-loss copy.

## Accessibility notes

The carousel is exposed as a labelled region with a focusable horizontal list. Prev/next buttons call the same scrolling path as the keyboard controls. When the list has focus, ArrowLeft and ArrowRight move by approximately one card width without trapping focus.

## Review checklist

- Mock `/api/marketplace/featured` with one, many, empty, and failed responses.
- Confirm the section disappears for empty results.
- Confirm the focus ring is visible on the list and controls.
- Confirm cards keep their existing details/trade behavior because rendering is delegated to `MarketplaceCard`.