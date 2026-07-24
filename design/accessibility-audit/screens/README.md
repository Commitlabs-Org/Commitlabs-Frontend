# Audit Evidence Captures

This folder is the home for **evidence** captured during the audit and any follow-up
verification runs. It mirrors the convention used by other design folders (e.g.,
[`design/iconography/screens/`](../../iconography/screens/) and
[`design/export-reporting/screens/`](../../export-reporting/screens/)).

Unlike those folders — which hold high-fidelity comps — this folder holds **proof of
state**: axe DevTools reports, focus-trace screenshots, color-contrast captures, and SR
transcripts. Comps are not produced by an audit.

---

## Required captures (per phase)

Each phase listed in [`../remediation-plan.md`](../remediation-plan.md) ships with
matching captures. The captures are the durable record of "we verified the fix landed".

### Phase 1

| File | What it shows |
| :--- | :----- |
| `phase1-landing-axe.png` | axe DevTools report on `/` after fixes |
| `phase1-create-wizard-axe.png` | axe DevTools report on `/create` (steps 1, 2, 3) |
| `phase1-marketplace-axe.png` | axe DevTools report on `/marketplace` (idle + filters open) |
| `phase1-dashboard-axe.png` | axe DevTools report on `/commitments` |
| `phase1-keyboard-trace.png` | Focus trace through the create wizard (numbered overlay) |
| `phase1-mobile-filter-toggle.png` | Voice-over rotor showing the filter button's `aria-expanded` state |

### Phase 2

| File | What it shows |
| :--- | :----- |
| `phase2-chart-figure.png` | Each chart with its visible caption and a screenshot of the hidden table opened in DevTools |
| `phase2-chart-cursor-trace.png` | Arrow-key cursor traversal of the value-history chart |
| `phase2-tablist.png` | Health-metric tab control with `role="tablist"` highlighted in the accessibility tree |
| `phase2-gauge-text.png` | Volatility / compliance gauges with adjacent value text and figcaption visible |

### Phase 3

| File | What it shows |
| :--- | :----- |
| `phase3-dialog-focus-restore.gif` | Open / close cycle with focus highlight returning to trigger |
| `phase3-stacked-dialogs.png` | Two dialogs stacked, scroll-lock counter visible in DevTools |
| `phase3-acknowledgement.png` | Early-exit modal with checkbox checked / unchecked, button states |

### Phase 4

| File | What it shows |
| :--- | :----- |
| `phase4-focus-outline.png` | Real outline focus across nav links, buttons, form controls |
| `phase4-tooltip.png` | Real `<Tooltip>` invoked by keyboard, persistent on focus, dismissible by Esc |
| `phase4-card-name.png` | Card accessible-name resolution shown in the accessibility tree |
| `phase4-zoom-200.png` | All five flows at 200% browser zoom, no content loss |

---

## Naming convention

`<phase>-<flow-or-feature>-<capture-type>.<ext>`

- `<phase>`: `phase1` | `phase2` | `phase3` | `phase4` | `pre-audit`.
- `<flow-or-feature>`: short slug — `landing`, `create-wizard`, `marketplace`,
  `dashboard`, `modals`, `chart-figure`, etc.
- `<capture-type>`: `axe` (axe DevTools report), `keyboard-trace` (numbered focus
  overlay), `voiceover` / `nvda` (transcript or screenshot), `contrast`, `zoom`,
  `dialog-focus-restore` (animated gif).
- `<ext>`: `png` for screenshots, `gif` for short interaction loops, `txt` for SR
  transcripts.

Examples:

- `phase1-create-wizard-axe.png`
- `phase1-create-wizard-keyboard-trace.png`
- `phase1-marketplace-nvda.txt`
- `phase2-chart-figure-cursor-trace.gif`
- `phase4-focus-outline.png`

---

## Pre-audit baseline (optional)

Before any remediation lands, capture the failing state once so the team has an
honest "before / after". Suggested baseline files:

- `pre-audit-create-wizard-disabled-button.png` — DevTools accessibility tree showing
  the Continue button missing from the tab order.
- `pre-audit-charts-no-figure.png` — Recharts SVG with no surrounding `<figure>`.
- `pre-audit-modal-focus-loss.gif` — keyboard focus jumping to `<body>` after modal
  close.

These are not required for sign-off; they exist for the team's own institutional memory
and for any later "did we actually fix this?" review.

---

## Tools used to capture

- **axe DevTools** (Chrome extension) — exports report screenshots; full reports may
  also be exported to JSON and saved alongside the PNG.
- **Chrome DevTools accessibility tree** — captures of the computed accessible name /
  role / state of an element.
- **NVDA + Firefox** — speech log saved to `.txt`.
- **VoiceOver + Safari** — rotor screenshots captured via macOS screenshot tool.
- **Browser zoom** — built-in browser DevTools rendering panel.

The audit does not endorse any specific tool over another; it requires that *some*
evidence is captured per phase.

---

## What does **not** belong here

- High-fidelity Figma comps. Those live in the relevant feature design folder.
- Engineering decisions / PR descriptions. Those live in commits and PRs.
- Long-form transcripts that exceed a few KB. Summarize and link out.
- Stale captures from before a fix landed (move to `pre-audit-*` if you want to keep
  them; otherwise delete).

---

## Cross-references

- [`../README.md`](../README.md) — audit overview, executive summary
- [`../methodology.md`](../methodology.md) — the process that produced these captures
- [`../remediation-plan.md`](../remediation-plan.md) — the phases the captures verify
- [`../acceptance-criteria.md`](../acceptance-criteria.md) — what each phase's captures
  must demonstrate
