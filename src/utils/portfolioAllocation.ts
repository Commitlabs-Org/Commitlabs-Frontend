import { Commitment } from '@/lib/types/domain';

export interface AllocationSlice {
  name: string;
  value: number;
  color: string;
}

const RISK_COLORS: Record<string, string> = {
  Safe: '#0ff0fc',
  Balanced: '#3b82f6',
  Aggressive: '#f59e0b',
};

const ASSET_PALETTE = [
  '#0ff0fc',
  '#3b82f6',
  '#f59e0b',
  '#4ADE80',
  '#DC2626',
  '#a78bfa',
  '#f472b6',
  '#34d399',
  '#fb923c',
  '#22d3ee',
];

/**
 * Aggregates commitments by risk profile type and sums their allocated amounts.
 * Unrecognized risk profile names and missing types default to fallback color #666.
 *
 * @param commitments - List of commitments to aggregate
 * @returns Array of allocation slices grouped by risk profile
 */
export function aggregateByRiskProfile(commitments: Commitment[]): AllocationSlice[] {
  const groups: Record<string, number> = {};
  for (const c of commitments) {
    const type = c.type || 'Unknown';
    const amount = parseFloat(c.amount) || 0;
    groups[type] = (groups[type] || 0) + amount;
  }
  return Object.entries(groups).map(([name, value]) => ({
    name,
    value,
    color: RISK_COLORS[name] ?? '#666',
  }));
}

/**
 * Aggregates commitments by asset and sums their allocated amounts.
 * Missing assets default to 'Unknown', and colors cycle through the asset palette.
 *
 * @param commitments - List of commitments to aggregate
 * @returns Array of allocation slices grouped by asset
 */
export function aggregateByAsset(commitments: Commitment[]): AllocationSlice[] {
  const groups: Record<string, number> = {};
  for (const c of commitments) {
    const asset = c.asset || 'Unknown';
    const amount = parseFloat(c.amount) || 0;
    groups[asset] = (groups[asset] || 0) + amount;
  }
  let i = 0;
  return Object.entries(groups).map(([name, value]) => ({
    name,
    value,
    color: ASSET_PALETTE[i++ % ASSET_PALETTE.length],
  }));
}

/**
 * Formats a numeric allocation value into a locale string with up to two decimal places.
 *
 * @param value - The numeric value to format
 * @returns The formatted string
 */
export function formatAllocationValue(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
