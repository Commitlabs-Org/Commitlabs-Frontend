# DisputeStatusTracker

A read-only stepper component that visualises the lifecycle of a dispute for a
Commitlabs commitment. It supports both static (mock / prop-driven) data and a
real-time SSE-powered mode that live-updates the dispute stage.

---

## Props

| Prop           | Type                  | Required | Default     | Description                                                                                                                                                                                                                                                                                            |
| -------------- | --------------------- | -------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `dispute`      | `DisputeInfo \| null` | Yes      | —           | The current dispute state. Pass `null` when no dispute is active — the stepper renders an idle "no active dispute" placeholder.                                                                                                                                                                        |
| `commitmentId` | `string`              | No       | `undefined` | When provided, the component subscribes to a Server-Sent Events (SSE) stream for this commitment and overlays live dispute-stage updates on top of the `dispute` prop. Also renders the live-connection status badge (see below). When omitted, the component operates purely from the `dispute` prop. |

### `DisputeInfo`

```ts
interface DisputeInfo {
  /** Current dispute stage */
  stage: 'filed' | 'under_review' | 'escalated' | 'resolved' | 'dismissed';

  /** ISO-8601 timestamp when the dispute was formally filed */
  filedAt: string;

  /** Human-readable category (e.g. "Compliance violation") */
  reasonCategory: string;

  /** ISO-8601 timestamp when review was initiated (optional) */
  reviewStartedAt?: string;

  /** ISO-8601 timestamp when the dispute was resolved (optional) */
  resolvedAt?: string;

  /** Human-readable resolution summary (optional) */
  resolution?: string;
}
```

---

## SSE-Driven Live Status Badge

When a `commitmentId` prop is supplied, `DisputeStatusTracker` subscribes to the
commitment events SSE stream via the `useDisputeSSE` hook. A connection-status
badge is rendered in the upper-right corner of the component header with three
possible states:

### States

| State             | Visual indicator                     | Meaning                                                                                                                                                                                                                       |
| ----------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Live**          | Pulsing green dot + `"Live"`         | The SSE connection is healthy and the component is receiving real-time updates. The displayed dispute information reflects the latest on-chain state.                                                                         |
| **Connecting…**   | Solid yellow dot + `"Connecting…"`   | The initial SSE handshake is in progress. This is shown on first mount before the first event is received.                                                                                                                    |
| **Reconnecting…** | Solid orange dot + `"Reconnecting…"` | The SSE connection was lost and the hook is attempting to re-establish it using exponential backoff (1 s → 2 s → 4 s → … up to 30 s). The component continues to display the last known dispute data from the `dispute` prop. |

### How it works

1. The `useDisputeSSE` hook opens a `fetch`-based connection to
   `GET /api/commitments/:id/events` with `Accept: text/event-stream`.

2. The SSE endpoint emits two event types:
   - **`snapshot`** — sent immediately on connection, contains the current
     commitment status (`Active`, `Settled`, `Violated`, `Early Exit`).
   - **`status_change`** — emitted whenever the on-chain status transitions.

3. When the status transitions to `"Violated"`, the hook synthesises a live
   `DisputeInfo` object with `stage: 'under_review'` and the transition
   timestamp.

4. If the status later transitions away from `"Violated"` (e.g. to `"Settled"`
   or `"Active"`), the dispute is marked as `stage: 'resolved'` with a
   corresponding resolution note.

5. On connection loss, the hook retries with exponential backoff and sets
   the state to `"reconnecting"`.

### Accessibility

The live badge uses `role="status"` and `aria-live="polite"` so that screen
readers announce connection-state changes without interrupting the user's
current task. The `aria-label` on the badge is
`"SSE connection: Live"` / `"SSE connection: Connecting…"` /
`"SSE connection: Reconnecting…"`.

---

## Data Sources

| Source                               | Used when                | Priority                                  |
| ------------------------------------ | ------------------------ | ----------------------------------------- |
| `dispute` prop                       | Always                   | Lowest — base data for the stepper        |
| SSE stream (`commitmentId` supplied) | `commitmentId` is truthy | Higher — live data overlays the prop      |
| Mock / idle state                    | `dispute` is `null`      | Shows the "No active dispute" placeholder |

The component merges these sources with a simple rule: **live SSE data always
takes precedence over the static `dispute` prop**. When the SSE stream has not
yet produced a dispute object, the component falls back to the `dispute` prop.

---

## Usage

```tsx
import DisputeStatusTracker, { type DisputeInfo } from '@/components/dispute/DisputeStatusTracker';

// Static mode (no live updates)
<DisputeStatusTracker dispute={myDispute} />

// Live mode with SSE
<DisputeStatusTracker
  dispute={myDispute}
  commitmentId="commitment-abc-123"
/>
```

---

## Accessibility

- The stepper is marked up as an ordered list (`<ol>`) with `role="list"`.
- The current step uses `aria-current="step"`.
- The SSE badge uses `role="status"` and `aria-live="polite"`.
- The empty state includes a decorative SVG (`aria-hidden="true"`) and
  descriptive text.
- All colour changes are paired with semantic markup so the component
  remains usable when CSS is unavailable.
- Colour contrast ratios meet WCAG AA for the badge text against the
  semi-transparent background (`rgba` values are tuned for `#050505` /
  `#0a0a0a` page backgrounds).
