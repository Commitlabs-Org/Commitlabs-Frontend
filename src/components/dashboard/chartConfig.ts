/**
 * Shared, stable Recharts configuration for Health Metrics charts.
 *
 * Inline axis / tooltip / series objects defeat React.memo and force Recharts to
 * reconcile on every parent render. Keep shared props here as module-level
 * constants (or memoize per-chart overrides with useMemo / useCallback).
 *
 * Only canonical, validated metric names are trusted at the UI boundary.
 */

export const CHART_METRIC_KEYS = [
  'currentValue',
  'initialAmount',
  'benchmarkValue',
  'drawdownPercent',
  'feeAmount',
  'complianceScore',
] as const;

export type ChartMetricKey = (typeof CHART_METRIC_KEYS)[number];

export type ChartBoundaryErrorCode =
  | 'INVALID_METRIC'
  | 'INVALID_NUMERIC'
  | 'DISCONNECTED_WALLET'
  | 'WRONG_NETWORK'
  | 'TAMPERED_OWNERSHIP'
  | 'REPLAYED_REQUEST'
  | 'MALFORMED_RESPONSE';

export type ChartBoundaryDecision =
  | {
      ok: true;
      metric: ChartMetricKey;
      value: number;
      auth: { address: string; networkPassphrase: string } | null;
    }
  | {
      ok: false;
      code: ChartBoundaryErrorCode;
      message: string;
      recoverable: boolean;
    };

const CANONICAL_METRIC_MAP = new Map<string, ChartMetricKey>([
  ['currentvalue', 'currentValue'],
  ['initialamount', 'initialAmount'],
  ['benchmarkvalue', 'benchmarkValue'],
  ['drawdownpercent', 'drawdownPercent'],
  ['feeamount', 'feeAmount'],
  ['compliancescore', 'complianceScore'],
  ['current_value', 'currentValue'],
  ['initial_amount', 'initialAmount'],
  ['benchmark_value', 'benchmarkValue'],
  ['drawdown_percent', 'drawdownPercent'],
  ['fee_amount', 'feeAmount'],
  ['compliance_score', 'complianceScore'],
  ['current-value', 'currentValue'],
  ['initial-amount', 'initialAmount'],
  ['benchmark-value', 'benchmarkValue'],
  ['drawdown-percent', 'drawdownPercent'],
  ['fee-amount', 'feeAmount'],
  ['compliance-score', 'complianceScore'],
  ['current value', 'currentValue'],
  ['initial amount', 'initialAmount'],
  ['benchmark value', 'benchmarkValue'],
  ['drawdown percent', 'drawdownPercent'],
  ['fee amount', 'feeAmount'],
  ['compliance score', 'complianceScore'],
]);

export function getCanonicalChartMetric(metric: unknown): ChartMetricKey | null {
  if (typeof metric !== 'string') return null;

  const trimmed = metric.trim();
  if (!trimmed) return null;

  const direct = CHART_METRIC_KEYS.find((key) => key === trimmed);
  if (direct) return direct;

  const normalized = trimmed
    .replace(/[_\-\s]+/g, '')
    .replace(/[A-Z]/g, (char) => char.toLowerCase());

  return CANONICAL_METRIC_MAP.get(normalized) ?? null;
}

export function sanitizeChartSeries<T extends Record<string, unknown>>(
  values: T[] | null | undefined,
  metric: unknown,
): T[] {
  const canonicalMetric = getCanonicalChartMetric(metric);
  if (!canonicalMetric || !Array.isArray(values)) return [];

  return values.filter((point): point is T => {
    if (!point || typeof point !== 'object' || Array.isArray(point)) return false;

    const dateValue = (point as Record<string, unknown>).date;
    if (typeof dateValue !== 'string' || !dateValue.trim()) return false;

    const numericValue = (point as Record<string, unknown>)[canonicalMetric];
    if (typeof numericValue !== 'number' || !Number.isFinite(numericValue)) return false;

    return true;
  });
}

function failChartBoundary(
  code: ChartBoundaryErrorCode,
  message: string,
  recoverable: boolean,
): Extract<ChartBoundaryDecision, { ok: false }> {
  return { ok: false, code, message, recoverable };
}

const STELLAR_ADDRESS_PATTERN = /^G[A-Z2-7]{55}$/;
export function isValidStellarAddress(value: unknown): value is string {
  return typeof value === 'string' && STELLAR_ADDRESS_PATTERN.test(value);
}

