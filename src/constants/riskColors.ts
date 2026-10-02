/**
 * Canonical color palette tokens for Commitment risk levels across the application.
 */

export const RISK_COLORS = {
  Safe: '#00C950',
  Balanced: '#51A2FF',
  Aggressive: '#FF8904',
} as const;

export type RiskColorType = keyof typeof RISK_COLORS;

export const RISK_COLOR_CLASSES: Record<RiskColorType, string> = {
  Safe: 'text-[#00C950]',
  Balanced: 'text-[#51A2FF]',
  Aggressive: 'text-[#FF8904]',
};
