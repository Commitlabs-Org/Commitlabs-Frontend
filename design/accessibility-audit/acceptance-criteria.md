# Acceptance Criteria & Verification

This document is the **definition of done** for each phase of the remediation plan, plus
the durable verification process this audit recommends adopting so accessibility does not
regress after Phase 4 lands.

A phase is "accepted" only when every criterion in its section passes. Acceptance is a
manual sign-off step, not an automated gate — automation is one of the criteria.

---

## Per-Phase Acceptance

### Phase 1 — Stop the bleeding

**Done when all of the following are true:**

- [ ] On every audited route, activating the skip link from page load moves keyboard
      focus into a `<main>` landmark.
- [ ] In the create wizard, the Continue button is reachable by Tab in both valid and
      invalid states; pressing Enter while invalid does nothing and a screen reader
      announces the unmet requirement (F-02-01).
- [ ] In the create wizard, advancing or going back through steps produces a screen
      reader announcement of the new step within 1 second; focus lands on the new step's
      heading (F-02-04).
- [ ] In the create wizard, every slider announces its value with units when changed
      (F-02-06).
- [ ] On the marketplace at 360 px, the filter toggle announces its expanded state and
      a controlled region (F-03-01).
- [ ] On the marketplace, changing a filter announces the new result count via
      `aria-live` (F-03-02); the same applies on the commitments grid (F-04-05).
- [ ] On the marketplace, pagination is reachable as a navigation landmark and the
      active page announces "current page" (F-03-04).
- [ ] On the dashboard, every KPI tile reads its expanded value (`1.2 million dollars`,
      not `1.2 M`) and includes direction in the announced delta (F-04-02, F-04-03).
- [ ] On modal close (success modal), keyboard focus returns to the trigger that opened
      it (F-05-01).
- [ ] Modal animations honor `prefers-reduced-motion: reduce`. The success-icon pulse no
      longer animates infinitely (F-05-02).
- [ ] On the landing page, the mobile menu does not expose hidden nav links to the tab
      order when closed (F-01-02). Activating the menu moves focus into the menu
      (F-01-04).
- [ ] No nav link claims `aria-current="page"` while on a different route (F-01-01).
- [ ] axe DevTools report on all five flows shows zero **Critical** or **Serious**
      violations.

