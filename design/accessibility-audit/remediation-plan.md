# Remediation Plan

This document sequences the audit findings into a plan that ships value early, lets
multiple engineers work in parallel without conflicting, and ends with the codebase
demonstrably at WCAG 2.1 AA on the five core flows.

The plan is opinionated about ordering. Severity drives the *what*; effort and shared
ownership drive the *when*. If a stakeholder needs a different order, the trade-offs are
captured in the *Sequencing rationale* section below.

---

## All Findings — Combined Table

| ID | Flow | Severity | Effort | Title |
| :- | :--- | :------- | :----- | :---- |
| F-02-01 | Create | **Critical** | S | Continue button uses `disabled` and is unreachable |
| F-02-02 | Create | **Critical** | S | Step 1 lacks `<main>` landmark — skip-link broken |
| F-03-01 | Marketplace | **Critical** | S | Mobile filter toggle has no `aria-expanded`/`aria-controls` |
| F-04-01 | Dashboard | **Critical** | M × 4 | Health charts have no text-equivalent path |
| F-05-01 | Modals | **Critical** | S / L | Success modal does not restore focus on close |
| F-01-01 | Landing | High | S | `aria-current="page"` misused on hash anchor |
| F-01-02 | Landing | High | S | Mobile nav links remain in tab order when closed |
| F-01-04 | Landing | High | S | Mobile menu open does not move focus into menu |
| F-02-03 | Create | High | S | Stepper missing `aria-current="step"` |
| F-02-04 | Create | High | S | Step transitions are not announced |
| F-02-05 | Create | High | M | Tooltip uses `title` attribute |
| F-02-06 | Create | High | S | Slider lacks `aria-valuetext` |
| F-03-02 | Marketplace | High | S | Filter result count change is silent |
| F-03-04 | Marketplace | High | S | Pagination lacks `<nav>` + `aria-current="page"` |
| F-04-02 | Dashboard | High | S | KPI compact notation announced as bare numbers |
| F-04-03 | Dashboard | High | S | KPI delta direction conveyed by color/icon only |
| F-04-05 | Dashboard | High | S | Commitment grid: no result-count announcement |
| F-04-08 | Dashboard | High | M | Gauges/meters need text equivalents |
| F-05-02 | Modals | High | S | Animations not gated on `prefers-reduced-motion` |
| F-05-03 | Modals | High | L | Each modal re-implements the dialog pattern |
| F-05-04 | Modals | High | M | Early-exit acknowledgement semantics |
| F-01-03 | Landing | Medium | S | Focus indicator relies on text-shadow glow |
| F-01-05 | Landing | Medium | S | Hash-anchor targets not focusable on activation |
| F-01-07 | Landing | Medium | S | Logo accessible name regression-watch |
| F-02-07 | Create | Medium | S | Dangling `aria-describedby` reference |
| F-02-08 | Create | Medium | S | Advanced toggle missing `aria-controls` |
| F-02-09 | Create | Medium | S | Required-field marker is purely visual |
| F-02-10 | Create | Medium | S | Max-loss threshold change is silent |
| F-02-11 | Create | Medium | M | Type cards lack radio-group semantics |
| F-03-03 | Marketplace | Medium | S | Filters region lacks heading/label |
| F-03-05 | Marketplace | Medium | M | Cards: whole-card click target ambiguous |
| F-03-06 | Marketplace | Medium | S | Search input may lack programmatic label |
| F-03-07 | Marketplace | Medium | M | Active filter chips: role/removal pattern |
| F-03-08 | Marketplace | Medium | S | Empty/error states need announcements |
| F-04-04 | Dashboard | Medium | S | Stats grid has no heading |
| F-04-06 | Dashboard | Medium | M | Commitment card actions buried in click target |
| F-04-07 | Dashboard | Medium | M | Chart tabs lack `tablist` semantics |
| F-05-05 | Modals | Medium | S | Backdrop should be `aria-hidden` |
| F-05-06 | Modals | Medium | S | Close button accessible name |
| F-05-08 | Modals | Medium | S | Body scroll lock leaks under stacking |
| F-01-06 | Landing | Low | M | Skip link could include skip-to-results |
| F-05-07 | Modals | Low | M | Future modal stacking constraints |

