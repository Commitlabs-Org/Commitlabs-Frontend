# Audit Methodology

This document describes how the audit was conducted: the WCAG criteria targeted, the tools
and processes used, and the severity model applied to findings. It exists so a reviewer
can reproduce the audit on a future build and so the remediation team can argue back when
a finding looks wrong.

---

## Target

**WCAG 2.1 Level AA**, all four principles. Where Level A is implicated in a finding, the
A criterion is cited (since AA includes A by definition).

The audit focuses on the criteria below — these are the ones that fail most often on
SPA-style finance dashboards and the ones the issue called out explicitly:

| Principle | Criteria | Why these |
| :-------- | :------- | :-------- |
| Perceivable | 1.1.1, 1.3.1, 1.4.3, 1.4.11, 1.4.13 | Text alternatives, semantic structure, contrast (text & non-text), tooltips/hovercards |
| Operable | 2.1.1, 2.1.2, 2.4.1, 2.4.3, 2.4.6, 2.4.7, 2.5.3 | Keyboard, no traps, bypass blocks, focus order, headings/labels, focus visible, label-in-name |
| Understandable | 3.2.1, 3.2.2, 3.3.1, 3.3.2, 3.3.3 | Predictable behavior, error identification + suggestions, labels |
| Robust | 4.1.2, 4.1.3 | Name/role/value, status messages |

Findings reference the criterion id directly (e.g., "WCAG 4.1.2"). The full spec lives at
https://www.w3.org/TR/WCAG21/.

---

## Process

The audit ran in five passes per flow. Each pass has a different lens; running them
separately keeps a single tool's blind spots from suppressing real issues.

### Pass 1 — Static review

Read the source, page-by-page, looking for:

* Missing landmark roles (`<main>`, `<nav>`, `<aside>`).
* Components rendered outside their intended landmark.
* `disabled` vs. `aria-disabled` patterns on form submit buttons.
* `aria-current` use on hash-anchor links.
* `title` attribute as a tooltip.
* Inputs without explicit labels or with `aria-label` clobbering visible text.
* `aria-describedby` references to elements that may not be in the DOM.
* Dialog markup vs. dialog behavior (trap, restore, escape).

### Pass 2 — Keyboard-only walkthrough

Drive each flow with `Tab`, `Shift+Tab`, `Enter`, `Space`, arrow keys, and `Esc` only.
Mouse parked. Verify:

* Every interactive element is reachable.
* Focus order matches the visual reading order at the current breakpoint.
* No focus trap outside dialogs.
* Inside dialogs, focus is trapped and returns to the trigger on close.
* `Esc` closes anything that should be dismissible.
* Skip links work and land focus on the right target.

### Pass 3 — Screen-reader smoke test

Walk each flow with **NVDA on Firefox** (Windows) and **VoiceOver on Safari** (macOS).
Listen for:

* Element names that match their visible labels (label-in-name).
* Live region announcements when content changes (filters, validation, modal open/close).
* Chart and table data being readable.
* Numeric abbreviations (`1.2M`, `XLM`) being expanded for speech.
* "Same name, same role" rule — buttons that look identical sound identical.

### Pass 4 — Automated tooling

Run **axe DevTools** in Chrome on each flow's primary states (idle, valid form, invalid
form, modal open, mobile breakpoint at 360 px). Capture screenshots for evidence.

Use **Lighthouse** (a11y category) as a sanity check. Lighthouse misses much; we don't
ship findings sourced *only* from Lighthouse.

Run a contrast pass with the Chrome DevTools color picker — every text-on-background
combination on the audited surfaces.

### Pass 5 — Reduced-motion and zoom

Toggle `prefers-reduced-motion: reduce` via DevTools rendering panel and re-walk each
flow. Verify animations are disabled or replaced. Then zoom the browser to 200% and 400%
and verify content reflows without horizontal scroll.

---

## Tools

