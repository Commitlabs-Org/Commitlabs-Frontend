# Create Wizard Accessibility

Documents the accessibility requirements and implementation for the three-step
create-commitment wizard:
`CreateCommitmentStepSelectType` → `CreateCommitmentStepConfigure` → `CreateCommitmentStepReview`.

---

## Requirements met

### 1. Label associations for every interactive input

| Component | Input | Label mechanism |
|-----------|-------|-----------------|
| Configure | Amount (`#amount`) | `<label htmlFor="amount">` |
| Configure | Asset selector | `aria-label="Select asset"` |
| Configure | Duration (`#duration`) | `<label htmlFor="duration">` |
| Configure | Max loss (`#maxLoss`) | `<label htmlFor="maxLoss">` |
| Configure | Slippage (`#slippage`) | `<label htmlFor="slippage">` |
| Configure | Liquidation buffer (`#liquidationBuffer`) | `<label htmlFor="liquidationBuffer">` |
| SelectType | Risk profile cards | `role="radiogroup"` + `role="radio"` with text content as accessible name |

### 2. aria-describedby error / hint associations

Each input that can carry validation feedback has a dynamic `aria-describedby`
value that points only to elements that are currently rendered.

| Input | Normal state | Error state | Warning state |
|-------|-------------|-------------|---------------|
| Amount | `amount-helper` | `amount-error` | — |
| Duration | `duration-hint` | `duration-error` | — |
| Max loss | `maxloss-hint` | `maxloss-error` | `maxloss-warning` |

The max-loss `aria-describedby` is computed dynamically so that the ID always
corresponds to a rendered element:

```tsx
aria-describedby={
  [
    !maxLossError && !maxLossWarning ? 'maxloss-hint' : undefined,
    maxLossWarning && !maxLossError ? 'maxloss-warning' : undefined,
    maxLossError ? 'maxloss-error' : undefined,
  ]
    .filter(Boolean)
    .join(' ') || undefined
}
```

### 3. aria-invalid toggles with validation

Every validated input sets `aria-invalid={!!error}`.  Paired with
`role="alert"` on the error `<span>`, screen readers announce the error
immediately when it appears.

### 4. Focus management on step transitions

Each step component focuses its primary section heading on mount so that:
- Screen-reader users hear the heading immediately when the step renders.
- Keyboard-only users' focus position is well defined after navigation.

Pattern used in all three step components:

```tsx
const headingRef = useRef<HTMLHeadingElement>(null);
useEffect(() => { headingRef.current?.focus(); }, []);

// render:
<h2 ref={headingRef} tabIndex={-1}>…</h2>
```

`tabIndex={-1}` makes the heading programmatically focusable without placing it
in the tab sequence.

Focused headings per step:
- **Step 1** – "Choose Your Commitment Type"
- **Step 2** – "Configure Parameters"
- **Step 3** – "Review & Confirm"

### 5. Accessible custom checkboxes (Review step)

The review step's terms and risk-acknowledgment controls are custom `<div>`
elements that were previously click-only.  They now satisfy the ARIA checkbox
pattern:

| Attribute / handler | Value |
|---------------------|-------|
| `role` | `"checkbox"` |
| `aria-checked` | reflects boolean state |
| `aria-labelledby` | points to an `id`-bearing `<span>` containing the label text |
| `tabIndex` | `0` |
| `onClick` | toggles state |
| `onKeyDown` | toggles on `Enter` or `Space` (calls `preventDefault`) |

### 6. Accessible review section links (edit buttons)

Each review section contains an edit button with:
- A concise, unique `aria-label` (e.g. `"Edit commitment type"`)
- A `title` tooltip describing the navigation effect (e.g. `"Return to step 1 to edit commitment type"`)
- Standard `<button>` element, so Enter/Space activation works natively

### 7. Submit-error live region

The submit error in the Review step uses `role="alert"` so assistive
technologies announce the message without requiring focus:

```tsx
{submitError && <p role="alert" …>{submitError}</p>}
```

### 8. Wizard progress indicator

`WizardStepper` is a `<nav aria-label="Wizard progress">` with `aria-current="step"`
on the active circle, giving screen-reader users an orientation landmark.

---

## Keyboard-only completion flow

1. **Step 1 (Select Type)**
   - Tab to a risk-profile card.
   - Press `Enter` or `Space` to select it.
   - Tab to "Continue", press `Enter`.

2. **Step 2 (Configure)**
   - Tab through Amount, Asset selector, Duration slider / number input,
     Max Loss slider / number input.
   - Tab to "Advanced Risk Parameters", `Enter` to expand, configure optional
     fields, `Enter` to collapse.
   - Tab to "Continue", `Enter` to advance.

3. **Step 3 (Review)**
   - Review all sections; Tab to an "Edit" button and press `Enter` to jump
     back to the relevant step.
   - Tab to the Terms checkbox, press `Space` to check.
   - Tab to the Risks checkbox, press `Space` to check.
   - Tab to "Create Commitment" (now enabled), press `Enter` to submit.

---

## Test coverage

All requirements above are exercised in:

- `tests/components/CreateWizardA11y.test.tsx` — dedicated accessibility suite
- `tests/components/CreateCommitmentStepSelectType.test.tsx` — radio group, keyboard selection, disabled-continue
- `tests/components/CreateCommitmentStepConfigure.test.tsx` — field rendering, aria-invalid, error alerts, advanced section
- `tests/components/CreateCommitmentStepReview.test.tsx` — section structure, edit buttons, keyboard navigation, submit state
