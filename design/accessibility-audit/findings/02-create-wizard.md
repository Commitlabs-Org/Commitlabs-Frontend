# Findings — Create Commitment Wizard

Flow code:
* [`src/app/create/page.tsx`](../../../src/app/create/page.tsx)
* [`src/components/CreateCommitmentStepSelectType.tsx`](../../../src/components/CreateCommitmentStepSelectType.tsx)
* [`src/components/CreateCommitmentStepConfigure.tsx`](../../../src/components/CreateCommitmentStepConfigure.tsx)
* [`src/components/CreateCommitmentStepReview.tsx`](../../../src/components/CreateCommitmentStepReview.tsx)
* [`src/components/modals/Commitmentcreatedmodal.tsx`](../../../src/components/modals/Commitmentcreatedmodal.tsx)

This is the highest-density flow in the audit, with five Critical / High findings.

---

### F-02-01 — Continue button uses `disabled` attribute, removing it from the tab order

| | |
| :---- | :---- |
| Severity | **Critical** |
| Effort | S |
| WCAG | 3.3.1 (Error Identification), 4.1.3 (Status Messages) |
| Location | [`CreateCommitmentStepConfigure.tsx:442–453`](../../../src/components/CreateCommitmentStepConfigure.tsx) |

**Observation.** The Continue button uses both `disabled={!isValid}` and
`aria-disabled={!isValid}`. Native `disabled` removes the element from the tab order and
from the accessibility tree (in most browsers). A keyboard / screen-reader user cannot
reach the button to discover that it is disabled, nor learn *why*.

**User impact.** A keyboard user tabs through the configure step, never lands on Continue,
and has no signal that they cannot advance. They must mouse to discover the state. A
screen-reader user receives no announcement that the form is invalid.

**Recommended fix.** Drop the native `disabled` attribute. Keep `aria-disabled={!isValid}`.
Intercept the click and, when invalid, do nothing (or shake/highlight the offending
field). Provide an `aria-describedby` pointing to a visually-hidden message naming the
unmet requirements (`Amount must be greater than 0; Duration must be 1–365 days`).

**Verification.** Keyboard-only: tab to Continue while invalid; pressing `Enter` does not
advance and a screen reader announces the unmet requirement. Tab lands on Continue in both
valid and invalid states.

---

### F-02-02 — Step 1 of the wizard is rendered outside `<main id="main-content">`

| | |
| :---- | :---- |
| Severity | **Critical** |
| Effort | S |
| WCAG | 2.4.1 (Bypass Blocks) |
| Location | [`src/app/create/page.tsx:191–198`](../../../src/app/create/page.tsx) |

**Observation.** The page renders `<CreateCommitmentStepSelectType>` directly, *outside*
any `<main>` landmark, when `step === 1`. The site-wide skip link
([`layout.tsx:77`](../../../src/app/layout.tsx)) targets `#main-content`. On step 1 the
target does not exist; activating the skip link fails silently.

**User impact.** Keyboard users on `/create` who use the skip link are stranded. The skip
link is the WCAG-mandated bypass; failing it is a Level A failure.

**Recommended fix.** Move `<main id="main-content">` outside the step branches so step 1
is wrapped too. Step-specific chrome (the `<header>`, `<nav className="stepper">`) can
move inside or stay branched, but the landmark itself must wrap every step.

**Verification.** On `/create` step 1, focus the skip link via keyboard and activate it.
Focus must land on the main content of step 1, not stay at the top.

---

### F-02-03 — Stepper does not expose the active step to assistive tech

| | |
| :---- | :---- |
| Severity | High |
| Effort | S |
| WCAG | 1.3.1 (Info and Relationships) |
| Location | [`src/app/create/page.tsx:212–237`](../../../src/app/create/page.tsx) |

**Observation.** The stepper is wrapped in `<nav aria-label="Progress">` (good), but the
active step is communicated only by a CSS class (`styles.active`). There is no
`aria-current="step"` on the active item. A screen-reader user hears "Select Type",
"Configure", "Review" with no indication of which one they are on.

**User impact.** Screen-reader users have no signal of progress through the multi-step
flow.

**Recommended fix.** Add `aria-current="step"` to the active stepper item. Optionally
add a visually-hidden `Step 2 of 3` label inside the active item for redundancy.

**Verification.** Walk to step 2 with NVDA active; entering the stepper region must
announce "Step 2, Configure, current step".

---

### F-02-04 — Step transitions are not announced

| | |
| :---- | :---- |
| Severity | High |
| Effort | S |
| WCAG | 4.1.3 (Status Messages) |
| Location | [`src/app/create/page.tsx:135–139`](../../../src/app/create/page.tsx) |