**Total: 42 findings.** 5 Critical, 16 High, 18 Medium, 3 Low.

---

## Sequencing — 4 Phases

The plan is split into four phases, each ~1 sprint of focused effort. Phases are
ordered by *impact per hour*: phase 1 unblocks the most users for the least effort.

Phases are designed to be parallelizable where possible — the *Owner* column suggests
which engineer owns the phase but does not block another engineer from picking up
unrelated items.

---

### Phase 1 — Stop the bleeding (Sprint 1)

**Goal:** discharge all 5 Critical findings and the High findings that are S effort.
After this phase, no audited flow has an unreachable control or a silent state change
above-the-fold.

| ID | Title | Effort |
| :- | :---- | :----- |
| F-02-01 | Drop `disabled` on Continue, keep `aria-disabled`, intercept click | S |
| F-02-02 | Move `<main id="main-content">` to wrap all wizard steps | S |
| F-02-03 | Add `aria-current="step"` to active stepper item | S |
| F-02-04 | Add `aria-live` for step transitions, focus the step heading | S |
| F-02-06 | Add `aria-valuetext` to all sliders | S |
| F-03-01 | Wire `aria-expanded` + `aria-controls` on mobile filter toggle | S |
| F-03-02 | Add `aria-live` for marketplace result count | S |
| F-03-04 | Wrap pagination in `<nav>` + `aria-current="page"` | S |
| F-04-02 | KPI tile: add expanded `aria-label` for compact notation | S |
| F-04-03 | KPI tile: include direction in announced label | S |
| F-04-05 | Commitments grid: result-count announcement | S |
| F-05-01 | Success modal: capture/restore focus on close | S |
| F-05-02 | Gate modal animations on `prefers-reduced-motion` | S |
| F-01-01 | Drop `aria-current="page"` from hash-anchor link | S |
| F-01-02 | Add `inert` to closed mobile nav | S |
| F-01-04 | Move focus on mobile menu open / restore on close | S |

**Total effort:** ~16 × S = 8–12 engineering hours, comfortably 1 sprint for one
engineer; can parallelize across two.

**Exit criterion:** F-02-01, F-02-02, F-03-01, F-05-01, F-04-02/03/05 all verified by
manual NVDA + keyboard pass. The Critical row in the audit drops from 5 to 1
(F-04-01 — charts — is moved to Phase 2 because it is M effort and pattern-changing).

---

### Phase 2 — Charts a11y (Sprint 2)

**Goal:** discharge F-04-01 across all four health charts and the gauges (F-04-08), via
a single shared `<ChartFigure>` primitive so future charts inherit a11y by construction.

| ID | Title | Effort |
| :- | :---- | :----- |
| (new) | Introduce `<ChartFigure>` primitive (figcaption + visually-hidden table + arrow-key cursor) | M |
| F-04-01 | Migrate Value / Drawdown / Fees / Compliance charts | M × 4 |
| F-04-08 | Apply same wrapper pattern to gauges/meters | M |
| F-04-07 | Migrate chart tabs to `role="tablist"` pattern | M |

**Total effort:** ~6 × M = 12–24 engineering hours, ~1 sprint for one engineer.

**Sequencing rationale:** charts are the largest a11y blind spot in the codebase and the
issue calls them out explicitly. Putting them in their own phase prevents the work from
being deprioritized inside a generic "tidy a11y" PR.

**Exit criterion:** every chart on the dashboard has a `<figcaption>` summary, an
SR-readable data table, and a keyboard-navigable cursor. Gauges include numeric value
text. WCAG 1.1.1 / 1.3.1 / 2.1.1 close on the dashboard flow.

---

### Phase 3 — Modal primitive (Sprint 3)

**Goal:** discharge F-05-03 by introducing a shared `<Dialog>` primitive and migrating
all existing modals to it. This dispatches several Modal findings at once.

| ID | Title | Effort |
| :- | :---- | :----- |
| F-05-03 | Build `<Dialog>` primitive (focus capture/trap/restore, Esc, scroll-lock counter, animation gate, label assertion) | L |
| F-05-04 | Early-exit acknowledgement semantics inside the new primitive | M |
| F-05-05 | Backdrop `aria-hidden` (handled by primitive) | S |
| F-05-06 | Close-button accessible name (handled by primitive) | S |
| F-05-08 | Scroll-lock counter (handled by primitive) | S |

