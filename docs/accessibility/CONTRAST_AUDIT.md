# Color-Contrast Audit — Dark Theme (WCAG AA)

Audit date: 2026-06-27  
Base surface: `#0a0a0a` (luminance 0.0030)  
AA thresholds: **4.5:1** normal text, **3.0:1** large text / graphical objects.

---

## Summary of changes

| Token / usage | Before | Ratio | After | Ratio | Result |
| :--- | :--- | ---: | :--- | ---: | :---: |
| Chart axis ticks, inactive tabs, asset labels | `#666` | 3.45:1 | `#8892a0` | 6.29:1 | ✅ |
| KPI card muted text (descriptions, tooltips, loading messages) | `#64748b` | 4.16:1 | `#808b9e` | 5.76:1 | ✅ |
| Muted text on card bg (`#111`) | `#64748b` over `#111` | 3.96:1 | `#808b9e` over `#111` | 5.49:1 | ✅ |
| Muted text on tooltip bg (`#1a1a1a`) | `#64748b` over `#1a1a1a` | 3.66:1 | `#808b9e` over `#1a1a1a` | 5.06:1 | ✅ |
| Drawdown tooltip value text | `#DC2626` over `#1a1a1a` | 3.61:1 | `#f87171` over `#1a1a1a` | 6.30:1 | ✅ |
| TrustBadge “Self-Reported” text | `text-white/40` (~`#6c6c6c`) | 3.45:1 | `text-white/60` (~`#9d9d9d`) | 6.67:1 | ✅ |

---

## Audit detail

### Chart axis ticks (`#666` on `#0a0a0a` — 3.45:1 ❌)

Used in all four health-metric charts for `XAxis` / `YAxis` stroke, tick fill, and tab labels.

**Fix:** `#666` → `#8892a0` (6.29:1).  
**Files:** `HealthMetricsValueHistoryChart.tsx`, `HealthMetricsDrawdownChart.tsx`, `HealthMetricsFeeGenerationChart.tsx`, `HealthMetricsComplianceChart.tsx`, `CommitmentHealthMetrics.tsx`, `MyCommitmentCard.tsx`.

### KPI card muted text (`#64748b` on various surfaces — 3.66–4.16:1 ❌)

Used in `.tooltip`, `.description`, `.loadingMessage`, `.emptyMessage`.

| Surface | Before | After |
| :--- | ---: | ---: |
| `#0a0a0a` (card bg) | 4.16:1 | 5.76:1 |
| `#111` (sibling card bg) | 3.96:1 | 5.49:1 |
| `#1a1a1a` (tooltip bg) | 3.66:1 | 5.06:1 |

**Fix:** `#64748b` → `#808b9e`.  
**File:** `KPICard.module.css`.

### Drawdown chart tooltip value (`#DC2626` on `#1a1a1a` — 3.61:1 ❌)

The `CustomTooltip` in the Drawdown chart renders the drawdown percentage in `#DC2626` (red-500) against the `#1a1a1a` tooltip background.

**Fix:** `#DC2626` → `#f87171` (6.30:1).  
**File:** `HealthMetricsDrawdownChart.tsx`.

### TrustBadge “Self-Reported” state (`text-white/40` — 3.45:1 ❌)

The unverified badge uses `text-white/40` on `bg-white/5` over `#0a0a0a`, producing an effective text color of ~`#6c6c6c` — below AA.

**Fix:** `text-white/40` → `text-white/60` (6.67:1).  
**File:** `TrustBadge.tsx`.

---

## Passing colors (no change needed)

| Color | Usage | Ratio on `#0a0a0a` |
| :--- | :--- | ---: |
| `#ffffff` | Primary headings, body text | 19.5:1 |
| `#99a1af` | KPI labels, chart descriptions | 7.38:1 |
| `#94a3b8` | Secondary labels (MyCommitmentCard) | 7.48:1 |
| `rgba(255,255,255,0.5)` | Delta period text (KPICard) | 5.30:1 |
| `#0ff0fc` | Accent cyan highlights, chart line | 12.8:1 |
| `#4ADE80` | Compliance chart line | 9.81:1 |
| `#DC2626` | Drawdown chart line / area (graphical) | 3.91:1 (passes 3:1 graphical) |
| `#ef4444` | Delta negative, status chips | 5.26:1 |
| `#05DF72` | Status badges (active) | 11.0:1 |
| `#51a2ff` | Status badges (settled) | 8.11:1 |
| `#ff8904` | Status badges (early exit) | 7.92:1 |

---

## Methodology

Contrast ratios computed per [WCAG 2.1](https://www.w3.org/TR/WCAG21/) relative-luminance formula.  
All ratios verified against the darkest surface they appear on (`#0a0a0a`, `#111`, or `#1a1a1a`).
