# Findings — Dashboard (Commitments + Health Charts)

Flow code:
* [`src/app/commitments/page.tsx`](../../../src/app/commitments/page.tsx)
* [`src/app/commitments/[id]/page.tsx`](../../../src/app/commitments/[id]/page.tsx)
* [`src/components/MyCommitmentsStats/`](../../../src/components/MyCommitmentsStats/)
* [`src/components/MyCommitmentsGrid.tsx`](../../../src/components/MyCommitmentsGrid.tsx)
* [`src/components/dashboard/`](../../../src/components/dashboard/) (health charts)
* [`src/components/KPICard/`](../../../src/components/KPICard/)
* [`src/components/HealthMetricsSkeleton.tsx`](../../../src/components/HealthMetricsSkeleton.tsx)

The dashboard is where the issue's "charts accessibility" requirement lands. Findings are
heavy on the chart side because the chart components ship with no a11y wrapping at all.

---

### F-04-01 — Health charts have no text-equivalent path

| | |
| :---- | :---- |
| Severity | **Critical** |
| Effort | M (per chart, 4 charts) |
| WCAG | 1.1.1 (Non-text Content), 1.3.1 (Info and Relationships), 2.1.1 (Keyboard) |
| Location | [`HealthMetricsValueHistoryChart.tsx`](../../../src/components/dashboard/HealthMetricsValueHistoryChart.tsx), [`HealthMetricsDrawdownChart.tsx`](../../../src/components/dashboard/HealthMetricsDrawdownChart.tsx), [`HealthMetricsFeeGenerationChart.tsx`](../../../src/components/dashboard/HealthMetricsFeeGenerationChart.tsx), [`HealthMetricsComplianceChart.tsx`](../../../src/components/dashboard/HealthMetricsComplianceChart.tsx) |

**Observation.** Each chart is a Recharts SVG with a custom tooltip that fires on
pointer hover only. There is no `<figure>`, no `<figcaption>`, no visually-hidden data
table, no keyboard-navigable cursor across data points, and no plain-language summary.

**User impact.** Screen-reader users cannot read the data at all. Keyboard-only users
can see the chart but cannot inspect any individual data point's value — the tooltip is
mouse-only.

**Recommended fix.** For each chart:

1. Wrap in `<figure role="figure">` with an `<figcaption>` containing a one-sentence
   plain-language summary: `Total committed value rose 5.2% over the last 30 days,
   peaking at 52,600 XLM on Jan 28.` The summary is generated from the same data the
   chart consumes.
2. Add a visually-hidden `<table>` mirroring the chart series. Mobile users, SR users,
   and CSV-export users all benefit from this.
3. Add keyboard-cursor support: arrow keys move a focus indicator across data points;
   the focused point announces its label and value via an `aria-live` region.
4. Each chart series has a name-based legend (already partially supported by Recharts);
   make sure the legend swatches have a non-color signal (line / dashed / dotted) so a
   user with deuteranopia can distinguish them in greyscale.

This is a per-chart pattern. Wrap once into a `<ChartFigure>` primitive (not in scope of
this audit; called out in [`component-spec-updates.md`](../component-spec-updates.md)).

**Verification.** With NVDA: each chart announces its caption on entry; arrow keys
traverse data points and announce values; the visually-hidden table is reachable via the
`Tables` rotor command.

---

### F-04-02 — KPI tile compact notation is announced as bare numbers

| | |
| :---- | :---- |
| Severity | High |
| Effort | S |
| WCAG | 1.3.1 (Info and Relationships) |
| Location | [`KPICard.tsx`](../../../src/components/KPICard/KPICard.tsx) |

**Observation.** Tiles displaying compact notation (`1.2M`, `342K`) include no
`aria-label` to expand to the full numeric form. The existing component spec
([`KPICard.spec.md`](../../../src/components/KPICard/KPICard.spec.md)) calls out
auto-generated `aria-label` of `${label}: ${formattedValue}` — but `formattedValue` is
the compact form. SR reads "TVL one point two M".

**User impact.** SR users hear "M" / "K" abbreviations rather than millions / thousands,
exposing them to the same issue called out in
[`docs/accessibility-dense-ui.md` §2](../../../docs/accessibility-dense-ui.md).

**Recommended fix.** Update `KPICard.tsx` to compute a separate `aria-label`:
`${label}: ${expandedValue}` where `expandedValue` is `1.2 million dollars` or
`342 thousand`. Keep the visible value compact. Document this in
[`component-spec-updates.md`](../component-spec-updates.md).

**Verification.** With NVDA on a tile rendering `1.2M`: announces "TVL: 1.2 million
dollars".

---

### F-04-03 — KPI tile delta direction is conveyed by color and arrow icon only

| | |
| :---- | :---- |
| Severity | High |
| Effort | S |
| WCAG | 1.4.1 (Use of Color), 1.3.1 (Info and Relationships) |
| Location | [`KPICard.tsx`](../../../src/components/KPICard/KPICard.tsx) |

**Observation.** Delta indicators show direction via color (green / red / neutral) and an
icon (TrendingUp / TrendingDown / Minus). Sighted users get the signal; SR users hear
"+12.5 percent" with no direction word. For "drawdown up = bad" metrics the direction is
also semantically inverted.

**User impact.** SR users miss direction context. Color-blind sighted users may also
mis-read the icon at small sizes.

**Recommended fix.** Add direction in the announced label:
`${label}: ${expandedValue}, ${expandedDelta} ${direction} versus ${period}` where
`direction` is `increase` / `decrease` / `unchanged`. For metrics where up-is-bad
(drawdown), include semantic context: `Drawdown increased by 0.5 percent — warning`.

