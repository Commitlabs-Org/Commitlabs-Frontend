# Transaction Progress Persistence

`TransactionProgressModal` persists in-flight transaction status so a browser
reload does not leave users guessing whether a wallet action is still pending,
submitted, confirming, or failed.

## Behavior

- The modal writes non-terminal states to `localStorage` under
  `commitlabs.transactionProgressModal.v1`.
- Persisted fields are limited to UI-safe progress data: status, action name,
  optional success text, transaction hash, and normalized error code.
- On mount, the modal rehydrates a saved pending or failed transaction when the
  parent page has reset to `IDLE`.
- The restored modal keeps the same timeline phase, transaction hash display,
  copy-hash action, explorer link, and retry or close affordances.
- Success clears persisted state immediately. Failed transactions clear after
  the user acknowledges the failure by closing the modal or retries the action.
- If browser storage is unavailable or blocked, persistence is skipped and the
  modal continues to render normally.

## Usage

No new props are required. Existing callers continue to control the modal with
`isOpen`, `state`, `actionName`, `txHash`, `errorCode`, `onClose`, and `onRetry`.
The component only restores its own saved state when the caller is not currently
showing an active transaction.

```tsx
<TransactionProgressModal
  isOpen={isTransactionOpen}
  state={transactionState}
  actionName="Creating Commitment"
  txHash={transactionHash}
  errorCode={errorCode}
  onClose={closeTransactionModal}
  onRetry={retryTransaction}
/>
```

## Accessibility

The restored modal uses the same dialog, heading, timeline, and live-region
semantics as the live transaction flow. Copy and retry controls remain keyboard
accessible after reload.