**Observation.** When the user clicks Continue, the entire viewport content swaps to the
next step. There is no live region announcing the transition. The browser's focus stays
on the now-removed Continue button, and most browsers move focus to `<body>` once the
button unmounts.

**User impact.** Screen-reader users hear silence when the page changes. They have to
re-orient by reading from the top.

**Recommended fix.** Add an `aria-live="polite"` region near the top of the page that
updates with `Step <n> of 3, <name>` on each transition. After the announcement (~200 ms),
move focus to the new step's heading (which should have `tabindex="-1"`).

**Verification.** Walk forward and backward through the wizard with NVDA: each transition
must announce the new step number and name within 1 second.

---

### F-02-05 — Tooltip uses `title` attribute on a `<span>`

| | |
| :---- | :---- |
| Severity | High |
| Effort | M |
| WCAG | 1.4.13 (Content on Hover or Focus), 2.1.1 (Keyboard) |
| Location | [`CreateCommitmentStepConfigure.tsx:158`](../../../src/components/CreateCommitmentStepConfigure.tsx) (and similar tooltip icons in Configure step) |

**Observation.** The "i" tooltip on the duration label is a `<span>` with the `title`
attribute. `title` is mouse-hover only; it cannot be triggered by keyboard, is not
dismissible, and is not persistable per 1.4.13.

**User impact.** Keyboard users cannot read the tooltip explaining what the field means.

**Recommended fix.** Convert the icon to a `<button type="button">` that toggles a real
tooltip (`role="tooltip"` with `aria-describedby` linking the form control to the tooltip
content). Provide:
* `Esc` to dismiss
* Hoverable tooltip surface (so the user can move from the trigger into the tooltip)
* Persistent on focus

This is a pattern; a single `<Tooltip>` primitive applied here also unblocks every other
`title`-based tooltip in the codebase (a fast follow audit).

**Verification.** Tab to the tooltip icon, press `Enter` or `Space`; tooltip becomes
visible. `Esc` dismisses. Mouse-hover and keyboard-focus produce the same content.

---

### F-02-06 — Slider lacks `aria-valuetext` for human-readable units

| | |
| :---- | :---- |
| Severity | High |
| Effort | S |
| WCAG | 1.3.1 (Info and Relationships), 4.1.2 (Name, Role, Value) |
| Location | [`CreateCommitmentStepConfigure.tsx:167–178`](../../../src/components/CreateCommitmentStepConfigure.tsx) (Duration slider, similar issue on Max Loss / Slippage / Liquidation Buffer sliders) |

**Observation.** Each `<input type="range">` exposes its native `value`/`min`/`max`, so
screen readers read raw numbers ("eighty-five"). The associated unit ("days", "percent")
lives in a sibling visual label. There is no `aria-valuetext` on the input.

**User impact.** Screen-reader users hear "85" with no unit, then have to navigate to the
sibling label to learn what 85 means.

**Recommended fix.** Add `aria-valuetext` to each slider, formatted as
`<value> <unit>` — `aria-valuetext={`${durationDays} days`}`. Same treatment for max-loss
percent, slippage, and liquidation buffer. Keep the visible label.

**Verification.** Tab to the slider with NVDA; arrow-key changes announce
"86 days, 87 days, …" rather than just numbers.

---

### F-02-07 — `aria-describedby` references an element that may not exist

| | |
| :---- | :---- |
| Severity | Medium |
| Effort | S |
| WCAG | 1.3.1 (Info and Relationships) |
| Location | [`CreateCommitmentStepConfigure.tsx:128–151`](../../../src/components/CreateCommitmentStepConfigure.tsx) |

**Observation.** The amount input declares `aria-describedby="amount-helper amount-error"`
unconditionally. The `#amount-error` element only renders when `amountError` is truthy.
When the form is valid, the reference dangles. Some screen readers treat dangling
references as bugs and skip the entire `aria-describedby`; others read it as missing
content.

**User impact.** Inconsistent description announcement. In the worst case, the helper
text ("Available: 10000 XLM") is dropped because the SR sees one valid id and one
broken id.

**Recommended fix.** Compose the value dynamically:
`aria-describedby={amountError ? "amount-helper amount-error" : "amount-helper"}`. Pattern
applies anywhere `aria-describedby` references a conditionally-rendered node.

**Verification.** With NVDA: focus the input in the valid state — only "Available: …" is
announced. Trigger the error — both helper and error are announced.

---

### F-02-08 — Advanced toggle has `aria-expanded` but no `aria-controls`

