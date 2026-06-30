# Real-Time Attestation Streaming

## Overview

`RecentAttestationsPanel` supports live attestation updates via Server-Sent Events (SSE). When a `commitmentId` prop is provided, the panel subscribes to `/api/commitments/[id]/events` and prepends new attestations to the list as they arrive — without a page reload.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `attestations` | `Attestation[]` | required | Static list rendered on initial load. |
| `summary` | `{ complianceCount, warningCount, violationCount }` | required | Initial summary counts; merged with live arrivals. |
| `onSelectAttestation` | `(id: string) => void` | required | Called when a row is clicked. |
| `onViewAll` | `() => void` | required | Called when "View All" is clicked. |
| `commitmentId` | `string \| null` | `null` | Commitment ID used to open the SSE stream. Pass `null` to disable streaming. |
| `streamingEnabled` | `boolean` | `true` | Set to `false` to disable streaming while keeping `commitmentId` available. |

## Usage Example

```tsx
import RecentAttestationsPanel from '@/components/RecentAttestationsPanel/RecentAttestationsPanel'

export default function CommitmentPage({ commitment, attestations }) {
  return (
    <RecentAttestationsPanel
      attestations={attestations}
      summary={commitment.summary}
      onSelectAttestation={(id) => console.log('selected', id)}
      onViewAll={() => router.push('/attestations')}
      commitmentId={commitment.id}
      streamingEnabled={true}
    />
  )
}
```

## `useAttestationStream` Hook

The hook lives at `src/hooks/useAttestationStream.ts` and can be reused independently.

```ts
import { useAttestationStream } from '@/hooks/useAttestationStream'

useAttestationStream({
  commitmentId: 'abc-123',
  onAttestation: (attestation) => console.log('new', attestation),
  enabled: true,
})
```

### Options

| Option | Type | Description |
|---|---|---|
| `commitmentId` | `string \| null` | Commitment to subscribe to. |
| `onAttestation` | `(a: Attestation) => void` | Callback fired for each received attestation event. |
| `enabled` | `boolean` | When `false` the stream is not opened. |

## Behaviour

### Deduplication

New arrivals are deduplicated against both the initial `attestations` prop and previously received live events (matched by `id`). Duplicate events are silently dropped.

### Reconnection with Back-off

On `EventSource` error the hook reconnects using exponential back-off:

- Initial delay: **1 000 ms**
- Multiplier: **×2** after each failure
- Maximum delay: **30 000 ms**

The stream is torn down on component unmount to prevent memory leaks.

### Fallback

When `EventSource` is unavailable (e.g. server-side render, unsupported browser) the hook exits silently and the panel renders the static `attestations` prop unchanged.

### Accessibility

A visually-hidden `role="status"` / `aria-live="polite"` live region announces each new attestation title. The announcement does not disrupt scroll position or move focus.

## Events Route

The server-side SSE endpoint is at `src/app/api/commitments/[id]/events/route.ts`. It emits the following events:

| Event name | Payload |
|---|---|
| `snapshot` | Initial commitment status on connect. |
| `status_change` | Emitted when commitment status transitions. |
| `attestation` | New attestation object (matches the `Attestation` interface). |
| `: keepalive` | SSE comment sent every ~20 s to keep the connection alive. |

## Testing

Tests are co-located with the component:

```
src/components/RecentAttestationsPanel/AttestationsRealtime.test.tsx
```

Run with:

```bash
pnpm vitest run src/components/RecentAttestationsPanel/AttestationsRealtime.test.tsx
```

Covered scenarios: initial render, SSE subscription URL, live prepend, deduplication, live region announcement, summary count update, EventSource unavailable fallback, reconnect with back-off, streaming disabled.
