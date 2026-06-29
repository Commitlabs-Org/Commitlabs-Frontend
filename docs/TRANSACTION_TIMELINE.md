# Transaction timeline

The transaction progress modal now renders a four-step timeline that mirrors the transaction lifecycle:

1. Build — prepare the transaction payload.
2. Sign — wait for wallet confirmation.
3. Submit — broadcast the transaction to the network.
4. Confirm — wait for ledger confirmation.

## Behavior

- The active step is highlighted while the transaction is in progress.
- Completed steps are marked done.
- Failed steps remain visible so users can understand where the flow stopped.
- The active step shows an elapsed-time indicator while the modal is in progress.
- A live region announces the current phase for assistive technology.
- The timeline respects `prefers-reduced-motion` by avoiding the elapsed timer animation.

## Error state affordances

When a transaction fails, the timeline remains visible and exposes the transaction hash with a copy action so the user can preserve the reference while retrying.
