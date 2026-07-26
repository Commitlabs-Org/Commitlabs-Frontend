# Dashboard Overview — Chart Layout Rules

This document defines the chart system on the Dashboard Overview: which chart types are
allowed, how they are laid out, and how they behave across states and breakpoints.

For commitment-detail health charts (drawdown, compliance, value history, fees), refer to
the existing components in [`src/components/dashboard/`](../../src/components/dashboard/).
The rules below extend those patterns to the **overview-level** charts.

---

## Chart Slots

The overview has exactly two chart slots. Adding a third requires a design review — more
charts on this surface invariably reduces hierarchy and slows the page.

| Slot | Position | Purpose | Chart type |
| :--- | :------- | :------ | :--------- |
| Trend | Row 3, beside insights | Total Committed Value over time | Line (area-fill) |
| Distribution | Row 4, full-width | Compliance / status / type breakdown | Stacked bar **or** donut |

The trend chart is the **only** time-series on the overview. Anything else with a time axis
belongs on a detail page.

---

## Trend Chart

### Defaults

| Property | Value |
| :------- | :---- |
| Series | 1 (Total Committed Value). Optional 2nd series via toggle: Initial Amount baseline |
| X axis | Time, range-selector controlled (7d / 30d / 90d / YTD) |
| Y axis | Value in user's display currency, abbreviated (`1.2M`) |
| Grid | Horizontal only, 4 lines, `rgba(255,255,255,0.06)` |
| Stroke | 2px, variant `green` (`#00ff7a`) |
| Area fill | Gradient `green → transparent`, opacity max 0.35 |
| Markers | Hidden by default; shown on hover only |
| Animation | 300ms ease-out on initial mount; disabled when `prefers-reduced-motion: reduce` |

### Tooltip

* Triggered on hover **and** focus (keyboard arrow keys move the cursor across data points).
* Content: `<weekday>, <abbrev month> <day>` on line 1; formatted value on line 2; delta vs
  previous point on line 3.
* Background: `#0a0a0a` with `rgba(255,255,255,0.1)` border, 8px radius — matches KPI card
  surface so the tooltip reads as part of the same family.
* Never covers the data point — flips to the opposite side near edges.

### Range Selector

A 4-button segmented control above the chart (`7d` · `30d` · `90d` · `YTD`). The selected
range:

* Updates the chart and the KPI delta period in a single state change.
* Updates the insight panel's `{period}` interpolation.
* Persists across sessions (last selected range is the default on next visit).

### Density rules

* On widths ≤ 640 px, the chart is **scrollable horizontally** when the selected range exceeds
  90 days. Y-axis labels stick to the left edge.
* X-axis ticks: max 6 visible labels at any breakpoint; the layer thins ticks automatically
  rather than rotating them.

---

## Distribution Chart

The distribution chart answers *"how is my portfolio split?"*. The default split is by
**commitment status** (Active / At-Risk / Settled / Early-Exit). A user-controlled toggle
swaps to **type** (Safe / Standard / High-yield) or **compliance band**.

### Default chart type

Use a **stacked horizontal bar** when there are 3–5 categories. Switch to a **donut** only
when there are exactly 2–3 categories and the labels need to be center-stage (rare on this
dashboard).

### Stacked bar specs

```
Active       ████████████████████████  62%   (28)
At-risk      █████                       12% (5)
Settled      ████████                    21% (10)
Early exit   ██                           5%  (2)
```

| Property | Value |
| :------- | :---- |
| Bar height | 32px desktop · 28px mobile |
| Bar inter-row gap | 12px |
| Color per category | From iconography status palette; never reused across categories |
| Right-side label | `{percent}% ({count})` — always show count beside percent |
| Tooltip | `{Category}: {count} commitments · {value}` on hover/focus |
| Empty category | Render the row with a 1px ghost bar at 0%; do not omit it |

### Why bars over donuts

