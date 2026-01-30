export type CommitmentType = 'Safe' | 'Balanced' | 'Aggressive';
export type CommitmentStatus = 'Active' | 'Settled' | 'Violated' | 'Early Exit';

export interface Commitment {
  id: string;
  type: CommitmentType;
  status: CommitmentStatus;
  asset: string;
  amount: string;
  currentValue: string;
  changePercent: number;
  durationProgress: number; // 0-100
  daysRemaining: number;
  complianceScore: number; // 0-100
  maxLoss: string;
  currentDrawdown: string;
  createdDate: string;
  expiryDate: string;
}

export interface CommitmentStats {
  totalActive: number;
  totalCommittedValue: string;
  avgComplianceScore: number;
  totalFeesGenerated: string;
}
