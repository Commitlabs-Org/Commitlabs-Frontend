# Relist & Edit Price — Inline Listing Management

## Overview

Sellers can manage their active marketplace listings directly from the
My Commitments card without navigating to a separate page. Two actions are
available depending on the listing status:

| Listing Status | Action Shown | Behaviour |
|----------------|-------------|-----------|
| `Active`       | **Edit price** | Cancels the current listing and creates a new one with the updated price. |
| `Cancelled`    | **Relist**     | Creates a fresh listing for the commitment. |

## Components

### `RelistPriceEditor`

**File:** `src/components/marketplace/RelistPriceEditor.tsx`

An inline editor that conditionally renders based on `listing.status`:

- **Display state** — Shows the current price and an action button
  (`"Edit price"` for active, `"Relist"` for cancelled).
- **Editing state** — After clicking the action button, the component
  expands to show a labelled price input, the asset currency, Save and
  Cancel buttons.
- **Validation** — Client-side checks run before the API call:
  - Price is required (non-empty).
  - Price must be a positive number.
  - Price cannot exceed 1,000,000,000.
- **API flow (edit price):**
  1. `DELETE /api/marketplace/listings/{listingId}` — cancels the
     existing active listing.
  2. `POST /api/marketplace/listings` — creates a new listing with the
     new price.
- **API flow (relist):**
  1. `POST /api/marketplace/listings` — creates a fresh listing.
- **Success:** The `onPriceUpdated` callback fires with the new price
  string; a success toast is shown.
- **Failure:** The price is rolled back to the previous value; an error
  toast is shown with the server message.
- **Accessibility:** The input has `aria-label`, `aria-invalid`, and
  `aria-describedby` wired to the validation error element. Buttons are
  disabled during submission.

### Props

```typescript
interface RelistPriceEditorProps {
  listing: MarketplaceListing;   // Current listing (Active or Cancelled)
  sellerAddress: string;         // Wallet address of the seller
  commitmentAsset: string;       // e.g. "XLM", "USDC"
  onPriceUpdated?: (newPrice: string) => void;
}
```

## Integration

### `MyCommitmentCard`

Two optional props were added:

```typescript
interface MyCommitmentCardProps {
  // ... existing props ...
  listing?: MarketplaceListing;
  sellerAddress?: string;
  onListingPriceUpdated?: (commitmentId: string, newPrice: string) => void;
}
```

When `listing` and `sellerAddress` are provided, a Listing Price section
appears between the commitment metrics and the action buttons. The
`RelistPriceEditor` is rendered inside a subtle card panel.

## Testing

**File:** `src/components/marketplace/RelistPriceEditor.test.tsx`

The test suite covers:

- **Display states** — renders nothing for `Sold`, shows Edit price for
  `Active`, shows Relist for `Cancelled`.
- **Inline editor** — opens on click, pre-fills current price, cancels
  and resets, shows correct labels per status.
- **Price validation** — empty, negative, zero, non-numeric, exceeds max,
  error clears on input change.
- **API submission** — edit price flow (cancel + create), relist flow
  (create only), rollback on API failure, error handling for non-ok
  status codes.
- **Accessibility** — `aria-invalid` + `aria-describedby` for errors,
  buttons disabled during submit.

Run with:

```bash
pnpm test -- src/components/marketplace/RelistPriceEditor.test.tsx
```

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| Cancel API returns 4xx/5xx | Error toast with server message; price rolled back. |
| Create API returns 4xx/5xx | Error toast with server message; price rolled back. |
| Network failure | Error toast with generic message; price rolled back. |
| Invalid input (client-side) | Inline validation error, no API call made. |

## Future Considerations

- When the backend supports a dedicated `PATCH /api/marketplace/listings/{id}`
  endpoint for price updates, the cancel-then-create flow can be simplified
  to a single request.
- The editor currently resets to display state after success. For the user
  to see the new price immediately, the parent component should update the
  `listing.price` via `onPriceUpdated`.
