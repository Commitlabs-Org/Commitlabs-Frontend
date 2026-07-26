# Component Spec Updates

This document captures the **delta** that each existing component spec needs in order
to reflect the audit's findings. It is a list of *amendments* to existing specs, plus
two new component specs the audit recommends introducing.

Updates here do not modify the spec files in this PR — implementation team will pick
them up when each component is touched. The deltas are written so they paste cleanly
into the target spec without conflicting rewrites.

---

## 1. KPI Card — [`src/components/KPICard/KPICard.spec.md`](../../src/components/KPICard/KPICard.spec.md)

### Current state

The spec already covers `aria-label` auto-generation as `${label}: ${formattedValue}`
(see §Accessibility). Findings F-04-02 and F-04-03 demand more.

### Delta to add

Replace the `Accessibility` section's content with:

```markdown
### ARIA Attributes

- `aria-label` is auto-generated using the **expanded** value, never the compact form:
  - `formatNumber(1200000)` → "1.2M" (visible) but `aria-label` reads "1.2 million dollars".
  - `formatPercentage(85.2)` → "85.2%" (visible) but `aria-label` reads "85.2 percent".
- For currency values, `aria-label` reads the currency name (e.g., "1,250 US dollars"),
  not the symbol.
- For abbreviations (TVL, APY), the visible label uses `<abbr title="…">` and the
  `aria-label` expands the abbreviation in the announced name.

### Delta announcement

When a `delta` is provided, the announced label includes:

- The delta's signed magnitude in plain language: "increase of 12.5 percent".
- The comparison period when known: "versus last 30 days".
- The semantic direction for metrics where up-is-bad: drawdown deltas read as "warning"
  rather than success regardless of direction.

Example computed labels:

- Hero tile, populated: `Total Revenue: 1.25 million dollars, increase of 12.5 percent
  versus last month.`
- Hero tile, semantic-inverted: `Drawdown: 0.8 percent, increase of 0.3 percent — warning.`

### Required props

Add the following props to drive the expanded label:

| Prop | Type | Required when | Notes |
| :--- | :--- | :------------ | :---- |
| `valueExpanded` | `string` | format ∈ {`count`, `currency`} | Pre-computed expanded form when caller knows it; otherwise derived |
| `unitName` | `string` | format ∈ {`currency`, `count`} with non-default unit | Singular noun read aloud (`dollar`, `Stellar Lumen`) |
| `semanticInversion` | `boolean` | metric semantics demand it (e.g., drawdown) | When `true`, "up" deltas render with warning treatment |

### Required visual state

- Delta direction must be paired with an icon AND a text suffix (`+`, `−`, no symbol).
  Color alone is not sufficient — see [`docs/accessibility-dense-ui.md` §1](../../docs/accessibility-dense-ui.md) (no meaning through color alone).
```

### Tests to add

The spec's Changelog should add a 1.1.0 entry referencing F-04-02 / F-04-03 and the new
required props.

---

## 2. New: Dialog primitive spec — `src/components/ui/Dialog/Dialog.spec.md` (proposed path)

The audit recommends introducing a shared `<Dialog>` primitive (F-05-03). The spec for
that primitive should be created at the path above when implementation lands. The spec
content below is what it should contain.

### Purpose

A single, vetted modal/dialog primitive that owns:

* `role="dialog"`, `aria-modal="true"`, mandatory `aria-labelledby`.
* Focus capture on open, focus trap during use, focus restore on close.
* `Esc` to close (configurable for non-dismissible dialogs).
* Backdrop click-outside to close (configurable).
* Body scroll-lock with stacking-safe counter.
* Animations gated on `prefers-reduced-motion`.
* Optional acknowledgement-required confirm pattern.

### Required props