**Total effort:** L (primitive) + M (early-exit refit) + 3 × S (incidental) = ~16–24
engineering hours, ~1 sprint.

**Sequencing rationale:** doing the primitive *after* Phase 1 means F-05-01/F-05-02 are
already fixed on the success modal. Phase 3's primitive then **standardizes** the fix,
reducing drift risk for future modals.

**Exit criterion:** every modal in the audit list uses the primitive; per-modal a11y
re-test passes. Stacking constraint (F-05-07) documented in the primitive.

---

### Phase 4 — Polish & forward-looking (Sprint 4)

**Goal:** clear remaining Medium / Low findings; raise the floor.

| ID | Title | Effort |
| :- | :---- | :----- |
| F-01-03 | Replace text-shadow focus with real outline | S |
| F-01-05 | Make hash-anchor targets focusable | S |
| F-01-06 | Skip-to-results / skip-to-filters secondary skip links | M |
| F-02-05 | Real `<Tooltip>` primitive replacing `title` attribute | M |
| F-02-07 | Conditional `aria-describedby` composition | S |
| F-02-08 | `aria-controls` on advanced toggle | S |
| F-02-09 | `aria-required` + visible required indicator | S |
| F-02-10 | Max-loss threshold announcement | S |
| F-02-11 | Type cards as radio group | M |
| F-03-03 | Filters region heading | S |
| F-03-05 | Marketplace card click-target restructure | M |
| F-03-06 | Search input label (verify and fix if missing) | S |
| F-03-07 | Filter chip role + removal focus management | M |
| F-03-08 | Empty/error result-region announcements | S |
| F-04-04 | Stats grid heading | S |
| F-04-06 | Commitment card click-target restructure (mirrors F-03-05) | M |

**Total effort:** ~16 items, mix of S and M; ~1 sprint.

**Exit criterion:** all 42 findings are closed except F-05-07 (forward-looking
constraint, not a current issue).

---

## Sequencing Rationale (FAQ)

**Why not do all the modal work in Phase 1?**
The success modal's focus-restore (F-05-01) is a 30-minute fix. The `<Dialog>` primitive
(F-05-03) is a multi-hour refactor that touches 4+ surfaces. Doing them together would
delay F-05-01 by a sprint. Instead Phase 1 fixes F-05-01 in place; Phase 3 standardizes
the fix. Yes, this means rewriting the F-05-01 fix when the primitive lands — the
rewrite is trivial.

**Why is charts a11y its own phase?**
Charts are the largest behavior change in the audit (per-chart data tables, keyboard
cursors, figure semantics). Mixing them with phase-1 single-line ARIA fixes hides their
review burden and risks them slipping. Separate phase = separate PR = honest review.

**Why isn't tooltip-replacement (F-02-05) in Phase 1?**
A real `<Tooltip>` primitive is M effort and applies to multiple surfaces (Configure
step plus other tooltip icons in the codebase). Doing it as a one-off on the configure
step alone wastes the work. Phase 4 lands the primitive once.

**What if a stakeholder wants only one PR shipped?**
Phase 1. It is the highest-density user impact for the lowest review burden. Skipping
Phase 1 in favor of Phase 2 (charts) trades unblocking 4 critical user-facing flows for
unblocking 1.

---

## Owners and Coordination

The plan does not name people — it names work. Suggested allocation:

* **Phase 1** — single engineer, focused sprint, deliver as multiple small PRs grouped
  by flow (4 PRs: landing, create-wizard, marketplace, dashboard).
* **Phase 2** — single engineer with chart-library familiarity; one PR introducing the
  primitive plus a follow-up PR per chart migration if review burden is high.
* **Phase 3** — paired engineers (one builds primitive, one migrates).
* **Phase 4** — distributed across feature teams as polish work; coordinate the
  `<Tooltip>` primitive as one shared PR.

A regression-prevention follow-up — wiring axe (`@axe-core/react` or jest-axe) into CI —
should run alongside Phase 1 so each subsequent phase has automated guardrails. Tracked
in [`acceptance-criteria.md`](./acceptance-criteria.md).
