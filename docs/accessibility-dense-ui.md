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

_Created as part of Issue #237. Review this guide when building new dashboard components or marketplace tables._