| | |
| :---- | :---- |
| Severity | Medium |
| Effort | S |
| WCAG | 1.3.1 (Info and Relationships) |
| Location | [`CreateCommitmentStepConfigure.tsx:206–211`](../../../src/components/CreateCommitmentStepConfigure.tsx) |

**Observation.** The "Advanced Risk Parameters" toggle declares `aria-expanded` but
omits `aria-controls`. Screen readers can announce the expanded state but cannot tell the
user which region the button controls.

**User impact.** Disclosure works but the relationship between trigger and content is
unstated. Users have to discover the new content by tabbing.

**Recommended fix.** Give the controlled region a stable id (`id="advanced-risk-params"`)
and add `aria-controls="advanced-risk-params"` to the toggle.

**Verification.** Inspect with the Chrome accessibility tree: button's controls
relationship resolves to the parameters region.

---

### F-02-09 — Required-field marker is purely visual

| | |
| :---- | :---- |
| Severity | Medium |
| Effort | S |
| WCAG | 1.3.1 (Info and Relationships), 3.3.2 (Labels or Instructions) |
| Location | [`CreateCommitmentStepConfigure.tsx:115`](../../../src/components/CreateCommitmentStepConfigure.tsx) (Amount label, Duration label) |

**Observation.** Required fields are marked with `<span className={styles.required}>*</span>`
inside the label. The asterisk is read aloud by some screen readers but its semantics
(this means required) are not. The input itself has no `required` or `aria-required`.

**User impact.** Screen-reader users hear "Commitment Amount, asterisk" with no
explanation of what the asterisk means. They learn the field is required only on
submission.

**Recommended fix.** Add `aria-required="true"` to required inputs. Either add a visually
hidden `(required)` to the label, or include the legend `* Required` once at the top of
the form (referenced via `aria-describedby` if needed).

**Verification.** With NVDA on the amount input: announces "Commitment Amount, required".

---

### F-02-10 — `maxLossWarning` threshold change is silent

| | |
| :---- | :---- |
| Severity | Medium |
| Effort | S |
| WCAG | 4.1.3 (Status Messages) |
| Location | [`src/app/create/page.tsx:127`](../../../src/app/create/page.tsx) and Configure step rendering |

**Observation.** `maxLossWarning` flips when the slider passes 80%. The visual treatment
changes but no live region announces it. Screen-reader users sliding past the threshold
have no signal that they crossed into a "warning" range.

**User impact.** A user with very high max-loss tolerance receives no warning that they
selected a risky setting.

**Recommended fix.** Render a `role="status"` (or `aria-live="polite"`) message that
appears when `maxLossWarning` is true and is removed when false. Copy: `High max-loss
selected. Most commitments use 50% or less.` (or similar — needs copy review).

**Verification.** Slide past 80% with NVDA on; the warning is announced once.

---

### F-02-11 — Type cards (step 1) keyboard semantics

| | |
| :---- | :---- |
| Severity | Medium |
| Effort | M |
| WCAG | 4.1.2 (Name, Role, Value), 2.1.1 (Keyboard) |
| Location | [`CreateCommitmentStepSelectType.tsx`](../../../src/components/CreateCommitmentStepSelectType.tsx) |

**Observation.** The three commitment-type cards (Safe / Balanced / Aggressive) are a
single-select choice. They should expose radio-group semantics either via `role="radio"`
on each card with the parent as `role="radiogroup"`, or as a real `<fieldset>` of
`<input type="radio">` inputs styled to look like cards.

**User impact.** Without radio semantics, screen-reader users do not know they are
selecting one of three; they may try to select multiple.

**Recommended fix.** Use real `<input type="radio">` with the same `name`, wrapped in a
`<fieldset>` with a `<legend>`. Style the surrounding label as the card. This also gives
arrow-key navigation between options for free.

**Verification.** With NVDA, entering the group announces "Commitment type, radio group,
3 options". Arrow keys navigate between cards. Only one can be selected at a time.

---

## Summary

| ID | Severity | Effort |
| :- | :------- | :----- |
| F-02-01 | Critical | S |
| F-02-02 | Critical | S |
| F-02-03 | High | S |
| F-02-04 | High | S |
| F-02-05 | High | M |
| F-02-06 | High | S |
| F-02-07 | Medium | S |
| F-02-08 | Medium | S |
| F-02-09 | Medium | S |
| F-02-10 | Medium | S |
| F-02-11 | Medium | M |

**Recommendation:** the create wizard owns 2 of the 5 Critical findings. A single
focused PR addressing F-02-01 through F-02-06 (six items, mostly S effort) would close
both Critical and all four High findings on this flow.
