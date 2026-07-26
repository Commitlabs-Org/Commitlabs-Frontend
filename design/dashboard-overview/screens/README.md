# Dashboard Overview — High-Fidelity Comps

This folder holds the **exported PNGs** of the Figma frames for the Dashboard Overview
redesign. The same pattern is used by [`design/export-reporting/screens/`](../../export-reporting/screens/)
and [`design/iconography/screens/`](../../iconography/screens/).

## Required exports

Each viewport ships **all four states** (populated, empty, loading, error). A complete
deliverable contains 12 PNGs:

### Desktop (1280 px wide)

* `desktop-populated.png` — Populated state, 30-day range, all bands rendered
* `desktop-empty.png` — Onboarding state for a brand-new account
* `desktop-loading.png` — Skeletons across all bands
* `desktop-error.png` — Per-band error treatment with one band recovered

### Tablet (768 px wide)

* `tablet-populated.png`
* `tablet-empty.png`
* `tablet-loading.png`
* `tablet-error.png`

### Mobile (360 px wide)

* `mobile-populated.png` — Hero KPIs visible, secondary collapsed under "More metrics"
* `mobile-empty.png` — CTA above the fold
* `mobile-loading.png` — Skeleton stack matching the mobile layout
* `mobile-error.png` — Insights carousel recovered, one band still in error

## Naming & format

* PNG, sRGB, 2× density (e.g., `mobile-populated.png` is exported at 720 px wide).
* File names use `<viewport>-<state>.png`. No spaces, no version suffixes — keep history
  in git.

## Figma source

CommitLabs Design System → **Dashboard Overview** page. The frame names in Figma mirror the
file names in this folder.

> Figma link will be added here once the file is published. Until then, see the in-repo
> design system reference at
> [`design/iconography/README.md`](../../iconography/README.md#figma-reference).

## Cross-referenced docs

When in doubt about what a comp should depict, check the source-of-truth docs:

* [`../README.md`](../README.md) — overall composition
* [`../kpi-cards.md`](../kpi-cards.md) — tile content & hierarchy
* [`../insights.md`](../insights.md) — insight cards
* [`../charts.md`](../charts.md) — chart slot specs
* [`../states.md`](../states.md) — state behavior
* [`../responsive-layouts.md`](../responsive-layouts.md) — breakpoint reflows
* [`../accessibility.md`](../accessibility.md) — a11y QA list
