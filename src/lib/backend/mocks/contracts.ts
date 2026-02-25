import { Commitment } from '@/types/commitment';

// Mock data
const mockCommitments: Commitment[] = [
  {
    id: '001',
    type: 'Safe',
    status: 'Active',
    asset: 'USDC',
    amount: '1000',
    currentValue: '1050',
    changePercent: 5.0,
    durationProgress: 50,
    daysRemaining: 15,
    complianceScore: 100,
    maxLoss: '2%',
    currentDrawdown: '0%',
    createdDate: '2023-01-01',
    expiryDate: '2023-02-01',
  },
  {
    id: '002',
    type: 'Balanced',
    status: 'Active',
    asset: 'ETH',
    amount: '5000',
    currentValue: '5200',
    changePercent: 4.0,
    durationProgress: 25,
    daysRemaining: 45,
    complianceScore: 90,
    maxLoss: '10%',
    currentDrawdown: '2%',
    createdDate: '2023-01-15',
    expiryDate: '2023-03-15',
  },
];

export async function createCommitment(commitment: Partial<Commitment>): Promise<Commitment> {
  const newCommitment: Commitment = {
    id: Math.random().toString(36).substring(7),
    type: commitment.type || 'Safe',
    status: 'Active',
    asset: commitment.asset || 'USDC',
    amount: commitment.amount || '0',
    currentValue: commitment.amount || '0',
    changePercent: 0,
    durationProgress: 0,
    daysRemaining: 30,
    complianceScore: 100,
    maxLoss: commitment.maxLoss || '0%',
    currentDrawdown: '0%',
    createdDate: new Date().toISOString(),
    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    ...commitment,
  };
  mockCommitments.push(newCommitment);
  return newCommitment;
}

export async function listCommitments(): Promise<Commitment[]> {
  return mockCommitments;
}

export async function getCommitment(id: string): Promise<Commitment | undefined> {
  return mockCommitments.find(c => c.id === id);
}
