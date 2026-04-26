# KPI Card Component Specification

## Overview

The KPI Card is a reusable component for displaying dashboard metrics with built-in support for loading states, error handling, delta/change indicators, and multiple formatting options.

---

## Table of Contents

1. [Component Variants](#component-variants)
2. [Size Options](#size-options)
3. [State Management](#state-management)
4. [Formatting & Units](#formatting--units)
5. [Delta/Change Indicators](#deltachange-indicators)
6. [Hierarchy Rules](#hierarchy-rules)
7. [Layout Guidelines](#layout-guidelines)
8. [Accessibility](#accessibility)
9. [Usage Examples](#usage-examples)

---

## Component Variants

The KPI Card supports 6 color variants for different metric categories:

| Variant | Color | Use Case |
|---------|-------|----------|
| `teal` | `#0ff0fc` | Growth, performance, primary metrics |
| `green` | `#00ff7a` | Positive metrics, revenue, success |
| `blue` | `#3b82f6` | Informational, neutral-positive |
| `purple` | `#a855f7` | Analytics, scores, compliance |
| `orange` | `#f97316` | Warnings, attention needed |
| `neutral` | `#94a3b8` | Secondary metrics, counts |

### Visual Style

- **Background**: `#0a0a0a` (dark)
- **Border**: `1px solid rgba(255, 255, 255, 0.1)`
- **Border Radius**: `16px`
- **Hover Effect**: Border brightens + subtle glow + translateY(-2px)

---

## Size Options

| Size | Padding | Value Font | Icon Size | Use Case |
|------|---------|------------|-----------|----------|
| `small` | 1rem | 1.5rem | 14px | Dense grids, mobile |
| `medium` | 1.5rem | 2rem | 18px | Standard dashboard |
| `large` | 2rem | 2.5rem | 22px | Hero metrics, focus areas |

---

## State Management

### 1. Default State

Standard metric display with value, label, and optional delta.

```tsx
<KPICard
  label="Total Revenue"
  value={125000}
  format="currency"
  variant="green"
/>
```

### 2. Loading State

Displays a spinner with skeleton placeholder animation.

```tsx
<KPICard
  label="Total Revenue"
  state="loading"
  loadingMessage="Calculating revenue..."
  variant="green"
/>
```

**Loading UI Elements:**
- Rotating loader icon (matches accent color)
- Optional loading message
- Animated skeleton bars (pulse animation)

### 3. Error State

Displays error icon with optional retry button.

```tsx
<KPICard
  label="Total Revenue"
  state="error"
  errorMessage="Unable to load revenue data"
  onRetry={() => refetch()}
  variant="green"
/>
```

**Error UI Elements:**
- AlertCircle icon (red)
- Error message text
- Retry button (optional)

### 4. Empty State

Displays when no data is available but no error occurred.

```tsx
<KPICard
  label="Total Revenue"
  state="empty"
  variant="green"
/>
```

**Empty UI Elements:**
- Italicized "No data available" message

---

## Formatting & Units

### Supported Format Types

| Format | Description | Example |
|--------|-------------|---------|
| `value` | Default number | `1,234` |
| `currency` | USD currency | `$1,234.56` |
| `percentage` | Percentage | `85.2%` |
| `count` | Compact (K/M/B) | `1.2M` |
| `score` | Decimal score | `95.0` |

### Formatting Utilities

```tsx
import { formatNumber, formatCurrency, formatPercentage, formatCompact } from '@/components/KPICard';

// Numbers
formatNumber(1234.56, 2) → "1,234.56"

// Currency
formatCurrency(1234.56, 'USD', 2) → "$1,234.56"

// Percentage
formatPercentage(85.2, 1, true) → "+85.2%"

// Compact
formatCompact(1234567) → "1.2M"
```

### Custom Units

Override the default currency or add custom units:

```tsx
<KPICard
  label="Gas Used"
  value={45000}
  format="count"
  unit="Gwei"
  variant="blue"
/>
```

### Decimal Precision

Control decimal places per format type:

```tsx
// Currency with 0 decimals
<KPICard value={1250} format="currency" decimals={0} />

// Percentage with 2 decimal places
<KPICard value={85.234} format="percentage" decimals={2} />
```

---

## Delta/Change Indicators

### Delta Structure

```tsx
interface KPIDelta {
  value: number;        // The delta value (e.g., 12.5)
  direction: 'up' | 'down' | 'neutral';
  period?: string;      // e.g., "vs last 30 days"
  isPercentage?: boolean;
}
```

### Delta Display

| Direction | Icon | Color | Background |
|-----------|------|-------|------------|
| `up` | TrendingUp | `#00ff7a` | `rgba(0, 255, 122, 0.15)` |
| `down` | TrendingDown | `#ef4444` | `rgba(239, 68, 68, 0.15)` |
| `neutral` | Minus | `#94a3b8` | `rgba(148, 163, 184, 0.15)` |

### Auto-Calculate Delta

Provide `previousValue` and the component auto-calculates the delta:

```tsx
<KPICard
  label="Monthly Revenue"
  value={125000}
  previousValue={110000}
  variant="green"
/>
// Displays: $125,000 with +13.6% delta badge
```

### Manual Delta

Explicitly pass a delta object:

```tsx
<KPICard
  label="Active Users"
  value={5420}
  delta={{
    value: 8.2,
    direction: 'up',
    period: 'vs last week'
  }}
  variant="teal"
/>
```

---

## Hierarchy Rules

### Dashboard Metric Hierarchy

```
┌─────────────────────────────────────────────────────────┐
│                    DASHBOARD LAYOUT                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   HERO      │  │   HERO      │  │   HERO      │    │
│  │   (large)   │  │   (large)   │  │   (large)   │    │
│  │             │  │             │  │             │    │
│  │  $1.2M      │  │  85%       │  │  1,234      │    │
│  │  Total Rev  │  │  Compliance │  │  Active     │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │  PRIMARY    │  │  PRIMARY    │  │  PRIMARY    │    │
│  │  (medium)  │  │  (medium)  │  │  (medium)  │    │
│  │             │  │             │  │             │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │  SECONDARY │  │  SECONDARY │  │  SECONDARY │    │
│  │  (small)   │  │  (small)   │  │  (small)   │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Hierarchy Guidelines

1. **Hero Metrics** (large)
   - Primary KPIs that are the main focus
   - Maximum 3 per dashboard row
   - Use for: Total Revenue, Active Users, Compliance Score

2. **Primary Metrics** (medium)
   - Secondary important metrics
   - 3-4 per row
   - Use for: New Signups, Fees Generated, Drawdown

3. **Secondary Metrics** (small)
   - Supporting data points
   - 4-6 per row
   - Use for: Counts, minor indicators

### Color Assignment by Metric Type

| Metric Category | Recommended Variant |
|-----------------|---------------------|
| Revenue/Value | `green` |
| Growth/Change | `teal` |
| Compliance/Score | `purple` |
| Users/Count | `blue` |
| Warnings | `orange` |
| Neutral/Other | `neutral` |

---

## Layout Guidelines

### Grid Configuration

```css
/* 4-column grid for primary/hero metrics */
.kpiGrid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.5rem;
}

/* 2-column for medium screens */
@media (max-width: 1024px) {
  .kpiGrid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Single column for mobile */
@media (max-width: 640px) {
  .kpiGrid {
    grid-template-columns: 1fr;
  }
}
```

### Spacing Rules

- **Gap between cards**: `1.5rem` (desktop), `1rem` (mobile)
- **Card padding**: Varies by size (see Size Options)
- **Section margin**: `2rem` between metric groups

### Alignment

- Values: Left-aligned within card
- Deltas: Right-aligned next to value
- Labels: Top of card, above value

---

## Accessibility

### ARIA Attributes

- `aria-label`: Auto-generated as `${label}: ${formattedValue}`
- Can be overridden via `ariaLabel` prop

### Keyboard Navigation

- Cards with `onClick` are focusable
- Enter key triggers click handler
- Tab order follows document flow

### Screen Reader Considerations

- Delta values announced with direction
- Loading state includes message
- Error state includes retry action

---

## Usage Examples

### Example 1: Revenue Dashboard

```tsx
import { KPICard } from '@/components/KPICard';

function RevenueDashboard() {
  return (
    <div className="kpiGrid">
      <KPICard
        label="Total Revenue"
        value={1250000}
        format="currency"
        variant="green"
        size="large"
        delta={{ value: 12.5, direction: 'up', period: 'vs last month' }}
      />
      <KPICard
        label="Active Commitments"
        value={342}
        format="count"
        variant="teal"
        size="large"
      />
      <KPICard
        label="Compliance Score"
        value={94.2}
        format="percentage"
        variant="purple"
        size="large"
        delta={{ value: 2.1, direction: 'up' }}
      />
    </div>
  );
}
```

### Example 2: Loading State

```tsx
<KPICard
  label="Pending Transactions"
  state="loading"
  loadingMessage="Fetching transactions..."
  variant="orange"
/>
```

### Example 3: Error with Retry

```tsx
<KPICard
  label="Network Volume"
  state="error"
  errorMessage="Failed to load network data"
  onRetry={refetchNetworkVolume}
  variant="blue"
/>
```

### Example 4: Auto Delta Calculation

```tsx
<KPICard
  label="Monthly Active Users"
  value={5420}
  previousValue={4890}
  format="count"
  variant="teal"
/>
// Automatically shows +10.8% delta
```

---

## Props Reference

| Prop | Type | Default | Required |
|------|------|---------|----------|
| `label` | `string` | - | Yes |
| `value` | `string \| number` | - | No |
| `previousValue` | `string \| number` | - | No |
| `variant` | `'teal' \| 'green' \| 'blue' \| 'purple' \| 'orange' \| 'neutral'` | `'teal'` | No |
| `size` | `'small' \| 'medium' \| 'large'` | `'medium'` | No |
| `icon` | `LucideIcon` | - | No |
| `delta` | `KPIDelta` | - | No |
| `state` | `'default' \| 'loading' \| 'error' \| 'empty'` | `'default'` | No |
| `loadingMessage` | `string` | `'Loading metrics...'` | No |
| `errorMessage` | `string` | `'Failed to load'` | No |
| `format` | `'value' \| 'percentage' \| 'currency' \| 'count' \| 'score'` | `'value'` | No |
| `unit` | `string` | - | No |
| `decimals` | `number` | `0` | No |
| `description` | `string` | - | No |
| `tooltip` | `string` | - | No |
| `onRetry` | `() => void` | - | No |
| `onClick` | `() => void` | - | No |
| `ariaLabel` | `string` | - | No |

---

## Changelog

- **v1.0.0** (Initial release): KPI Card component with loading/error states, delta indicators, and formatting utilities