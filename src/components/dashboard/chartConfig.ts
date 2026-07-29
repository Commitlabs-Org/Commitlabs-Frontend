/**
 * Shared, stable Recharts configuration for Health Metrics charts.
 *
 * Inline axis / tooltip / series objects defeat React.memo and force Recharts to
 * reconcile on every parent render. Keep shared props here as module-level
 * constants (or memoize per-chart overrides with useMemo / useCallback).
 */

export const CHART_COLORS = {
  teal: '#0ff0fc',
  muted: '#8892a0',
  mutedText: '#99a1af',
  red: '#DC2626',
  redSoft: '#f87171',
  green: '#4ADE80',
  amber: '#F59E0B',
  benchmark: '#f5a623',
  grid: '#333',
  surface: '#111',
  border: '#222',
  tooltipBg: '#1a1a1a',
} as const;

export const CHART_TICK = {
  fill: CHART_COLORS.muted,
  fontSize: 12,
} as const;

/** Shared CartesianGrid props — stable reference across charts. */
export const CHART_GRID_PROPS = {
  strokeDasharray: '3 3',
  stroke: CHART_COLORS.grid,
  vertical: false,
} as const;

/** Shared XAxis props for date-keyed health metrics series. */
export const CHART_X_AXIS_PROPS = {
  dataKey: 'date',
  stroke: CHART_COLORS.muted,
  tick: CHART_TICK,
  tickLine: false,
  axisLine: false,
  dy: 10,
} as const;

/** Shared YAxis chrome (domain / tickFormatter set per chart). */
export const CHART_Y_AXIS_PROPS = {
  stroke: CHART_COLORS.muted,
  tick: CHART_TICK,
  tickLine: false,
  axisLine: false,
} as const;

export const CHART_TOOLTIP_CURSOR_LINE = {
  stroke: CHART_COLORS.grid,
} as const;

export const CHART_TOOLTIP_CURSOR_BAR = {
  fill: 'rgba(255, 255, 255, 0.03)',
} as const;

export const CHART_MARGIN_DEFAULT = {
  top: 10,
  right: 10,
  left: -10,
  bottom: 0,
} as const;

export const CHART_MARGIN_COMPACT = {
  top: 10,
  right: 10,
  left: -20,
  bottom: 0,
} as const;

export const CHART_LEGEND_LAYOUT = {
  verticalAlign: 'bottom' as const,
  height: 36,
};

export const CHART_DOT = {
  r: 4,
  stroke: CHART_COLORS.surface,
  strokeWidth: 2,
} as const;

export const CHART_ACTIVE_DOT_R = 6;

export const LIFECYCLE_REF_LINE = {
  strokeWidth: 1.5,
  strokeDasharray: '4 3',
  defaultColor: CHART_COLORS.amber,
  labelFontSize: 10,
} as const;

/** Locale number formatter for value axes / tooltips — module-stable. */
export function formatLocaleNumber(value: number): string {
  return value.toLocaleString();
}

/** Percent formatter for 0–1 drawdown domains. */
export function formatDrawdownAxisTick(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

/** Plain numeric tick (fee axis). */
export function formatPlainNumberTick(value: number): string {
  return `${value}`;
}
