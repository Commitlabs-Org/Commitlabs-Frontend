# Seller Trust & Verification UX Patterns

## Core Principles
1. **Clarity over Flashiness**: Trust badges should be informative, not just decorative.
2. **Explicit Labeling**: Always distinguish between platform-verified data and user-reported data.
3. **No Hidden Logic**: Users should be able to hover/click any trust indicator to see exactly what it means.
4. **Contextual Trust**: Show trust signals where they matter most (near the "Buy/Trade" action).

## Trust Levels

### 1. Verified Seller (`verified`)
- **Visual**: Solid green badge with checkmark.
- **Criteria**: 
    - Completed KYC/KYB.
    - Linked and verified official social/web presence.
    - Minimum of 10 successful commitments with 0 defaults.
- **Copy**: "Identity and historical performance have been verified by Commitlabs."

### 2. Reputable Seller (`reputable`)
- **Visual**: Solid blue badge with checkmark.
- **Criteria**:
    - High success rate (>95%).
    - At least 6 months active on the platform.
    - Positive community attestation score.
- **Copy**: "Seller has a high successful commitment rate and positive community feedback."

### 3. Self-Reported (`unverified`)
- **Visual**: Ghost/Gray badge with alert icon.
- **Criteria**: Default for new or unverified accounts.
- **Copy**: "This seller has not yet completed the verification process. Exercise caution."

## Reputation Metrics
- **Score (0-100)**: A weighted average of success rates, volume, and tenure.
- **Track Record**: Raw count of commitments to show experience.
- **Reliability %**: The percentage of commitments that reached maturity without default or early exit (unless permitted).

## Disclaimers & Disclosures
- Every trust indicator must include a link to the "Trust Methodology" documentation.
- The following disclosure must be present on all listing detail pages:
    > "Verification indicators are based on historical platform data and external identity checks. They do not constitute financial advice or a guarantee of future performance."

## UI Placement Rules
- **Listing Cards**: Small `TrustBadge` next to the owner address/name.
- **Listing Details**: Full `ReputationDisplay` in the sidebar or header, plus a "Verification Details" section.
- **Checkout**: A final "Trust Summary" before confirming a trade.