| Prop | Type | Required | Notes |
| :--- | :--- | :------- | :---- |
| `isOpen` | `boolean` | yes | Controlled |
| `onClose` | `() => void` | yes | Called on Esc, scrim click, close button |
| `title` | `ReactNode \| string` | yes | Wired via `aria-labelledby` |
| `description` | `ReactNode \| string` | no | Wired via `aria-describedby` |
| `dismissible` | `boolean` | default `true` | When `false`, Esc + scrim click are disabled and a close button is not rendered |
| `acknowledgementRequired` | `boolean` | default `false` | Renders an acknowledgement checkbox bound to the primary action's `aria-disabled` |
| `acknowledgementText` | `ReactNode \| string` | required when `acknowledgementRequired` | The visible label and the checkbox's accessible name |
| `primaryAction` | `{ label, onClick, variant? }` | no | Renders the primary footer button |
| `secondaryAction` | `{ label, onClick, variant? }` | no | Renders the secondary footer button |
| `size` | `'sm' \| 'md' \| 'lg'` | default `'md'` | Width tokens |
| `initialFocus` | `RefObject<HTMLElement>` | no | Override the default first-focusable target |

### Behavior

- **On open:** capture `document.activeElement` to a ref; move focus to `initialFocus`
  or the first focusable element in the dialog body.
- **During:** focus is trapped inside the dialog. Tab cycles within. Esc closes (when
  `dismissible`).
- **On close:** restore focus to the captured element. If the element has unmounted,
  fall back to a sensible adjacent control or document body.
- **Reduced motion:** all internal animations gated by `motion-safe:` Tailwind variant
  or `@media (prefers-reduced-motion: no-preference)` — under reduced motion, the dialog
  appears/disappears instantly.
- **Scroll lock:** uses a counter so stacked dialogs do not release the lock prematurely.

### Implementation constraints

- `aria-labelledby` is required at compile time. Without a `title`, the primitive throws
  in development.
- The close button's accessible name composes with the dialog title:
  `Close ${title}` for SR/voice-control disambiguation (F-05-06).
- The backdrop element has `aria-hidden="true"` (F-05-05).
- Animations are reduced to a 100 ms fade under `prefers-reduced-motion`.

### Migration note

When migrating existing modals to the primitive:

| Old modal | New |
| :-------- | :-- |
| [`Commitmentcreatedmodal.tsx`](../../src/components/modals/Commitmentcreatedmodal.tsx) | `<Dialog title="Commitment created" …>` |
| [`CommitmentDetailsModal.tsx`](../../src/components/modals/CommitmentDetailsModal.tsx) | `<Dialog title="Commitment details" size="lg" …>` |
| [`CommitmentSuccess.tsx`](../../src/components/modals/CommitmentSuccess.tsx) | `<Dialog title="…" size="sm" …>` |
| [`CommitmentEarlyExitModal/`](../../src/components/CommitmentEarlyExitModal/) | `<Dialog title="Confirm early exit" acknowledgementRequired acknowledgementText="…" …>` |

---

## 3. New: ChartFigure primitive spec — `src/components/ui/ChartFigure/ChartFigure.spec.md` (proposed path)

The audit recommends a shared chart wrapper (F-04-01) that owns the a11y boilerplate so
every chart in the app is accessible by default.

### Purpose

A single primitive that wraps any Recharts (or future) chart and provides:

* `<figure role="figure">` semantics with `<figcaption>`.
* A visually-hidden `<table>` mirroring the chart's series.
* An arrow-key navigable cursor across data points; the focused point announces its
  label and value via `aria-live`.
* A plain-language summary slot for the caption.
* Automatic disabling of motion under `prefers-reduced-motion`.

### Required props

| Prop | Type | Required | Notes |
| :--- | :--- | :------- | :---- |
| `caption` | `string` | yes | Plain-language summary read into `<figcaption>` |
| `data` | `Array<{ label: string, [seriesKey]: number }>` | yes | Source for both the chart and the hidden table |
| `series` | `Array<{ key: string, name: string, unit?: string }>` | yes | Series metadata for axis/legend/table |
| `summary` | `string` | recommended | One-sentence "rose 5.2% over 30 days, peaking at …" — generated upstream |
| `children` | `ReactNode` | yes | The chart itself (Recharts components consuming `data`/`series`) |

### Behavior

- The hidden table is always rendered (visually hidden, not removed). Caption first row
  is the column headers (`Date`, series names with units).
- The data cursor: when the chart is focused, arrow keys move a focus indicator across
  data points along the X axis. Each step announces the label and all series values via
  an `aria-live="polite"` region.
