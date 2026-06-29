export interface GlossaryDefinition {
  term: string;
  definition: string;
}

export const glossary: Record<string, GlossaryDefinition> = {
  "penalty bps": {
    term: "Penalty Bps",
    definition: "Penalty Basis Points. A percentage (1 basis point = 0.01%) deducted from the staked amount upon early exit or violation.",
  },
  "compliance score": {
    term: "Compliance Score",
    definition: "A metric representing the historical reliability and adherence to commitment rules.",
  },
  "drawdown": {
    term: "Drawdown",
    definition: "The peak-to-trough decline during a specific period for an investment or fund.",
  },
  "attestation": {
    term: "Attestation",
    definition: "A cryptographically signed verification that a specific event or constraint violation occurred on-chain.",
  },
  "early exit": {
    term: "Early Exit",
    definition: "Terminating a commitment before its scheduled duration completes, usually incurring a penalty.",
  },
};
