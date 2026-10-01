import { Commitment } from '@/lib/types/domain';
import type { ProtocolConstants } from '@/utils/protocol';

export type RiskCategory = 'low_compliance' | 'maturing_soon' | 'action_required';

export interface AtRiskCommitment extends Commitment {
  riskCategories: RiskCategory[];
}

export interface ClassificationThresholds {
  complianceScoreThreshold?: number;
  daysRemainingThreshold?: number;
}

const DEFAULT_COMPLIANCE_THRESHOLD = 70;
const DEFAULT_DAYS_THRESHOLD = 7;

/**
 * Evaluates commitments against risk criteria and assigns deduplicated risk categories.
 *
 * Risk categories include:
 * - 'low_compliance': Compliance score falls below the configured threshold (default: 70).
 * - 'maturing_soon': Days remaining until expiration is less than or equal to the threshold (default: 7).
 * - 'action_required': Commitment is Violated or current drawdown meets/exceeds 80% of maxLoss.
 *
 * Ensures riskCategories contains no duplicates even when multiple criteria trigger the same category.
 *
 * @param commitments - The array of commitments to evaluate.
 * @param constants - Protocol constants configuration, or null if unconfigured.
 * @param thresholds - Optional custom thresholds for compliance score and days remaining.
 * @returns Array of at-risk commitments with unique risk categories, filtering out commitments with no risk.
 */
export function classifyAtRiskCommitments(
  commitments: Commitment[],
  constants: ProtocolConstants | null,
  thresholds?: ClassificationThresholds,
): AtRiskCommitment[] {
  const complianceThreshold = thresholds?.complianceScoreThreshold ?? DEFAULT_COMPLIANCE_THRESHOLD;
  const daysThreshold = thresholds?.daysRemainingThreshold ?? DEFAULT_DAYS_THRESHOLD;

  return commitments
    .map((c) => {
      const riskCategories = new Set<RiskCategory>();

      if (c.complianceScore !== undefined && c.complianceScore < complianceThreshold) {
        riskCategories.add('low_compliance');
      }

      if (c.daysRemaining !== undefined && c.daysRemaining <= daysThreshold) {
        riskCategories.add('maturing_soon');
      }

      if (c.status === 'Violated') {
        riskCategories.add('action_required');
      }

      if (c.currentDrawdown && c.maxLoss) {
        const drawdown = parseFloat(c.currentDrawdown);
        const maxLoss = parseFloat(c.maxLoss);
        if (!isNaN(drawdown) && !isNaN(maxLoss) && drawdown >= maxLoss * 0.8) {
          riskCategories.add('action_required');
        }
      }

      return { ...c, riskCategories: Array.from(riskCategories) };
    })
    .filter((c) => c.riskCategories.length > 0);
}
