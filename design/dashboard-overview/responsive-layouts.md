# Dashboard Overview — Responsive & Mobile-First Layouts

The Dashboard Overview is designed **mobile-first**. The 360 px viewport is the canonical
layout from which everything else is a wider restatement. This file defines the breakpoints,
grid behavior, and density rules that make every band reflow predictably.

---

## Breakpoints

| Name | Width | Primary device | Container |
| :--- | :---- | :------------- | :-------- |
| `xs` | 320–639 px | Phones | Full-bleed, 16 px padding |
| `sm` | 640–767 px | Large phones, small tablets | 24 px padding |
| `md` | 768–1023 px | Tablets, split-screen laptops | 32 px padding, max 720 px |
| `lg` | 1024–1279 px | Standard laptops | 32 px padding, max 1024 px |
| `xl` | 1280 px+ | Desktops | 32 px padding, **max 1200 px** (matches existing `commitments/overview` page) |

Container widths above are page-level. The KPI strip and chart band always span the full
container width. Insights are constrained to 40% of the row only at `lg` and `xl`.

---

## Per-Band Reflow

### 1. Greeting + Range Selector

| Breakpoint | Layout |
| :--------- | :----- |
| `xs`–`sm` | Stacked: greeting on row 1, range selector on row 2 (full-width segmented control) |
| `md`+ | Side-by-side: greeting left, range selector right |

The range selector remains a 4-button segmented control at every breakpoint. Buttons
honor a 44 × 44 px tap target.

### 2. KPI Strip

| Breakpoint | Hero | Primary | Secondary |
| :--------- | :--- | :------ | :-------- |
| `xs` | 1 column, stacked, full width | 1 column, stacked | Collapsed in `More metrics` disclosure |
| `sm` | 1 column, stacked | 2 columns | Collapsed |
| `md` | 2 columns (3rd hero wraps) | 2 columns | 2 columns inside disclosure |
| `lg`+ | **3 columns** | **3 or 4 columns** | 4–6 columns |

Notes:

* The Hero tier never goes below 1 column. If three hero tiles cannot fit, drop one to the
  Primary tier rather than shrinking the type below 2rem.
* "More metrics" disclosure: a single button at the bottom of the strip with chevron + count
  (`More metrics (4)`). Expanded state persists per session.

### 3. Insights ╎ Trend Chart Band

| Breakpoint | Layout |
| :--------- | :----- |
| `xs` | Insights as horizontal carousel, snap-scroll (1 visible, peek of next), pagination dots. Trend chart below at 220 px height. |
| `sm` | Insights stacked vertically (max 3 cards), full-width. Trend chart below at 240 px. |
| `md` | Same as `sm`, chart height 280 px. |
| `lg`+ | Two-column band: insights 40%, trend chart 60%. Chart canvas 320 px. |

### 4. Distribution Chart

| Breakpoint | Layout |
| :--------- | :----- |
| `xs`–`sm` | Bars 24 px, count label hidden (in tooltip), chart height 200 px |
| `md`+ | Bars 32 px, count label visible, chart height 240 px |

---

## Spacing Tokens

| Token | `xs` | `sm` | `md`+ |
| :---- | :--- | :--- | :---- |
| Page gutter | 16 px | 24 px | 32 px |
| Band vertical gap | 24 px | 32 px | 40 px |
| KPI inter-card gap | 12 px | 16 px | 24 px |
| Chart inner padding | 12 px | 16 px | 24 px |

---

## Type Scale

Mobile-first scale, multiplied 1.0× / 1.125× / 1.25× across `xs` / `md` / `xl`.

| Token | `xs` | `md` | `xl` |
| :---- | :--- | :--- | :--- |
| Page title | 1.5 rem | 1.75 rem | 2 rem |
| KPI hero value | 2 rem | 2.25 rem | 2.5 rem |
| KPI primary value | 1.5 rem | 1.75 rem | 2 rem |
| KPI secondary value | 1.25 rem | 1.375 rem | 1.5 rem |
| Insight headline | 1 rem | 1 rem | 1 rem |
| Insight body | 0.875 rem | 0.875 rem | 0.875 rem |
| Chart axis label | 0.75 rem | 0.75 rem | 0.75 rem |

The KPI value is the only token that grows past `md`. Body and label sizes are intentionally
flat across breakpoints so reading effort is consistent.

---

## Density Rules

### What grows with width

* KPI tile padding, value font size, inter-card gap.
* Trend chart canvas height.
* Insights panel becomes a column instead of a row.

### What stays fixed

* Body copy, axis labels, button heights, tap targets.
* Skeleton shapes (they always mirror the populated layout at the current breakpoint).

### What shrinks on mobile

* Distribution bar height (32 → 24 px).
* Inter-card gaps (24 → 12 px).
* X-axis tick density (6 → 4 visible labels).
* Secondary KPI tier — collapsed by default.

---

## Touch & Pointer

* Minimum tap target: **44 × 44 px** for any interactive element on `xs`/`sm`. Range selector,
  insight actions, retry buttons, "More metrics" disclosure all enforce this.
* Hover-only affordances (tooltip-on-hover for KPI label info) must also be reachable by tap
  — the info icon is a real button on touch devices, not a hover-only cursor change.
* Carousel on mobile uses native scroll-snap (`scroll-snap-type: x mandatory`); no custom JS
  drag gesture is required.

---

## Container Queries (where supported)

Where the bundle supports container queries, prefer them for the **insights ╎ trend** band so
the layout responds to its own column rather than the viewport. This handles the case where
the page is rendered inside a narrower frame (e.g., a settings panel) without a separate
breakpoint.

Fallback: viewport media queries with the same thresholds as above.

---

## Skeleton & Loading at Each Breakpoint

Skeletons must mirror the populated layout at the **current** breakpoint, not a single
canonical layout. Concretely:

| Breakpoint | KPI skeletons | Insights skeletons | Chart skeletons |
| :--------- | :------------ | :----------------- | :-------------- |
| `xs` | 1 column stack, hero × 3 then primary × 4 | 3 stacked cards in carousel rail | Trend 220 px, distribution 200 px |
| `md` | 2 columns | 3 stacked full-width cards | Trend 280 px, distribution 240 px |
| `lg`+ | 3 columns hero, 3–4 columns primary | 3 cards in 40% column | Trend 320 px, distribution 240 px |

This prevents a layout shift when the breakpoint **and** the data resolve together (e.g., a
user rotates their phone mid-load).

---

## QA Checklist (Breakpoints)

- [ ] Page renders without horizontal scroll at 320 px.
- [ ] Tap targets meet 44 × 44 px on `xs`/`sm`.
- [ ] KPI strip never shows partial rows (3-4-3 layout, not 3-2-1).
- [ ] Hero KPI value is the largest type on the page at every breakpoint.
- [ ] Insights carousel snaps cleanly and shows pagination dots on `xs`.
- [ ] Charts remain readable at 360 px width with at most 4 axis labels visible.
- [ ] Range selector and `More metrics` disclosure remain visible above the fold on `xs`.
- [ ] Loading skeletons match the populated layout at the current breakpoint.
- [ ] Container max-width caps at 1200 px on `xl`, matching the existing
      [`commitments/overview`](../../src/app/commitments/overview/page.tsx) page.
