import { Commitment } from '@/lib/types/domain';
import { ProtocolConstants } from '@/utils/protocol';

export type RiskCategory = 'low_compliance' | 'maturing_soon' | 'action_required';

export interface AtRiskCommitment extends Commitment {
  riskCategories: RiskCategory[];
}

export function classifyAtRiskCommitments(
  commitments: Commitment[],
  constants: ProtocolConstants | null
): AtRiskCommitment[] {
  return commitments
    .map((c) => {
      const riskCategories: RiskCategory[] = [];
      
      if (c.complianceScore !== undefined && c.complianceScore < 70) {
        riskCategories.push('low_compliance');
      }
      
      if (c.daysRemaining !== undefined && c.daysRemaining <= 7) {
        riskCategories.push('maturing_soon');
      }
      
      if (c.status === 'Violated') {
        riskCategories.push('action_required');
      }

      // If maxLoss is exceeded or getting close
      if (c.currentDrawdown && c.maxLoss) {
        const drawdown = parseFloat(c.currentDrawdown);
        const maxLoss = parseFloat(c.maxLoss);
        if (!isNaN(drawdown) && !isNaN(maxLoss) && drawdown >= maxLoss * 0.8) {
           riskCategories.push('action_required');
        }
      }

      return { ...c, riskCategories };
    })
    .filter((c) => c.riskCategories.length > 0);
}