| Tool | What it catches | Where it falls short |
| :--- | :-------------- | :------------------- |
| axe DevTools | Most ARIA mistakes, contrast on static text, label/name issues, landmark structure | Misses keyboard traps, focus restoration, dynamic announcements |
| Lighthouse a11y | Quick smoke check, scoring | High false-negative rate; treats absence of issues as success |
| NVDA + Firefox | Real screen-reader behavior on Windows | Slow; needs human |
| VoiceOver + Safari | Real screen-reader behavior on macOS / iOS | Different bugs than NVDA; needs human |
| Chrome DevTools "Rendering" panel | `prefers-reduced-motion`, `prefers-contrast`, color-vision simulation | Simulation only; not a substitute for real users |
| Chrome DevTools accessibility tree | Inspect what AT actually sees | Does not catch missing live-region setup |
| Polypane / Browserstack | Multi-breakpoint visual + a11y | Costs $; substitute with manual responsive walkthrough |

Findings cite the **strongest** signal that surfaced them. If axe and a manual walkthrough
both flagged the issue, the finding cites the manual walkthrough — automated checks are
necessary but not sufficient.

---

## Severity Model

Every finding has a severity. Severity is a function of (a) which WCAG criterion fails and
(b) what the user can no longer do. It is **not** a function of how hard the fix is.

| Severity | Definition | Examples |
| :------- | :--------- | :------- |
| **Critical** | Fails AA AND blocks a core task for at least one user group | Disabled submit kills tab focus; chart has no SR-equivalent path; modal does not return focus |
| **High** | Fails AA; user can complete the task but with extra effort or risk of error | No `aria-current="step"` in stepper; `title` tooltip; missing `aria-live` for filter results |
| **Medium** | Degrades AA; workaround exists | Dangling `aria-describedby` reference; missing `aria-controls`; focus indicator relies on text-shadow |
| **Low** | Polish / forward-looking; not a current AA failure | Skip-link could include "skip to filters"; reduced-motion banner |

A finding is **Critical** only if removing the failure unlocks a user who otherwise could
not complete the flow. "Inconvenient for screen-reader users" is High; "impossible for
keyboard users to advance past step 2" is Critical.

---

## Effort Model

Each finding also has an effort estimate. Effort is conservative and assumes a single
engineer familiar with the component:

| Effort | Range | Examples |
| :----- | :---- | :------- |
| **S** | < 1 hour | Add `aria-expanded` / `aria-controls`; replace `disabled` with `aria-disabled`; add `aria-current="step"` |
| **M** | 1–4 hours | Add `<figure>` + visually-hidden table to a chart; refactor `title`-tooltip to a real popover |
| **L** | 4 hours – 1 day | Restructure a wizard's landmark order; add focus-restore + announcement to the modal pattern shared by 3+ surfaces |
| **XL** | > 1 day | Multi-component refactor (e.g., introduce a design-system `Dialog` primitive replacing per-modal implementations) |

The remediation plan combines severity and effort to produce the recommended sequencing —
high-severity / low-effort items go first.

---

## What an "audit finding" looks like

Findings follow a fixed schema. The five per-flow documents under
[`findings/`](./findings/) all use the same form:

```
### F-XX-NN — One-line summary

| | |
| :---- | :---- |
| Severity | Critical / High / Medium / Low |
| Effort | S / M / L / XL |
| WCAG | 2.4.3 (Focus Order), … |
| Location | path/to/file.tsx[:line-or-range] |

**Observation.** What is broken, in plain language. No solution yet.

**User impact.** Who is hurt and how. Concrete: "A keyboard user cannot tell the Continue
button is disabled and learns about it only by clicking it."

**Recommended fix.** What the design demands. Concrete enough to build, vague enough to
survive an unrelated refactor.

**Verification.** How a reviewer confirms the fix works. Usually a keyboard or SR test.
```

The id format is `F-<flow>-<seq>` where `<flow>` is `01`–`05` matching the file names.

---

## What this audit does not do

* It does not certify compliance. AA compliance is determined by repeated testing against
  real users, not a one-shot review.
* It does not benchmark against competitors.
* It does not assess content readability, plain-language scoring, or copy length.
* It does not exhaustively test every breakpoint × every state combination — the matrix
  is too large. It tests the canonical combinations and flags patterns.
* It does not include automated regression tests. Wiring axe or jest-axe into CI is a
  follow-up tracked in [`acceptance-criteria.md`](./acceptance-criteria.md).
