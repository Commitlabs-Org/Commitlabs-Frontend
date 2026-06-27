# Commitment Detail Actions

The `CommitmentDetailActions` component renders the primary control surface for a commitment. It provides four action buttons, each wired to a concrete destination.

## Actions

| Button | Destination | Implementation |
|---|---|---|
| **Early Exit** | `CommitmentEarlyExitModal` | Opens the early exit modal with penalty breakdown. Disabled via `canEarlyExit`. |
| **View Full Attestation History** | Attestation panel (scroll) | Scrolls the page to the `#attestations-section` element using `scrollIntoView({ behavior: 'smooth' })`. |
| **Export Commitment Data** | `ExportCommitmentsModal` | Opens the existing export modal to download a CSV snapshot. |
| **Report an Issue** | `CommitmentDisputeModal` | Opens the dispute submission modal which POSTs to `/api/commitments/[id]/dispute`. |

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `canEarlyExit` | `boolean` | — | Whether the Early Exit button is enabled |
| `onEarlyExit` | `() => void` | — | Called when the enabled Early Exit button is clicked |
| `onViewAttestations` | `() => void` | — | Called when View Attestations is clicked |
| `onExportData` | `() => void` | — | Called when Export Data is clicked |
| `onReportIssue` | `() => void` | — | Called when Report Issue is clicked |
| `earlyExitDisabledReason` | `string` | `'Early exit is only available before maturity'` | Tooltip text shown on the disabled Early Exit button |

## State-driven affordances

- **Disabled Early Exit**: When `canEarlyExit` is `false`, the button is `disabled`, gets `aria-disabled="true"`, and a `title` tooltip explains why.
- **Enabled Early Exit**: When `canEarlyExit` is `true`, the button has full styling, cursor pointer, and hover glow effects.

## Accessibility

- All buttons use native `<button>` elements with `aria-label` describing the action.
- The Early Exit button uses `aria-disabled` when disabled.
- The disabled Early Exit button shows a `title` tooltip explaining the reason.
- All buttons have `focus-visible:ring-2 focus-visible:ring-[#0FF0FC]` for visible keyboard focus.
- Each button is reachable by sequential keyboard navigation.

## Wiring in the page

In `src/app/commitments/[id]/page.tsx`:

```tsx
// State for modals
const [exportModalOpen, setExportModalOpen] = useState(false);
const [earlyExitModalOpen, setEarlyExitModalOpen] = useState(false);
const [disputeModalOpen, setDisputeModalOpen] = useState(false);

// Ref for scroll-to-attestations
const attestationsRef = useRef<HTMLDivElement>(null);

// Callbacks
const handleViewAttestations = useCallback(() => {
    attestationsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}, []);

const handleExportData = useCallback(() => {
    setExportModalOpen(true);
}, []);

const handleReportIssue = useCallback(() => {
    setDisputeModalOpen(true);
}, []);

const handleEarlyExit = useCallback(() => {
    setEarlyExitModalOpen(true);
}, []);
```