**How to verify:** the manual NVDA + keyboard walkthroughs documented in
[`methodology.md`](./methodology.md), plus an axe DevTools scan saved as evidence in
[`screens/`](./screens/) (one PNG per flow's primary state).

**Exit owner:** the engineer who lands the Phase 1 PR(s) records the verification
results in [`screens/`](./screens/) and links them in the PR description.

---

### Phase 2 — Charts a11y

**Done when all of the following are true:**

- [ ] All four health charts on the commitment detail page render inside a
      `<figure role="figure">` with a non-empty `<figcaption>` summarizing the data in
      plain language (F-04-01).
- [ ] Each chart includes a visually-hidden `<table>` reflecting the chart's series with
      column headers and one row per data point.
- [ ] Each chart is keyboard-navigable: Tab focuses the chart; Left/Right arrow moves a
      cursor across data points; the focused point's label and value are announced via
      `aria-live`.
- [ ] Each chart legend uses both color and shape (line / dashed / dotted) so series
      remain distinguishable in greyscale.
- [ ] The chart tab control (Value / Drawdown / Fees / Compliance) is implemented as a
      proper tablist (`role="tablist"`, `role="tab"`, `role="tabpanel"`,
      `aria-selected`, arrow-key cycling within the tablist) (F-04-07).
- [ ] Volatility / compliance gauges expose their value as visible text adjacent to the
      gauge AND in the figure's `<figcaption>` (F-04-08).
- [ ] axe DevTools report on the dashboard and commitment-detail flows shows zero
      **Critical** or **Serious** violations.

**How to verify:** with NVDA, enter the commitment-detail page; navigate the rotor's
"Tables" view and confirm a hidden table per chart. Tab to each chart, walk all data
points with arrow keys, confirm announcements. Toggle the chart tab control with the
keyboard and confirm panel switching.

---

### Phase 3 — Modal primitive

**Done when all of the following are true:**

- [ ] A `<Dialog>` primitive exists at the path proposed in
      [`component-spec-updates.md`](./component-spec-updates.md) and ships with its own
      accessibility test suite (jest-axe + behavior tests for focus restore, Esc, scroll
      lock).
- [ ] All existing modals in the codebase use the primitive — there are no remaining
      bespoke `role="dialog"` implementations.
- [ ] The primitive throws (or fails a lint rule) when `title` is missing.
- [ ] Stacked dialogs preserve scroll lock until both close (F-05-08).
- [ ] The early-exit modal renders its acknowledgement text inside the primitive's
      `acknowledgementRequired` mode; the primary action is `aria-disabled` until
      checked, never natively `disabled` (F-05-04).
- [ ] Each modal's close button announces the dialog's title in its accessible name
      (F-05-06).
- [ ] axe DevTools report on every flow that opens a modal shows zero **Critical** or
      **Serious** violations.

**How to verify:** for each modal-opening surface, drive the open / close cycle by
keyboard only. Focus must restore to the trigger every time. Stack two dialogs; close
the inner one; outer dialog remains operable; body scroll remains locked.

---

### Phase 4 — Polish & forward-looking

**Done when all of the following are true:**

- [ ] All Medium and Low findings in the combined table of
      [`remediation-plan.md`](./remediation-plan.md) are closed or explicitly deferred
      with a tracking link.
- [ ] Focus indicators across the app are real outlines satisfying 3:1 non-text
      contrast against their background — never text-shadow alone (F-01-03).
- [ ] A `<Tooltip>` primitive replaces every `title="…"` tooltip in the codebase
      (F-02-05).
- [ ] Marketplace and commitment cards expose a single primary navigation target with
      a concise accessible name; secondary actions live as separate buttons inside the
      card (F-03-05, F-04-06).
- [ ] The acceptance verification process documented below is wired into CI.

---

## Per-Flow Acceptance — Scenario-Level

The phase criteria above describe outcomes. The criteria below describe **end-to-end
flows a real user can run** with assistive tech. Each scenario is a pass/fail test the
audit expects on the post-Phase-4 build.

### Scenario 1 — Keyboard-only commitment creation

A user signs in (out of scope for this audit), reaches `/create`, and creates a
commitment using only the keyboard. Tab/Shift+Tab/Enter/Space/arrow keys.

**Pass criteria:**

- The skip link works on every step.
- Each step's Continue is reachable; invalid states announce the unmet requirement.
- Step transitions are announced.
- The success modal opens, allows confirming, and on close returns focus to a sensible
  control on the now-rendered detail page.

### Scenario 2 — Screen-reader marketplace browsing

A user with NVDA on Firefox loads `/marketplace`, applies two filters, paginates to
page 3, and opens a commitment.

**Pass criteria:**

- Filter result counts are announced after each filter change.
- Pagination announces "Pagination, navigation" and the current page.
- Each marketplace card announces a concise name (`Safe Commitment, 500 XLM, 30 days`)
  with secondary actions reachable as separate buttons.
- Empty/error states announce themselves with cause-specific copy.

### Scenario 3 — Reduced-motion dashboard

A user with `prefers-reduced-motion: reduce` loads `/commitments`, opens a commitment,
and switches between health-metric tabs.

**Pass criteria:**

- KPI tiles render without the success-pulse animation; transitions are instant.
- Charts mount without animated drawing.
- Modal open/close fades are replaced by instant state swaps.

### Scenario 4 — Voice-control modal dismissal

A Voice Control / Dragon user opens the early-exit modal and wants to close it without
confirming.

**Pass criteria:**

- Saying "Close confirm early exit" focuses and activates the close button.
- Saying "Press Escape" closes the modal.
- Focus returns to the row the user invoked the action from.

### Scenario 5 — 200% browser zoom

A low-vision sighted user zooms the browser to 200% and walks every audited flow.

**Pass criteria:**

- No content is lost or clipped (1.4.10 Reflow).
- Every interactive element remains tappable (≥ 44 × 44 px target).
- Charts remain readable; horizontal scroll appears only inside the chart canvas, not
  the page.

---

## Durable Verification — CI & Process

The audit recommends three guardrails so future PRs do not regress the remediation
work:

### 1. Automated a11y in CI

Wire one of the following into the existing CI pipeline (the project uses
[`ci.yml`](../../ci.yml)):

* `axe-playwright` smoke run on each audited route, asserting zero serious/critical
  violations.
* Or, `jest-axe` assertions on every component test. Recommended starting set:
  `KPICard`, `Dialog`, `ChartFigure`, `Tooltip`, plus the wizard step components.

The CI gate fails the PR on regressions. False positives are addressed by adjusting the
component, not by suppressing the rule.

### 2. Lint guardrails

Add to the existing ESLint config:

* `eslint-plugin-jsx-a11y` recommended rules.
* A custom rule rejecting `disabled` + `aria-disabled` on the same `<button>` (catches
  the F-02-01 class).
* A custom rule rejecting `title` attributes on non-interactive elements (catches the
  F-02-05 class).

### 3. PR review checklist

Add a small a11y section to the project's PR template covering:

- Did this PR add a new interactive element? If so, is it keyboard-reachable and named?
- Did this PR add a new modal? Use `<Dialog>`; do not roll your own.
- Did this PR add a new chart or gauge? Use `<ChartFigure>`; provide a caption and data.
- Did this PR add an animation? Gate it on `prefers-reduced-motion: reduce`.
- Did axe DevTools / jest-axe report any new violations?

The checklist is short by design — long checklists are ignored.

---

## Sign-Off

When all four phases are accepted, the audited flows have been demonstrably brought to
WCAG 2.1 AA compliance for the criteria listed in [`methodology.md`](./methodology.md).

This is not a perpetual certification — accessibility regresses with every PR that
touches a primitive. The CI guardrails above are the mechanism by which the work
remains true.