export function evaluateChartBoundary(input: {
  metric?: unknown;
  value?: unknown;
  walletAddress?: unknown;
  connected?: boolean;
  networkPassphrase?: unknown;
  expectedNetworkPassphrase?: unknown;
  issuedAt?: unknown;
  now?: number;
  maxAgeMs?: number;
  response?: unknown;
  nonce?: unknown;
  seenNonces?: ReadonlySet<string>;
}): ChartBoundaryDecision {
  const metric = getCanonicalChartMetric(input.metric);
  if (!metric) {
    return failChartBoundary('INVALID_METRIC', 'Chart metric is missing or not recognized.', true);
  }

  let numericValue: number;
  if (typeof input.value === 'number') {
    numericValue = input.value;
  } else if (typeof input.value === 'string') {
    const trimmed = input.value.trim();
    if (!/^\d+(?:\.\d+)?$/.test(trimmed)) {
      return failChartBoundary(
        'INVALID_NUMERIC',
        'Chart value is not a safe finite numeric value.',
        true,
      );
    }
    numericValue = Number(trimmed);
  } else {
    return failChartBoundary('INVALID_NUMERIC', 'Chart value is missing or not numeric.', true);
  }

  if (!Number.isFinite(numericValue) || !Number.isSafeInteger(Math.abs(numericValue))) {
    if (Math.abs(numericValue) > Number.MAX_SAFE_INTEGER) {
      return failChartBoundary('INVALID_NUMERIC', 'Chart value exceeds safe integer bounds.', true);
    }
  }

  const walletAddress = typeof input.walletAddress === 'string' ? input.walletAddress.trim() : '';
  if (!walletAddress || !isValidStellarAddress(walletAddress)) {
    return failChartBoundary(
      'DISCONNECTED_WALLET',
      'A connected wallet with a valid address is required for chart data.',
      true,
    );
  }

  if (input.connected !== true) {
    return failChartBoundary(
      'DISCONNECTED_WALLET',
      'Wallet is disconnected. Reconnect before requesting sensitive chart data.',
      true,
    );
  }

  const network = typeof input.networkPassphrase === 'string' ? input.networkPassphrase.trim() : '';
  const expected =
    typeof input.expectedNetworkPassphrase === 'string'
      ? input.expectedNetworkPassphrase.trim()
      : '';

  if (expected && network !== expected) {
    return failChartBoundary(
      'WRONG_NETWORK',
      'Wallet is on the wrong network for this chart request.',
      true,
    );
  }

  if (!network) {
    return failChartBoundary(
      'WRONG_NETWORK',
      'Wallet network could not be verified for this chart request.',
      true,
    );
  }

  if (input.response != null) {
    if (typeof input.response !== 'object' || Array.isArray(input.response)) {
      return failChartBoundary('MALFORMED_RESPONSE', 'Chart response payload is malformed.', true);
    }

    const response = input.response as Record<string, unknown>;
    if (response.ok === false) {
      return failChartBoundary('MALFORMED_RESPONSE', 'Chart response reported failure.', true);
    }

    const owner = response.address ?? response.owner;
    if (owner != null && typeof owner === 'string' && owner !== walletAddress) {
      return failChartBoundary(
        'TAMPERED_OWNERSHIP',
        'Chart response owner does not match the connected wallet identity.',
        false,
      );
    }
  }

  const now = input.now ?? Date.now();
  const maxAge = input.maxAgeMs ?? 5 * 60 * 1000;
  if (input.issuedAt != null) {
    const issuedAt = Number(input.issuedAt);
    if (!Number.isFinite(issuedAt) || issuedAt > now + 1000) {
      return failChartBoundary(
        'REPLAYED_REQUEST',
        'Chart request timestamp is invalid or from the future.',
        false,
      );
    }
    if (now - issuedAt > maxAge) {
      return failChartBoundary('REPLAYED_REQUEST', 'Chart request has expired.', true);
    }
  }

  if (typeof input.nonce === 'string' && input.nonce && input.seenNonces?.has(input.nonce)) {
    return failChartBoundary(
      'REPLAYED_REQUEST',
      'Chart request nonce has already been used.',
      false,
    );
  }

  return {
    ok: true,
    metric,
    value: numericValue,
    auth: { address: walletAddress, networkPassphrase: network },
  };
}

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

export const CHART_LIMITS = {
  maxDataPoints: 180,
} as const;

/** Guard chart payloads from adversarial or oversized inputs before Recharts renders. */
export function normalizeChartData<T>(
  data: readonly T[] | null | undefined,
  maxPoints = CHART_LIMITS.maxDataPoints,
): T[] {
  if (!Array.isArray(data)) {
    return [];
  }

  const safeLimit = Number.isFinite(maxPoints)
    ? Math.max(0, Math.trunc(maxPoints))
    : CHART_LIMITS.maxDataPoints;
  return data.slice(0, safeLimit);
}

/** Locale number formatter for value axes / tooltips — module-stable. */
export function formatLocaleNumber(value: number): string {
  const safeValue = Number.isFinite(value) ? value : 0;
  return safeValue.toLocaleString();
}

/** Percent formatter for 0–1 drawdown domains. */
export function formatDrawdownAxisTick(value: number): string {
  const safeValue = Number.isFinite(value) ? value : 0;
  return `${(safeValue * 100).toFixed(0)}%`;
}

/** Plain numeric tick (fee axis). */
export function formatPlainNumberTick(value: number): string {
  const safeValue = Number.isFinite(value) ? value : 0;
  return `${safeValue}`;
}
