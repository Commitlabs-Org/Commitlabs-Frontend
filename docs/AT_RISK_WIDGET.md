# At-Risk Commitments Widget

The At-Risk Commitments widget (`AtRiskCommitments.tsx`) is designed to surface commitments that need immediate attention from the user. It helps users quickly identify problem areas without scanning through every card on the overview page.

## Risk Classifications
Commitments are evaluated against the following criteria to determine if they are "at-risk":
- **Low Compliance**: Compliance score falls below 70.
- **Maturing Soon**: The commitment has 7 or fewer days remaining until maturity.
- **Action Required**: The commitment status is currently set to `Violated`, or its current drawdown has reached or exceeded 80% of its maximum allowed loss.

## Implementation Details
- Located in `src/components/dashboard/AtRiskCommitments.tsx`.
- The `classifyAtRiskCommitments` utility in `src/utils/classification.ts` performs the classification logic.
- It accepts a list of commitments and fetches the latest protocol constants for dynamic threshold evaluation where applicable.
- If no commitments are at risk, a reassuring "All Commitments Healthy" state is displayed.
- The widget lists the specific risk categories triggered and provides a deep link directly to the commitment detail page.
