# Wallet Account Menu

## Overview
This feature adds a wallet account dropdown menu to the navigation bar for connected users, providing quick access to wallet information and actions.

## Features
- **Connect Button**: Shown when wallet is not connected
- **Account Menu**: Shown when wallet is connected, including:
  - Truncated wallet address (copyable)
  - Current network (Public/Testnet)
  - Link to view account on Stellar.Expert
  - Disconnect button (clears wallet state and session)
- **Keyboard Accessible**: Closes on Escape key
- **Click Outside**: Closes when clicking outside the menu
- **Error States**: Shows user-friendly error messages for connection issues

## Files Modified/Added
- `src/components/wallet/WalletAccountMenu.tsx`: New wallet account menu component
- `src/components/landing-page/Navigation.tsx`: Updated to use WalletAccountMenu
- `src/components/wallet/WalletAccountMenu.test.tsx`: Tests for the wallet account menu
- `docs/WALLET_ACCOUNT_MENU.md`: This documentation

## Usage
The WalletAccountMenu component is designed to be used in the navigation bar. It automatically handles:
- Wallet connection via Freighter
- Session management (logout via API)
- Network detection (from protocol constants)
- Accessibility best practices
