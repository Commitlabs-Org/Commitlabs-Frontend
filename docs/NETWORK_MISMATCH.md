# Network Mismatch Banner

## Overview

The `NetworkMismatchBanner` component detects when a connected Freighter wallet
is pointed at a different Stellar network than the app expects, and surfaces a
prominent warning before any transaction is attempted.

## How it works

1. `useWallet` (`src/hooks/useWallet.ts`) calls Freighter's `getNetworkDetails()`
   after a successful address fetch and exposes the result as `walletNetwork`
   (the network passphrase string, or `null` when unavailable).

2. `NetworkMismatchBanner` (`src/components/wallet/NetworkMismatchBanner.tsx`)
   compares `walletNetwork` against `NEXT_PUBLIC_NETWORK_PASSPHRASE` from the
   app's environment config. When they differ it renders a yellow alert bar at
   the top of every page (mounted in `src/app/layout.tsx`).

3. The banner is **dismissible per session**: clicking ✕ hides it for the
   current render session. It automatically **re-appears** whenever the wallet
   switches to a different mismatched network.

## Configuration

Set the expected network passphrase in your `.env` file:

```
NEXT_PUBLIC_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
```

Defaults to testnet if the variable is not set.

## Switching networks

Freighter does not expose a programmatic network-switch API to dApps. Users must
switch manually:

1. Open the Freighter extension.
2. Click the network name in the top-right corner.
3. Select the network that matches the app.

The "Switch in wallet" link in the banner opens `https://www.freighter.app` for
users who need installation or help.

## Accessibility

- The banner has `role="alert"` and `aria-live="assertive"` so screen readers
  announce it immediately on appearance.
- The dismiss button has an explicit `aria-label` and is keyboard-focusable.
- The "Switch in wallet" link is focusable with visible focus ring styles.

## Testing

Tests live in `src/components/wallet/NetworkMismatchBanner.test.tsx` and cover:

| Scenario | Expected |
|---|---|
| Wallet disconnected | No banner |
| Connected, networks match | No banner |
| Connected, `walletNetwork` is `null` | No banner |
| Connected, networks mismatch | Banner with `role="alert"` |
| Dismiss button clicked | Banner hidden |
| New mismatch after dismiss | Banner re-appears |

Run with:

```bash
pnpm test -- NetworkMismatchBanner
```
