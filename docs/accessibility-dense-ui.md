# Accessibility Guidance: Data Tables & Dense Numeric Layouts

This document defines the accessibility standards for presenting dense numeric data, financial metrics, and complex tables within the CommitLabs platform.

## 1. General Principles

- **Clarity over Density**: While we aim for information density, accessibility requires that the logical relationship between data points remains clear.
- **Linear Consistency**: Content must follow a logical reading order (left-to-right, top-to-bottom) that remains coherent when simplified by a screen reader.
- **No Meaning through Color Alone**: Never use color (e.g., green for profit, red for loss) as the sole indicator of state. Use iconography with aria-labels or explicit text.

## 2. Number Formatting & Units

When displaying financial figures, screen readers often struggle with abbreviations and symbols.

### Standard Formatting

| Visual Display | Required Screen Reader Label (`aria-label`) |
| :------------- | :------------------------------------------ |
| $1.2B          | 1.2 Billion Dollars                         |
| 15.4%          | 15.4 percent                                |
| +420 XLM       | Increase of 420 Stellar Lumens              |
| 1:2.5          | Ratio of 1 to 2.5                           |

### Implementation Example

```tsx
<div aria-label="Current Balance: 1250 Stellar Lumens">
  <span aria-hidden="true">1.25K XLM</span>
</div>
```

## 3. Abbreviations & Terminology

Finance-specific abbreviations (APY, TVL, XLM) must be expanded for assistive technology.

- **Method 1: `<abbr>` Tag**: Use for standard industry terms.
  ```html
  <abbr title="Annual Percentage Yield">APY</abbr>
  ```
- **Method 2: `aria-label`**: Use when the visual abbreviation is part of a larger metric block.
  ```tsx
  <div aria-label="Total Value Locked: 50 million dollars">TVL: $50M</div>
  ```

## 4. Data Table Patterns

Tables must use semantic HTML to allow users to navigate by row and column headers.

### Table Structure Requirements

1. **Captions**: Every table should have a `<caption>` for context.
2. **Scope**: Use `scope="col"` and `scope="row"` to explicitly link headers to data.
3. **Sorting**: Use `aria-sort` (ascending/descending/none) on column headers to indicate active sorting.

### Accessible Table Example

```tsx
<table className="min-w-full">
  <caption>Active Commitments and their current risk status</caption>
  <thead>
    <tr>
      <th scope="col" aria-sort="descending">
        Commitment ID
      </th>
      <th scope="col">Asset Type</th>
      <th scope="col" aria-label="Annual Percentage Yield">
        APY
      </th>
      <th scope="col">Actions</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th scope="row">#00124</th>
      <td>XLM</td>
      <td aria-label="5.2 percent">5.2%</td>
      <td>
        <button aria-label="View details for commitment 00124">View</button>
      </td>
    </tr>
  </tbody>
</table>
```

## 5. Dense Cards & Metric Lists

When displaying metrics in a grid or list (e.g., a dashboard header), use a description list (`<dl>`) or a list (`<ul>`) to group related items.

### Key Standards:

- **Grouping**: Group label and value together so screen readers don't read all labels first, then all values.
- **State Changes**: If a value updates live (e.g., price feed), use `aria-live="polite"` only on the specific changing value, not the entire container.

```tsx
<dl className="grid grid-cols-3 gap-4">
  <div>
    <dt id="label-drawdown">Max Drawdown</dt>
    <dd aria-labelledby="label-drawdown" aria-label="12 percent">
      12%
    </dd>
  </div>
  <div>
    <dt id="label-health">Health Score</dt>
    <dd aria-labelledby="label-health">98/100</dd>
  </div>
</dl>
```

## 6. Design QA Accessibility Checklist

Before committing UI changes involving tables or dense data, verify the following:

### Structure

- [ ] Table uses `<thead>`, `<tbody>`, and `<th>` with proper `scope`.
- [ ] Data is navigable via keyboard Tab and Arrow keys.
- [ ] Focus indicators are clearly visible on all interactive numeric elements.

### Screen Reader Announcements

- [ ] Abbreviated numbers (K, M, B) have full labels via `aria-label`.
- [ ] Currency symbols and units (XLM, USDC) are announced as words.
- [ ] Percentage signs are announced as "percent".
- [ ] Sort icons have `aria-label` indicating the current sort state.

