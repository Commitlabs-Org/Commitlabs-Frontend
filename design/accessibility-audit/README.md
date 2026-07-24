# Accessibility Audit & Remediation Plan — CommitLabs

## Purpose

This deliverable is a **prioritized accessibility audit** of CommitLabs's five core flows
against **WCAG 2.1 Level AA**, paired with a remediation plan and updated component specs.
It is a UI/UX-only artifact: no component code is added or changed by this PR. The output is
the work the implementation team will pick up next.

The goal is to ship a flow where:

* Every interactive element is reachable and operable by keyboard alone.
* Focus moves predictably and never disappears.
* Information is never conveyed by color, motion, or hover state alone.
* Charts and dynamic regions have a text-equivalent path for assistive technology.
* Users on `prefers-reduced-motion` and screen readers are first-class, not a fallback.

---

## Scope

### Flows audited

| # | Flow | Entry point in code |
| :- | :--- | :------------------ |
| 1 | Landing & navigation | [`src/app/page.tsx`](../../src/app/page.tsx), [`src/components/landing-page/`](../../src/components/landing-page/) |
| 2 | Create commitment wizard (3 steps) | [`src/app/create/page.tsx`](../../src/app/create/page.tsx), `CreateCommitmentStep*.tsx` |
| 3 | Marketplace | [`src/app/marketplace/page.tsx`](../../src/app/marketplace/page.tsx), [`src/components/MarketplaceFilter/`](../../src/components/MarketplaceFilter/) |
| 4 | Dashboard (commitments overview + health charts) | [`src/app/commitments/page.tsx`](../../src/app/commitments/page.tsx), [`src/components/dashboard/`](../../src/components/dashboard/) |
| 5 | Modals (success, early-exit, details) | [`src/components/modals/`](../../src/components/modals/), [`src/components/CommitmentEarlyExitModal/`](../../src/components/CommitmentEarlyExitModal/) |

### What's covered

* Keyboard navigation, focus order, focus trap, focus restoration.
* Color contrast and non-color-only state communication.
* ARIA roles, properties, and live regions.
* Charts: text-equivalent paths and keyboard tooltip access.
* Modals: dialog semantics, escape, return focus, scrim, scroll lock.
* Motion: `prefers-reduced-motion` support across animations.
* Forms: labels, errors, validation messaging, required-field semantics.

### What's out of scope (this PR)

* Implementation of the fixes — this is a plan, not a refactor.
* Screen-reader voice/intonation tuning beyond what ARIA can express.
* Internationalization / RTL — to be tracked as a separate audit.
* PDF/CSV export accessibility — covered by [`design/export-reporting/`](../export-reporting/).

---

## What's Included

| File | Purpose |
| :--- | :------ |
| [`README.md`](./README.md) | Overview, scope, executive summary (this file) |
| [`methodology.md`](./methodology.md) | Tools, process, WCAG criteria mapping, severity definitions |
| [`findings/01-landing.md`](./findings/01-landing.md) | Audit findings for the landing & navigation flow |
| [`findings/02-create-wizard.md`](./findings/02-create-wizard.md) | Audit findings for the 3-step create wizard |
| [`findings/03-marketplace.md`](./findings/03-marketplace.md) | Audit findings for the marketplace |
| [`findings/04-dashboard.md`](./findings/04-dashboard.md) | Audit findings for the dashboard + health charts |
| [`findings/05-modals.md`](./findings/05-modals.md) | Audit findings for modal patterns |
| [`remediation-plan.md`](./remediation-plan.md) | Prioritized remediation plan: severity, effort, sequencing |
| [`component-spec-updates.md`](./component-spec-updates.md) | Delta to existing component specs (KPI Card, modal patterns, etc.) |
| [`acceptance-criteria.md`](./acceptance-criteria.md) | Per-flow definition of done with verification steps |
| [`screens/`](./screens/) | Placeholder for audit evidence captures (DevTools, axe results, focus traces) |

---

## Executive Summary

**24 findings** across 5 flows. Severity distribution:

| Severity | Count | Examples |
| :------- | :---- | :------- |
| **Critical** (blocks AA, blocks core task) | 5 | Continue button uses `disabled` attribute (kills tab focus); charts have no SR-equivalent path; create-wizard step 1 lacks `<main>` landmark for skip-link; mobile filter toggle lacks `aria-expanded`/`aria-controls`; success modal does not restore focus on close |
| **High** (fails AA, recovery exists but degraded) | 9 | Stepper has no `aria-current="step"`; `aria-current="page"` misused on hash-anchor links; tooltip uses `title` attribute (mouse-only); slider lacks `aria-valuetext`; modal animations not gated on `prefers-reduced-motion`; no `aria-live` for filter result counts; … |
| **Medium** (degrades AA, has workaround) | 7 | Dangling `aria-describedby` references; advanced-toggle missing `aria-controls`; nav focus indicator is text-shadow only; Tab skip targets lack `tabindex="-1"`; … |
| **Low** (polish / forward-looking) | 3 | Skip link could include "skip to results" / "skip to filters" on dense pages; reduced-motion banner; abbreviation expansions in toasts |

