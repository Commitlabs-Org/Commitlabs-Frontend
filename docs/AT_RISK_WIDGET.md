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

---

## Configurable Thresholds (issue #957)

Users can now tune the sensitivity of the at-risk widget without code changes. See `docs/AT_RISK_THRESHOLDS.md` for the full feature reference.

### Quick summary

| Threshold | Default | Valid range |
|---|---|---|
| `complianceScoreThreshold` | `70` | `0` – `100` |
| `daysRemainingThreshold` | `7` | `0` – `365` |

Clicking **Configure Thresholds** in the widget header reveals the threshold controls. Changes are applied immediately and re-filter the list. A warning toast fires once when a commitment newly enters at-risk status (deduped so it does not repeat for already-known items).
