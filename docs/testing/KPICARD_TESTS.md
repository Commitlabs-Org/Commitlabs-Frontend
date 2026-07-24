# KPICard Test Coverage

**File:** `src/components/KPICard/KPICard.test.tsx`  
**Framework:** Vitest + React Testing Library (`@vitest-environment happy-dom`)  
**Total tests:** 95 | **Pass rate:** 100%

---

## Component under test

`src/components/KPICard/KPICard.tsx` — exports:

| Export | Kind | Description |
|---|---|---|
| `KPICard` | Component | Main metric display card |
| `formatNumber` | Utility | Locale-formatted integer/decimal |
| `formatCurrency` | Utility | USD (or custom) currency string |
| `formatPercentage` | Utility | Percentage with optional sign |
| `formatCompact` | Utility | K/M/B compact notation |
| `calculateDelta` | Utility | Computes direction + value from two numbers |

---

## Test groups

### Utility functions (26 tests)

All formatters are pure functions and are tested in isolation without any DOM rendering.

| Group | Tests |
|---|---|
| `formatNumber` | Locale separators, custom decimals, string input, NaN → `--`, zero, negative |
| `formatCurrency` | USD prefix, custom currency code, decimals param, string input, NaN → `--` |
| `formatPercentage` | One decimal default, custom decimals, `showSign=true` (positive/negative/zero), NaN → `--` |
| `formatCompact` | B / M / K thresholds, below-1000 passthrough, NaN → `--` |
| `calculateDelta` | Up/down/neutral direction, division-by-zero guard, string inputs, NaN inputs |

### Default state (6 tests)

- Label and formatted value are rendered
- `undefined` value renders `--`
- `description` prop renders a `<p>` element
- `tooltip` prop renders `<span title="...">` hint character
- `icon` prop renders an SVG

### Format types (7 tests)

| Format | Test assertion |
|---|---|
| `currency` | `$1,250.00` with `decimals=2` |
| `currency` + custom `unit` | Custom currency code applied |
| `currency` + `decimals=0` | `$1,250` with no fractional part |
| `percentage` | `85.2%` with `decimals=1` |
| `count` | `1.5M` for `1_500_000` |
| `score` | `94.2` for `94.2` |
| `value` (default) | `9,876` locale formatting |

### Delta indicators (14 tests)

- Delta value renders as `{value.toFixed(1)}%`
- `period` string renders alongside the value
- TrendingUp / TrendingDown / Minus SVG present for each direction
- Auto-calculates delta from `previousValue` (up and down cases)
- Explicit `delta` prop takes precedence over `previousValue`
- No delta element rendered when neither prop is provided
- `isPercentage` flag rounds value to one decimal
- `_deltaPositive_` / `_deltaNegative_` / `_deltaNeutral_` CSS module classes applied per direction
- WCAG 1.4.1: all three directions render an SVG icon (direction not conveyed by color alone)

### Loading state (6 tests)

- Default message: `Loading metrics...`
- Custom `loadingMessage` renders
- Spinner SVG present inside `._loadingState_` element
- Two `._skeletonBar_` elements rendered
- Value not rendered in loading state
- Card header / label not rendered in loading state

### Error state (7 tests)

- Default message: `Failed to load`
- Custom `errorMessage` renders
- AlertCircle SVG present inside `._errorState_` element
- Retry button present when `onRetry` is provided (`aria-label="Retry loading data"`)
- Retry button calls `onRetry` on click
- No Retry button when `onRetry` is omitted
- Value not rendered in error state

### Empty state (2 tests)

- Default message: `No data available`
- Value not rendered in empty state

### Color variants (7 tests)

All 6 variants (`teal`, `green`, `blue`, `purple`, `orange`, `neutral`) assert that the CSS module class `_<variant>_` is present on the root element.  
Default variant (`teal`) verified when `variant` prop is omitted.

### Size variants (4 tests)

All 3 sizes (`small`, `medium`, `large`) assert `_<size>_` CSS class on root.  
Default size (`medium`) verified when `size` prop is omitted.

### Interactivity (5 tests)

- No `role` or `tabindex` without `onClick`
- `role="button"` and `tabIndex=0` when `onClick` is provided
- `onClick` called on mouse click
- `onClick` called on `Enter` keydown
- `onClick` NOT called for `Space` or `Escape`

### Accessibility (4 tests)

- Auto-generated `aria-label` follows `"{label}: {formattedValue}"` pattern
- `ariaLabel` prop overrides auto-generated label
- Auto-label uses `--` when value is `undefined`
- Retry button uses `aria-label="Retry loading data"` (screen-reader friendly)

### Edge cases (7 tests)

| Case | Assertion |
|---|---|
| `value=0` | Renders `"0"`, not `"--"` |
| Negative value | `-500` renders correctly |
| Very long label (200 chars) | No crash |
| String `value="42"` | Rendered verbatim via format pipeline |
| Non-numeric string `"n/a"` | Renders `"--"` |
| All optional props omitted | Renders without crash |
| `delta.value=0, direction="neutral"` | Renders `"0.0%"` |

---

## Key patterns

**CSS module class assertions** — Vitest's CSS module transform preserves the local name in a hashed format (`_teal_8db2e0`). Tests use `.toContain('_teal_')` / `.toMatch(/_deltaNeutral_/)` partial matching.

**No mocks required** — `KPICard` has no external dependencies (no `next/link`, no fetch calls), so all tests render the component directly.

**Utility cross-check** — Auto-delta tests compute the expected `%` value via `calculateDelta` to confirm the component result matches the utility output.
