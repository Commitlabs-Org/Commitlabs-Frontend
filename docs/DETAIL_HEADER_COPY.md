# Commitment Detail Header Copy and Explorer Actions

`CommitmentDetailHeader` exposes quick actions beside the commitment id so users can preserve the full identifier or inspect it externally without leaving the detail context.

## Behavior

- `Copy ID` writes the full `commitmentId` prop to the clipboard.
- A transient `Copied` status confirms a successful copy.
- If `navigator.clipboard.writeText` is unavailable or fails, the component shows `Clipboard unavailable` instead of throwing.
- `Explorer` links are built with `buildExplorerUrl('contract', commitmentId, explorerNetwork)`.
- Invalid or unsupported identifiers render a disabled `Explorer unavailable` control rather than an unsafe URL.

## Props

```tsx
<CommitmentDetailHeader
  commitmentId={commitmentId}
  statusLabel="Active"
  statusVariant="active"
  explorerNetwork="testnet"
  onBack={handleBack}
  onShare={handleShare}
/>
```

`explorerNetwork` is optional and defaults to `public`. Use `testnet` when the commitment id refers to a testnet contract.

## Accessibility

- Both actions are keyboard focusable when available.
- The copy action has an explicit accessible name.
- Copy outcomes are announced through a polite status region.
- External explorer links use `target="_blank"` with `rel="noopener noreferrer"`.
