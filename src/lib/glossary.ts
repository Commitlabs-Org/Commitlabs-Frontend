/**
 * CommitLabs Glossary
 *
 * Centralised glossary of domain-specific terms used throughout the UI.
 * Each entry maps a case-insensitive key to a human-readable term and its definition.
 */

export interface GlossaryEntry {
  term: string
  definition: string
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  'penalty bps': {
    term: 'Penalty (BPS)',
    definition:
      'The fee, expressed in basis points (1 bps = 0.01 %), charged when a commitment is exited before its scheduled maturity date.',
  },
  'compliance score': {
    term: 'Compliance Score',
    definition:
      'A 0–100 metric reflecting how closely the commitment adheres to its on-chain risk and collateralisation rules. Higher scores indicate stronger compliance.',
  },
  drawdown: {
    term: 'Drawdown',
    definition:
      'The decline in the commitment’s value from its all-time peak, expressed as a percentage. Used to gauge maximum historical loss.',
  },
  attestation: {
    term: 'Attestation',
    definition:
      'An on-chain verification performed by trusted validators confirming that a commitment’s parameters and collateral are accurate at a point in time.',
  },
  'early exit': {
    term: 'Early Exit',
    definition:
      'Withdrawing a commitment before its scheduled maturity. Early exits incur a penalty proportional to the remaining duration.',
  },
  'max loss threshold': {
    term: 'Max Loss Threshold',
    definition:
      'The maximum percentage loss you will accept on the committed position. When the loss reaches this threshold the position is automatically closed on-chain to prevent further drawdown.',
  },
}
