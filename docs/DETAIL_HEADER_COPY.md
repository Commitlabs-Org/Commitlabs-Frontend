# Commitment Detail Header Copy and Explorer Actions

`CommitmentDetailHeader` exposes two detail-page affordances for the commitment identifier:

- Copy the full commitment id to the clipboard, even when the visible heading is truncated.
- Open the commitment in Stellar Explorer through the sanitized `buildExplorerUrl` helper.

## Props

```tsx
<CommitmentDetailHeader
  commitmentId="C..."
  statusLabel="Active"
  statusVariant="active"
  onBack={handleBack}
  onShare={handleShare}
  explorerId="C..."
  explorerNetwork="testnet"
/>
```

`explorerId` is optional and falls back to `commitmentId`. The explorer link is hidden when the identifier is not valid for a Stellar contract URL. `explorerNetwork` defaults to `testnet`.

## Accessibility

The copy and explorer controls use explicit accessible names, keyboard-focusable native controls, and `noopener noreferrer` for the external link. Copy success is announced through a polite live region and shown as a transient `Copied` label. If the Clipboard API is unavailable, the copy button is disabled instead of throwing.
