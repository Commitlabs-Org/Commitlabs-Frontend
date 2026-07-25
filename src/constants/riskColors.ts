export const RISK_COLORS = {
  Safe: '#00C950',
  Balanced: '#51A2FF',
  Aggressive: '#FF8904',
} as const;

export type RiskType = keyof typeof RISK_COLORS;
