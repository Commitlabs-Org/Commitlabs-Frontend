# Route-Aware Wallet Auth Guard

## Summary

Protected routes now render a wallet connection prompt instead of their page body when the visitor is disconnected. This keeps public routes like `/` and `/marketplace` open while gating `/create`, `/settings`, and the `/commitments` route tree behind a client-side wallet check.

## How it works

- `WalletProvider` is mounted in the root app layout and exposes `useWallet`.
- `RequireWallet` checks the current `connected` state and renders either:
  - the protected page content when connected, or
  - a dialog overlay with a connect action when disconnected.
- Route layouts in `src/app/create/layout.tsx`, `src/app/settings/layout.tsx`, and `src/app/commitments/layout.tsx` apply the guard without changing the route URL.

## Connect-and-continue flow

1. A disconnected visitor lands on a protected route.
2. The page body stays hidden behind the `RequireWallet` dialog.
3. The dialog focuses the primary connect button for keyboard and screen-reader users.
4. After a successful wallet connection, the dialog closes automatically and the current route is revealed in place.

## Accessibility notes

- The prompt uses a modal dialog with `role="dialog"` and `aria-modal="true"`.
- Focus moves to the primary action when the dialog opens.
- Focus stays trapped inside the dialog while it is open.
- Focus returns to the previously active element when the dialog closes.