- The legend swatches use shape variation (line / dashed / dotted) in addition to color
  so legend remains distinguishable in greyscale.
- All chart animations on initial render and update use `motion-safe:` variants.

### Caption guidelines

The `caption` prop must:

* Lead with the metric name and overall direction.
* Cite the period.
* Cite at least one anchor value (peak, trough, or ending value).
* Avoid "good" / "bad" judgments — direction is a fact; meaning belongs in insights.

Example: `Total committed value rose 5.2% over the last 30 days, peaking at 52,600 XLM
on Jan 28.`

---

## 4. Tooltip primitive — proposed `src/components/ui/Tooltip/Tooltip.spec.md`

The audit recommends a `<Tooltip>` primitive replacing every `title=""` attribute used
as a tooltip in the codebase (F-02-05). The spec should at minimum require:

* The trigger is a real `<button>` (not a styled `<span>`).
* Tooltip content is in a node with `role="tooltip"`.
* Form controls reference the tooltip via `aria-describedby`.
* Tooltip persists on focus, dismisses on `Esc`.
* Hoverable: pointer can move from trigger to tooltip without dismissal (1.4.13 — Content
  on Hover or Focus).

The full spec is out of scope for this audit; the constraints above are the spec's
minimum bar.

---

## 5. Component-Level Findings Cross-Index

For every audited component, the matching findings are listed below. When implementing,
each component's spec should reference its findings.

| Component | Findings to address |
| :-------- | :------------------ |
| `Navigation.tsx` | F-01-01, F-01-02, F-01-03, F-01-04, F-01-07 |
| `Footer.tsx` | (no Critical/High; verify color contrast in audit Phase 4) |
| section components | F-01-05 (`tabindex="-1"` on hash-anchor targets) |
| `CreateCommitmentStepSelectType.tsx` | F-02-11 |
| `CreateCommitmentStepConfigure.tsx` | F-02-01, F-02-05, F-02-06, F-02-07, F-02-08, F-02-09, F-02-10 |
| `CreateCommitmentStepReview.tsx` | (no Critical/High; verify in Phase 4) |
| `src/app/create/page.tsx` | F-02-02, F-02-03, F-02-04 |
| `MarketplaceFilter/` | F-03-03, F-03-07 |
| `MarketplaceHeader.tsx` | F-03-06 |
| `MarketplaceCard.tsx` | F-03-05 |
| `src/app/marketplace/page.tsx` | F-03-01, F-03-02, F-03-04, F-03-08 |
| `KPICard.tsx` | F-04-02, F-04-03 |
| `MyCommitmentsStats.tsx` | F-04-04 |
| `MyCommitmentCard.tsx` | F-04-06 |
| `MyCommitmentsGrid.tsx` | F-04-05 |
| dashboard chart components | F-04-01, F-04-07 |
| `VolatilityExposureMeter/`, `ReputationDisplay.tsx` | F-04-08 |
| `Commitmentcreatedmodal.tsx` and other modals | F-05-01, F-05-02, F-05-05, F-05-06, F-05-08 |
| `CommitmentEarlyExitModal/` | F-05-04 |
| (architectural) | F-05-03, F-05-07 → Dialog primitive |

---

## 6. Forward-Looking: Lint & Test Guardrails

These are not specs themselves but spec-adjacent constraints the implementation team
should encode once the primitives land:

* **eslint-plugin-jsx-a11y** with the `recommended` rule set, plus:
  * `jsx-a11y/no-noninteractive-element-interactions` (catches click handlers on
    non-interactive elements).
  * `jsx-a11y/aria-props` and `jsx-a11y/role-has-required-aria-props`.
* **Custom rule** to flag `disabled` paired with `aria-disabled` on buttons (catches
  F-02-01-class issues at compile time).
* **jest-axe** assertions on the primary state of each component test (`Dialog`,
  `KPICard`, `ChartFigure`, `Tooltip`, wizard step components).
* **Storybook a11y addon** for design-system primitives — the `Dialog` and
  `ChartFigure` stories must each render the a11y panel green.

These guardrails are tracked as Phase 1 follow-up work in
[`acceptance-criteria.md`](./acceptance-criteria.md).
