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

export function formatAllocationValue(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