### Visual Constraints

- [ ] Contrast ratio for numeric text is at least 4.5:1.
- [ ] Text can be scaled to 200% without loss of content or overlapping.
- [ ] Negative values use more than just color (e.g., a minus sign or down arrow icon with alt text).

## 7. Annotated Examples

### Bad Pattern (Inaccessible)

```html
<!-- ❌ Issues: No semantic table, color-only state, ambiguous abbreviations -->
<div class="row">
  <span>#123</span>
  <span class="text-green">1.5M</span>
  <span>APY</span>
</div>
```

### Good Pattern (Accessible)

```html
<!-- ✅ Fixes: Semantic row header, explicit labels, hidden symbols for SR -->
<tr>
  <th scope="row">ID: #123</th>
  <td>
    <span aria-label="Volume: 1.5 Million Dollars"> $1.5M </span>
  </td>
  <td>
    <span class="sr-only">Annual Percentage Yield is</span>
    <abbr title="Annual Percentage Yield">APY</abbr>
  </td>
</tr>
```

---

## 8. Volatility Exposure Meter — Threshold Zones & Value Annotations

The `VolatilityExposureMeter` component visualizes portfolio volatility with three clearly defined threshold zones aligned to risk profiles.

### Threshold Zones

| Zone | Range | Risk Profile Alignment | Color Indicator |
| :--- | :---- | :--------------------- | :-------------- |
| Safe | 0–33% | Conservative | Green (`#00C950`) |
| Caution | 34–66% | Balanced | Amber (`#FFA500`) |
| Danger | 67–100% | Aggressive | Red (`#FB2C36`) |

### Accessibility Requirements

#### Meter Attributes

| Attribute | Value | Purpose |
| :---------| :---- | :------ |
| `role="meter"` | — | Identifies the element as a gauge |
| `aria-valuenow` | 0–100 | Current numeric value |
| `aria-valuemin` | 0 | Minimum value |
| `aria-valuemax` | 100 | Maximum value |
| `aria-valuetext` | `"X percent, Z zone — annotation"` | Human-readable value + zone explanation |
| `aria-label` | `"Volatility exposure: X%, Y range."` | Primary accessible name |

#### Zone Labels & Annotations

- Zone labels (`Safe`, `Caution`, `Danger`) are rendered as a list (`role="list"` / `role="listitem"`)
- The active zone has `aria-current="true"`
- A persistent annotation box with `role="status"` and `aria-live="polite"` announces zone changes
- Non-color indicators (emoji icons) are included with `aria-hidden="true"`
- An info (ℹ) button with `role="tooltip"` on each zone provides detailed hover/accessible explanation

#### Risk Profile Badge

When a `riskProfileId` prop is provided, a badge appears next to the title announcing the user's risk tier (e.g., "Conservative", "Balanced", "Aggressive") via visual text and `aria-label`.

### Component Props

```tsx
interface VolatilityExposureMeterProps {
  /** Current exposure as a percentage (0–100). Clamped when rendering. */
  valuePercent: number
  /** Optional short description of what the exposure means. */
  description?: string
  /**
   * Optional risk-profile identifier that highlights the matching zone.
   * One of 'conservative' | 'balanced' | 'aggressive'.
   */
  riskProfileId?: RiskProfileId
}
```

### Example Usage

```tsx
<VolatilityExposureMeter
  valuePercent={45}
  riskProfileId="balanced"
  description="Current exposure based on allocation and market conditions."
/>
```

### Testing Checklist

Before committing changes to `VolatilityExposureMeter`, verify:

- [ ] All threshold zone boundaries (0, 33, 34, 66, 67, 100) render correct zone
- [ ] ARIA attributes (`role`, `aria-valuenow`, `aria-valuetext`, `aria-label`) are present and accurate
- [ ] Annotation box text matches active zone
- [ ] Risk profile badge appears when `riskProfileId` is provided
- [ ] Tooltip trigger has `aria-label` for screen readers
- [ ] Zone labels use semantic list markup (`role="list"` / `role="listitem"`)
- [ ] Non-color indicators (icons) are present alongside zone names
- [ ] All tests pass with 95%+ coverage threshold

---

_Created as part of Issue #490. Review this guide when building new dashboard components with threshold visualizations._