**The five Critical items below should ship before any new feature work.** Each fails a
specific WCAG AA criterion and blocks a real user from completing a core task. Details and
the full remediation sequence live in [`remediation-plan.md`](./remediation-plan.md).

### Critical 1 — Disabled Continue button removes focus from tab order

Location: [`CreateCommitmentStepConfigure.tsx:442–453`](../../src/components/CreateCommitmentStepConfigure.tsx). The Continue button uses both `disabled={!isValid}` and
`aria-disabled={!isValid}`. Native `disabled` removes the element from the tab order, so a
keyboard / screen-reader user cannot reach the button to learn *why* it is unusable.
**Fix:** drop the `disabled` attribute, keep `aria-disabled`, intercept the `onClick`. WCAG 3.3.1, 4.1.3.

### Critical 2 — Charts have no text-equivalent path

Location: [`HealthMetricsValueHistoryChart.tsx`](../../src/components/dashboard/HealthMetricsValueHistoryChart.tsx) and the other three health charts. The Recharts components render no `<figure>`,
`<figcaption>`, or visually-hidden data table; tooltips trigger only on pointer hover.
A screen-reader user has no way to read the data. **Fix:** wrap each chart in `<figure>`
with a plain-language `<figcaption>` and a visually-hidden data table mirroring the series.
WCAG 1.1.1, 1.3.1, 2.1.1.

### Critical 3 — Create wizard step 1 lacks the skip-link target

Location: [`src/app/create/page.tsx:191–198`](../../src/app/create/page.tsx). The
`<main id="main-content">` wrapper exists only on step 2; step 1 renders
`CreateCommitmentStepSelectType` outside any `<main>` landmark. The site-wide skip link
(`<a href="#main-content">` in [`src/app/layout.tsx:77`](../../src/app/layout.tsx))
silently fails on step 1. **Fix:** move the wrapper outside the step branches.
WCAG 2.4.1.

### Critical 4 — Mobile filter toggle exposes no state to assistive tech

Location: [`src/app/marketplace/page.tsx:438–444`](../../src/app/marketplace/page.tsx). The
mobile filter toggle button changes its visible label between "Show Filters" and "Hide
Filters" but has no `aria-expanded` / `aria-controls`. Screen-reader users can hear the
label change but cannot tell the button controls a region or what its current state is.
**Fix:** add both attributes; the controlled region (`<aside>` filters) gets a stable id.
WCAG 4.1.2.

### Critical 5 — Success modal does not restore focus on close

Location: [`src/components/modals/Commitmentcreatedmodal.tsx`](../../src/components/modals/Commitmentcreatedmodal.tsx). The dialog correctly
moves focus to the primary button on open and traps focus during. But the cleanup effect
does not restore focus to the trigger element on close — focus jumps to `<body>` and the
keyboard user has to start their tab journey from the top of the page. Same issue applies
to the early-exit modal pattern. **Fix:** capture `document.activeElement` before opening
and `.focus()` it on close. WCAG 2.4.3.

---

## Reference Design

This audit aligns with the existing accessibility guidance in
[`docs/accessibility-dense-ui.md`](../../docs/accessibility-dense-ui.md) and the
state-coverage rules captured in the
[`design/dashboard-overview/accessibility.md`](../dashboard-overview/accessibility.md)
(if the dashboard-overview redesign lands first) and
[`design/wallet-connection/accessibility.md`](../wallet-connection/accessibility.md).
Where those documents define a stronger pattern, this audit calls them out as the target
state — not a competing rule.

---

## Cross-References

* WCAG 2.1 AA criteria — referenced by id throughout (e.g., 2.4.3, 4.1.2). Full spec at
  https://www.w3.org/TR/WCAG21/.
* Existing a11y guidance in repo: [`docs/accessibility-dense-ui.md`](../../docs/accessibility-dense-ui.md).
* Existing skeleton-loading patterns: [`docs/skeleton-loading-patterns.md`](../../docs/skeleton-loading-patterns.md).
* Existing iconography rules (color + shape redundancy): [`design/iconography/README.md`](../iconography/README.md).
* Existing skip-link implementation: [`src/app/layout.tsx`](../../src/app/layout.tsx) and
  [`src/app/globals.css`](../../src/app/globals.css) (`.skip-link`).

---

## Notes

* This is a **UI/UX-only** deliverable. No component code is added or changed by this PR.
* All findings cite a file path and (where relevant) line numbers from the working tree at
  the time of the audit. Line numbers will drift; the file references are the durable
  anchor.
* Comps (DevTools captures, focus traces, axe reports) belong in
  [`screens/`](./screens/). Specifications and decisions belong in this folder.
