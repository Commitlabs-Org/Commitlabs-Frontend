# Dashboard Overview — UI/UX Design

## Purpose

This module defines the **redesigned Dashboard Overview** for CommitLabs. It establishes the
visual hierarchy, content rules, and state coverage for the screen that brings together a
user's headline KPIs, contextual insights, and trend charts.

The goal is to make the overview:

* Scannable in **under 5 seconds** for the three numbers that matter most.
* Honest about its state — empty, loading, error and partial-data are first-class.
* Predictable across breakpoints, with **mobile-first** layout rules baked into every block.
* Accessible without relying on color or animation as the only signal.

---

## Scope

This deliverable covers the Dashboard Overview surface only:

* KPI strip (hero + primary + secondary metrics)
* Insights panel (narrative cards beside the data)
* Chart region (trend / distribution / breakdown)
* Empty, loading, error and populated states
* Responsive behavior across mobile, tablet and desktop
* Skeleton loading patterns aligned with existing app skeletons
* Accessibility QA basics

It **does not** cover: navigation chrome, settings flows, commitment detail, marketplace, or
any backend contracts. Those are owned by their own design/spec folders.

---

## What's Included

| File | What it defines |
| :--- | :-------------- |
| [`README.md`](./README.md) | Overview, principles, scope (this file) |
| [`kpi-cards.md`](./kpi-cards.md) | Hero / primary / secondary KPI specs and hierarchy rules |
| [`insights.md`](./insights.md) | Insights panel: layout, copy rules, severity, dismiss behavior |
| [`charts.md`](./charts.md) | Chart selection, axes, legends, tooltips, breakpoints |
| [`states.md`](./states.md) | Empty / loading / error / partial / populated state specs |
| [`responsive-layouts.md`](./responsive-layouts.md) | Mobile-first grid, breakpoints, density rules |
| [`accessibility.md`](./accessibility.md) | A11y QA checklist for the overview |
| [`screens/`](./screens/) | High-fidelity comps (Figma exports) for each state |

---

## Design Principles

1. **Hierarchy first.** A user lands on the overview to answer *"how am I doing?"* — the three
   hero KPIs must dominate the visual weight. Everything else supports them.
2. **One number, one job.** Each KPI tile communicates a single metric. Deltas and context
   live inside the tile, not in a separate card.
3. **State parity.** Every block (KPIs, insights, charts) ships with empty, loading, and error
   variants. No block may render `null` silently.
4. **Mobile is the canonical layout.** Desktop is a wider-grid restatement of the mobile stack,
   not a different design.
5. **Color + shape redundancy.** Direction, severity, and status are conveyed with icon and
   text, never color alone — consistent with the iconography system.
6. **Skeletons mirror real layout.** Loading shapes match final block sizes to eliminate layout
   shift, following [`docs/skeleton-loading-patterns.md`](../../docs/skeleton-loading-patterns.md).
7. **Insights are written, not graphed.** The insights panel is short prose ("compliance up
   3.1% this week") that turns numbers into meaning.

---

## Information Architecture

The overview is composed top-to-bottom as four bands. The order is fixed across breakpoints;
only the within-band layout reflows.

```
┌─────────────────────────────────────────────────────────┐
│ 1. Greeting + range selector                            │  Header
├─────────────────────────────────────────────────────────┤
│ 2. KPI strip — Hero (3) → Primary (3) → Secondary (n)   │  KPIs
├─────────────────────────────────────────────────────────┤
│ 3. Insights panel  ╎  Trend chart                       │  Context
├─────────────────────────────────────────────────────────┤
│ 4. Distribution / breakdown chart                       │  Detail
└─────────────────────────────────────────────────────────┘
```

Rationale: KPIs answer *"what?"*, insights answer *"why?"*, charts answer *"over what window?"*.
Stacking them in that order matches the natural read of a finance dashboard.

---

## Reference Design

Figma (CommitLabs design system, Dashboard Overview frame): see
[`screens/`](./screens/) for exported comps and the link recorded in
[`screens/README.md`](./screens/README.md).

---

## Cross-References

* KPI Card component spec (existing): [`src/components/KPICard/KPICard.spec.md`](../../src/components/KPICard/KPICard.spec.md)
* Skeleton loading patterns: [`docs/skeleton-loading-patterns.md`](../../docs/skeleton-loading-patterns.md)
* Iconography & status system: [`design/iconography/README.md`](../iconography/README.md)
* Accessibility (dense numeric UI): [`docs/accessibility-dense-ui.md`](../../docs/accessibility-dense-ui.md)
* Export & reporting (entry point lives on this dashboard): [`design/export-reporting/README.md`](../export-reporting/README.md)

---

## Notes

* This is a **UI/UX-only** deliverable. No component code is added or modified by this PR.
* The KPI Card *component* already exists; this folder defines how it is **composed** on the
  Dashboard Overview, plus the surrounding insights and chart treatments.
* Comps cover both empty (first-time user) and populated (typical user) states, because the
  empty state is the most-common screen for new accounts and is often under-designed.
