# Design Tokens

This document outlines the CSS variables used across the application to maintain a consistent visual language, support theming, and provide a unified source of truth for our styling. All tokens are defined in `src/app/globals.css` under the `:root` pseudo-class.

## Surfaces

Surface tokens are used for the background of the app, containers, cards, and overlays.

| Token | CSS Variable | Value | Description |
|---|---|---|---|
| Primary Surface | `--surface-primary` | `#0a0a0a` | The main background of the application. |
| Secondary Surface | `--surface-secondary` | `rgba(15, 23, 42, 0.5)` | Secondary blocks, feature cards, and subtle background highlights. |
| Secondary Surface (Hover) | `--surface-secondary-hover` | `rgba(15, 23, 42, 0.8)` | Hover states for secondary surface elements. |

## Text

Text tokens govern the typography colors.

| Token | CSS Variable | Value | Description |
|---|---|---|---|
| Primary Text | `--text-primary` | `#ffffff` | High-emphasis text such as headings and core content. |
| Secondary Text | `--text-secondary` | `#94a3b8` | Medium-emphasis text such as descriptions and subtitles. |
| Muted Text | `--text-muted` | `#64748b` | Low-emphasis text such as tooltips, small text, and empty state messages. |

## Accents

Accent tokens are the brand and semantic colors used to highlight states, KPIs, icons, and focus rings. 

*Note: For instances where you need an accent color with opacity (e.g. glows, shadows, overlays), use the `-rgb` counterpart with `rgba()`. For example: `rgba(var(--accent-teal-rgb), 0.2)`.*

| Token | CSS Variable | RGB Variable | Value | Description |
|---|---|---|---|---|
| Teal (Brand Primary) | `--accent-teal` | `--accent-teal-rgb` | `#0ff0fc` | Brand color, main interactive states, focus rings. |
| Green (Success) | `--accent-green` | `--accent-green-rgb` | `#00ff7a` | Positive deltas, success states. |
| Blue | `--accent-blue` | *N/A* | `#3b82f6` | Alternative accent for KPI cards and data visualization. |
| Purple | `--accent-purple` | *N/A* | `#a855f7` | Alternative accent for KPI cards and data visualization. |
| Orange | `--accent-orange` | *N/A* | `#f97316` | Alternative accent for KPI cards and data visualization. |
| Neutral | `--accent-neutral` | *N/A* | `#94a3b8` | Neutral/inactive states or default KPI styles. |
| Danger (Error) | `--accent-danger` | `--accent-danger-rgb` | `#ef4444` | Negative deltas, error states, and destructive actions. |

## Borders

Tokens used for borders and subtle dividers.

| Token | CSS Variable | Value | Description |
|---|---|---|---|
| Subtle Border | `--border-subtle` | `rgba(255, 255, 255, 0.1)` | Default border for cards and containers. |
| Teal Border | `--border-teal` | `rgba(94, 234, 212, 0.1)` | Subtle brand border used in landing sections. |

## Focus States

Focus rings ensure accessible keyboard navigation. These are mostly managed via the `focus-visible` pseudo-class and utility classes.

- `--focus-ring-color`: Re-uses `var(--accent-teal)`
- `--focus-ring-width`: `2px`
- `--focus-ring-offset`: `2px`
- `--focus-ring-shadow`: Uses `rgba(var(--accent-teal-rgb), 0.22)`
- `--focus-ring-z-index`: `4`
