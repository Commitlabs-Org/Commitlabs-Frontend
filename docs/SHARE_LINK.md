# Commitment Share Links

Commitment detail pages expose a share action in `src/components/Commitmentdetailheader.tsx`.
The action builds a canonical deep link for the current commitment:

```ts
/commitments/:commitmentId
```

The implementation lives in `src/hooks/useShareLink.ts`.

## Behavior

- The hook builds the URL from the current origin and commitment id.
- When the browser supports the Web Share API, it calls `navigator.share()` with the title, text, and URL.
- When native share is not available, it falls back to `navigator.clipboard.writeText()`.
- Success and failure states are announced through the existing `ToastProvider` live region.
- Unsupported browsers and failed clipboard writes are handled without throwing.

## Usage

```tsx
import { useShareLink } from '@/hooks/useShareLink';

const shareCommitment = useShareLink({
  commitmentId,
  title: `CommitLabs commitment ${commitmentId}`,
  text: 'View this CommitLabs commitment.',
});
```

Use the returned callback from a keyboard-focusable button. Keep visible focus styles on the control so keyboard users can find the share action.