**Verification.** With NVDA on a delta tile: announces "Total Revenue: 1.25 million
dollars, increase of 12.5 percent versus last month".

---

### F-04-04 — Stats grid has no heading

| | |
| :---- | :---- |
| Severity | Medium |
| Effort | S |
| WCAG | 2.4.6 (Headings and Labels), 1.3.1 (Info and Relationships) |
| Location | [`MyCommitmentsStats.tsx`](../../../src/components/MyCommitmentsStats.tsx) |

**Observation.** The stats grid (Total Active, Committed Value, Avg Compliance, Fees)
renders four KPI tiles with no surrounding heading. The page jumps from page header
straight into KPI tiles.

**User impact.** Screen-reader users cannot use the headings rotor to jump to "Stats" or
"Overview". They have to walk all four tiles in document order.

**Recommended fix.** Add a visually-hidden `<h2>Overview</h2>` (or visible heading if the
design allows) above the stats grid. Group the tiles inside a region:
`<section aria-labelledby="overview-heading">`.

**Verification.** With NVDA in `H` mode: headings list contains "Overview" between
"My Commitments" and "Filters".

---

### F-04-05 — Commitment grid has no result-count announcement

| | |
| :---- | :---- |
| Severity | High |
| Effort | S |
| WCAG | 4.1.3 (Status Messages) |
| Location | [`MyCommitmentsGrid.tsx`](../../../src/components/MyCommitmentsGrid.tsx), filter handlers in [`src/app/commitments/page.tsx`](../../../src/app/commitments/page.tsx) |

**Observation.** Same shape as F-03-02 (marketplace) but for the commitments grid.
Filters change the visible cards silently.

**User impact.** SR users get no signal that filters changed the result set.

**Recommended fix.** Same as F-03-02. An `aria-live="polite"` region near the top of the
grid updates with `Showing <n> commitments`.

**Verification.** Change a filter with NVDA on; announcement fires.

---

### F-04-06 — Commitment card actions buried inside whole-card click target

| | |
| :---- | :---- |
| Severity | Medium |
| Effort | M |
| WCAG | 4.1.2 (Name, Role, Value), 2.4.4 (Link Purpose) |
| Location | [`MyCommitmentCard.tsx`](../../../src/components/MyCommitmentCard.tsx) |

**Observation.** Same issue as F-03-05 (marketplace) — commitment cards combine multiple
actions. Each card likely surfaces "Details", "Attestations", "Early Exit" as buttons
inside a clickable region.

**User impact.** SR users hear card-name + all action labels concatenated; keyboard
users land on a single confusing target.

**Recommended fix.** Same pattern as F-03-05. The card's primary navigation (open
details) is a single link with a concise name. Secondary actions are separate buttons
inside the card.

**Verification.** Tab through the grid; each card produces 1 primary focus stop + N
button stops, all named distinctly.

---

### F-04-07 — Detail page chart tabs lack `role="tablist"` semantics

| | |
| :---- | :---- |
| Severity | Medium |
| Effort | M |
| WCAG | 4.1.2 (Name, Role, Value), 2.1.1 (Keyboard) |
| Location | chart tab control inside the commitment detail page (`HealthMetricsSkeleton.tsx` shows the visual structure mirroring the populated view) |

**Observation.** The tabs that switch between Value / Drawdown / Fees / Compliance
charts likely render as buttons without ARIA tab semantics (`role="tab"`,
`aria-selected`, `aria-controls`, surrounding `role="tablist"`). Without these, arrow-key
navigation between tabs and selection state are not exposed.

**User impact.** SR users do not know they are in a tab group. Keyboard users have to Tab
through every tab rather than arrow-keying inside the group.

**Recommended fix.** Adopt the [WAI tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/):
* `<div role="tablist" aria-label="Health metrics">`.
* Each tab is a `<button role="tab">` with `aria-selected` and `aria-controls` pointing
  to the corresponding panel's id.
* Each panel has `role="tabpanel"`, `aria-labelledby` referencing the tab, and
  `tabindex="0"` to be focusable for SR navigation.
* Arrow keys move selection within the tablist; Tab moves to the panel.

**Verification.** With NVDA in tab-group mode: announce "Health metrics tab list, 4
tabs"; arrow keys cycle; Tab moves to the panel content.

---

### F-04-08 — Volatility / compliance gauge widgets need text equivalents

| | |
| :---- | :---- |
| Severity | High |
| Effort | M |
| WCAG | 1.1.1 (Non-text Content), 1.3.1 (Info and Relationships) |
| Location | [`VolatilityExposureMeter/`](../../../src/components/VolatilityExposureMeter/), `ReputationDisplay.tsx` |

**Observation.** Visual gauges and meters convey state by needle position and color band.
Without explicit text the value is invisible to AT.

**User impact.** SR users miss the gauge reading entirely.

**Recommended fix.** Each gauge is wrapped in a `<figure>` with a `<figcaption>` giving
the value and band label: `Volatility 32% — moderate.` The numeric value also appears as
visible text adjacent to the gauge so sighted low-vision users do not depend on the
needle alone.

**Verification.** Tab to or read past each gauge with NVDA; the announcement includes
both number and band.

---

## Summary

| ID | Severity | Effort |
| :- | :------- | :----- |
| F-04-01 | Critical | M (× 4 charts) |
| F-04-02 | High | S |
| F-04-03 | High | S |
| F-04-05 | High | S |
| F-04-08 | High | M |
| F-04-04 | Medium | S |
| F-04-06 | Medium | M |
| F-04-07 | Medium | M |

**Recommendation:** F-04-01 is the largest item in the audit and the most consequential
for charts a11y. Treat it as a single PR introducing the `<ChartFigure>` primitive with
its data table + caption + arrow-key cursor; apply to all four health charts plus future
overview charts.
