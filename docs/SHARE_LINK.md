# Commitment Share Link

Commitment detail pages expose a share action in `src/components/Commitmentdetailheader.tsx`.

The share action uses `src/hooks/useShareLink.ts` to build a canonical URL from the current origin and commitment id:

```text
/commitments/[id]
```

When `navigator.share` is available, the hook opens the native share sheet with the commitment title and URL. If Web Share is unavailable or fails, it falls back to `navigator.clipboard.writeText`.

Success and failure messages go through the existing `ToastProvider`, so users get visible feedback and screen readers receive the toast announcement through the provider live regions. Unsupported browsers do not throw; they show an error toast if neither Web Share nor clipboard copy succeeds.

The share button remains a native button with a visible `focus-visible` ring for keyboard users.
