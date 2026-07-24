# Dashboard Overview — KPI Card Specs

This document defines how KPI cards are **composed** on the Dashboard Overview. The
underlying component spec (props, color tokens, animation) lives in
[`src/components/KPICard/KPICard.spec.md`](../../src/components/KPICard/KPICard.spec.md);
the rules here are about *which* metrics appear, in *what tier*, and with *what content*.

---

## Tier Model

The overview surfaces three KPI tiers. Tier determines size, position, and the data
the tile is allowed to show.

| Tier | Size | Count | Position | Job |
| :--- | :--- | :---- | :------- | :-- |
| Hero | `large` | exactly **3** | Top row, full width | Answer "how am I doing?" at a glance |
| Primary | `medium` | 3–4 | Second row | Add the supporting metrics a user checks weekly |
| Secondary | `small` | 4–6 | Third row, optional | Counts and minor indicators; collapsible on mobile |

The three-tier cap is intentional. Beyond ~10 tiles a user stops reading numbers and starts
hunting — at which point they belong on a dedicated reports page, not the overview.

### Default tile assignment

| Tier | Slot 1 | Slot 2 | Slot 3 | Slot 4 |
| :--- | :----- | :----- | :----- | :----- |
| Hero | Total Committed Value | Average Compliance Score | Active Commitments | — |
| Primary | Fees Generated | Total Drawdown | New Commitments (period) | At-Risk Commitments |
| Secondary | Settled (period) | Early Exits (period) | Avg. Duration | Attestations Submitted |

---

## Anatomy of a KPI Tile

```
┌──────────────────────────────────────────────────┐
│  [icon]   LABEL                          (info)  │  ← header
│                                                  │
│  $1,250,000                       ▲ +12.5%       │  ← value + delta
│                                                  │
│  vs last 30 days · updated 2m ago                │  ← context
└──────────────────────────────────────────────────┘
```

| Element | Required | Notes |
| :------ | :------- | :---- |
| Label | Yes | Sentence case, ≤ 24 chars, no abbreviation unless wrapped in `<abbr>` |
| Value | Yes | Single number; format chosen via `format` prop, never two metrics in one tile |
| Delta | Recommended for hero, optional otherwise | Direction icon + percent + period |
| Context line | Optional | Period label, freshness, or one-clause qualifier |
| Icon | Optional, encouraged on hero | From the iconography system; semantic, not decorative |
| Info tooltip | Optional | Used when the label needs a definition (e.g., "Compliance Score") |

### What a tile may **not** contain

* Two metrics stacked (e.g., "TVL / TVL change") — split into two tiles or use the delta slot.
* A sparkline that competes with the trend chart below — see [`charts.md`](./charts.md) for
  where micro-charts are allowed.
* Action buttons — KPIs are read-only; CTAs live in the insights panel.
* Free-text explanations longer than the context line.

---

## Hierarchy Rules

1. **Hero tiles get the most pixels.** On desktop they take a full-width 3-column grid;
   their value font is the largest type on the page.
2. **A hero tile must have a delta or a context line.** If neither is available, demote the
   metric to Primary.
3. **Color is meaning, not decoration.** Use the variant table below; never assign color to
   indicate visual variety.
4. **Mobile collapses Secondary by default.** On viewports ≤ 640 px, Secondary tiles render
   inside a "More metrics" disclosure that is collapsed on first paint.

### Variant ↔ Metric Category

(Aligned with [`KPICard.spec.md` §Color Assignment](../../src/components/KPICard/KPICard.spec.md#color-assignment-by-metric-type).)

| Category | Variant | Example metric |
| :------- | :------ | :------------- |
| Value / revenue | `green` | Total Committed Value, Fees Generated |
| Growth / change | `teal` | New Commitments, Active Commitments |
| Score / compliance | `purple` | Avg. Compliance Score |
| Count / users | `blue` | Attestations Submitted |
| Risk / warning | `orange` | At-Risk Commitments, Drawdown |
| Neutral / supporting | `neutral` | Avg. Duration, Settled |

---

## Content Rules

### Labels

* Sentence case, no trailing period.
* Avoid finance abbreviations unless they are universal (`%`, `XLM`). For project-specific
  terms (`TVL`, `APY`), wrap the visible text in `<abbr>` and provide a long form in the
  info tooltip — see [`docs/accessibility-dense-ui.md` §3](../../docs/accessibility-dense-ui.md).
* Label answers the question "what is this number?" — not "what should the user do?"

### Values

* Always formatted with thousands separators.
* Currency tiles include the symbol or 3-letter code; never both.
* Compact notation (`1.2M`, `342K`) only on viewports ≤ 768 px **or** when the unformatted
  number exceeds 7 digits.
* `0` is a valid value and renders as `0` — **not** an empty state.

### Deltas

* Period must be explicit: `vs last 7 days`, `vs last month`, `vs Q3`. Never bare `+12.5%`.
* `up` is not always good. Apply semantic direction: drawdown going *up* is bad and renders
  with the warning treatment, not the success treatment.
* When the previous-period value is itself zero or unavailable, render the delta as
  `— new` rather than `+∞%`.

### Context line

* One clause, ≤ 60 chars.
* Allowed content: comparison period, data freshness ("updated 2m ago"), qualifier
  ("excludes pending"). Disallowed: opinions, CTAs, secondary metrics.

---

## Per-Tile State Coverage

Every tile must implement all four states. State logic is owned by the parent — tiles do
not poll. Visual treatment is defined in [`states.md`](./states.md); the table below names
the trigger.

| State | Trigger | Visual cue |
| :---- | :------ | :--------- |
| Default (populated) | Value + delta resolved | Standard render |
| Loading | Fetch in flight, no cached value | Skeleton bars; label still visible |
| Error | Fetch failed | Alert icon, retry control, last-known value if cached |
| Empty | Fetch resolved with no data (e.g., new account) | "No commitments yet" + onboarding CTA in the insights panel |

> **Empty ≠ zero.** A user with one settled commitment worth `0 XLM` is **populated** with
> value `0`. A user with no commitments is **empty** and gets the onboarding treatment.

---

## Spacing & Type

| Token | Hero | Primary | Secondary |
| :---- | :--- | :------ | :-------- |
| Padding | `2rem` | `1.5rem` | `1rem` |
| Value type | `2.5rem` / 600 | `2rem` / 600 | `1.5rem` / 600 |
| Label type | `0.875rem` / 500 / muted | `0.75rem` / 500 / muted | `0.75rem` / 500 / muted |
| Delta badge | `0.75rem` | `0.75rem` | hidden when ≤ 360 px |
| Inter-card gap | `1.5rem` desktop · `1rem` ≤ 640 px |

---

## QA Checklist for the KPI Strip

- [ ] Three hero tiles fit on a single row at 1280 px without truncation.
- [ ] Every tile has all four states designed in Figma.
- [ ] No tile shows two numbers as the primary value.
- [ ] Delta direction respects metric semantics (drawdown up = warning).
- [ ] Mobile collapses Secondary into a disclosure; first paint shows Hero + Primary only.
- [ ] All labels pass the sentence-case + ≤ 24 char rule.
- [ ] Tile aria-labels expand abbreviations and units (see [`accessibility.md`](./accessibility.md)).
