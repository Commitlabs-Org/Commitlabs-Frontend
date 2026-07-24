# Glossary

This document outlines the standard protocol terminology used across the application. 
By maintaining a single source of truth, we ensure consistency in the UI and documentation.

## Defined Terms

- **Penalty Bps**: Penalty Basis Points. A percentage (1 basis point = 0.01%) deducted from the staked amount upon early exit or violation.
- **Compliance Score**: A metric representing the historical reliability and adherence to commitment rules.
- **Drawdown**: The peak-to-trough decline during a specific period for an investment or fund.
- **Attestation**: A cryptographically signed verification that a specific event or constraint violation occurred on-chain.
- **Early Exit**: Terminating a commitment before its scheduled duration completes, usually incurring a penalty.

## Usage in UI
The terms above should be wrapped in the `<GlossaryTerm>` component whenever they appear in key creation or detail contexts, so users can learn the protocol without leaving the flow.
