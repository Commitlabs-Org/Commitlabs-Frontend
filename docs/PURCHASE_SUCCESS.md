# Purchase Success Modal

Closes the purchase loop after a successful marketplace transaction by showing a confirmation with ownership-transfer details and next-step actions.

## User Flow

1. User clicks **Trade** on a `MarketplaceCard` that has an `onPurchase` handler.
2. The card calls `onPurchase(id)` and disables the button while the transaction is in flight.
3. On success, `PurchaseSuccessModal` opens with the ownership summary.
4. User can copy the tx hash, open Stellar Explorer, or navigate to **My Commitments**.

If no `onPurchase` prop is provided, the Trade button falls back to `router.push(tradeHref)` (the previous behaviour).

## Component

`src/components/modals/PurchaseSuccessModal.tsx`

### Props

| Prop | Type | Required | Description |
|---|---|---|---|
| `isOpen` | `boolean` | ✓ | Controls modal visibility |
| `onClose` | `() => void` | ✓ | Called when the user dismisses the modal |
| `commitmentId` | `string` | ✓ | Raw commitment id, zero-padded to 3 digits in the UI |
| `commitmentType` | `string` | ✓ | Human-readable type label (e.g. `"Safe Commitment"`) |
| `pricePaid` | `string` | ✓ | Formatted price string (e.g. `"1,000 USDC"`) |
| `txHash` | `string` | — | Transaction hash; missing hash is handled gracefully |
| `onViewCommitments` | `() => void` | ✓ | Called when user clicks "View in My Commitments" |

### Usage

```tsx
// In a page or parent component
async function handlePurchase(id: string): Promise<string | undefined> {
  const result = await buyCommitment(id); // your purchase logic
  return result.txHash;
}

<MarketplaceCard
  {...cardProps}
  onPurchase={handlePurchase}
/>
```

`MarketplaceCard` manages all modal state internally; no additional wiring is required.

## Accessibility

- Built on the shared `Dialog` primitive — focus is trapped inside the modal while open, and restored to the trigger on close.
- Initial focus lands on the primary "View in My Commitments" CTA.
- `aria-modal`, `aria-labelledby`, and `aria-describedby` are set.
- Copy-hash confirmation uses a `role="status"` live region.
- Escape key closes the modal.

## Tests

`src/components/modals/PurchaseSuccessModal.test.tsx`

Covers: rendering (open/closed), ownership summary display, tx hash truncation, missing hash fallback, copy-hash affordance, CTA callbacks, close callbacks, and ARIA attributes.