Bars are linear → screen readers announce them in a sensible order, sums are obvious, and
small categories (like "Early Exit") remain legible. Donuts hide small slices and force
users to read the legend.

---

## Color & Iconography

Charts inherit the dashboard color tokens but **never invent semantics**. Mapping must match
the iconography system:

| Status / Category | Color token | Reference |
| :---------------- | :---------- | :-------- |
| Active | `#00ff7a` (green) | iconography Active |
| At-risk | `#f97316` (orange) | iconography At Risk |
| Violation | `#ef4444` (red) | iconography Violation |
| Settled | `#94a3b8` (neutral) | iconography Settled |
| Early Exit | `#a855f7` (purple) | iconography Early Exit |

If a new category is added that has no iconography mapping, the design system review must
add it to [`design/iconography/`](../iconography/) **before** it ships in the chart.

---

## Per-Slot State Coverage

Mirrors the KPI strip — every slot ships empty / loading / error.

| State | Trend chart | Distribution chart |
| :---- | :---------- | :----------------- |
| Loading | Skeleton: dashed grid + animated baseline | Skeleton: 4 ghost bars at 60/30/20/10% widths |
| Empty (no data in range) | Centered `info` icon + *"No activity in the last \<range\>."* + range-selector still active | Centered icon + *"No commitments yet — create one to see your portfolio split."* + primary CTA |
| Error | Alert icon + *"Couldn't load chart"* + Retry. Range selector remains usable. | Same pattern as trend chart |
| Populated | Standard render | Standard render |

**Important:** the empty state of the trend chart is *not* the empty state of the dashboard.
A user with one commitment and a flat balance has a populated chart with a flat line, not
an empty state.

---

## Responsive Behavior

### Desktop (≥ 1024 px)

* Trend chart sits in row 3 right column (60% width); chart canvas height: 320 px.
* Distribution chart sits in row 4, full width; canvas height: 240 px.

### Tablet (640–1023 px)

* Trend chart drops below the insights panel, full width; height: 280 px.
* Distribution chart unchanged in layout; height: 220 px.

### Mobile (< 640 px)

* Trend chart canvas height: 220 px. X-axis tick density drops to 4 max.
* Distribution chart bar height drops to 24 px; right-side `(count)` is hidden, percent only.
  The full label appears in the tooltip.
* Range selector remains a 4-button segmented control; buttons shrink to 44 px tap target,
  text remains visible.

---

## Accessibility for Charts

* Each chart is wrapped in a `<figure>` with a `<figcaption>` summarizing the trend in plain
  language (e.g., *"Total committed value rose 5.2% over the last 30 days."*).
* A visually-hidden data table mirrors the chart series so screen readers can read the data
  without a custom plugin.
* Hover tooltip data is also reachable by keyboard: arrow keys move a cursor along the
  series; the focused point announces its label and value.
* Chart colors satisfy 3:1 contrast against the `#0a0a0a` background; line + marker pairing
  ensures color is not the only signal for the focused point.
* See [`accessibility.md`](./accessibility.md) for the full QA list.

---

## What charts may **not** do on the overview

* Animate on data update (only on initial mount). Live updates use a subtle highlight on the
  newest point, not a re-tween of the whole series.
* Display more than 2 series in the trend chart.
* Show a y-axis log scale by default. Log is opt-in via a settings toggle.
* Render predictive lines, "what-if" overlays, or any modeled data without an explicit label
  (the overview shows what *happened*, not what *might*).

---

## QA Checklist for Charts

- [ ] Trend chart has all four states designed.
- [ ] Distribution chart has all four states designed.
- [ ] Range selector and KPI deltas update together — no drift.
- [ ] Tooltip is keyboard reachable; arrow keys move a focus cursor along the trend chart.
- [ ] Distribution categories use only iconography-system colors.
- [ ] Each chart has a visually-hidden data table fallback.
- [ ] Chart heights at 360 px viewport leave KPIs above the fold; user can scroll without
      losing context.
