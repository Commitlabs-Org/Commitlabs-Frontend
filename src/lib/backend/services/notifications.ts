import { getMockData } from '@/lib/backend/mockDb';
import type { Notification, Commitment, Attestation } from '@/lib/types/domain';
// import { getUserCommitmentsFromChain } from './contracts'; // TODO: migration path

export async function getUserNotifications(ownerAddress: string): Promise<Notification[]> {
  // TODO: Migration path to use real contracts and indexer APIs
  // 1. Fetch commitments from chain using `getUserCommitmentsFromChain(ownerAddress)`
  // 2. Fetch attestations from indexer API related to those commitments
  // For now, we use mockDb.

  const mockData = await getMockData();
  
  // In a real environment, we'd only filter by commitments owned by the user.
  // The mock-db doesn't store ownerAddress on commitments natively, so we'll pretend
  // they belong to the requested ownerAddress or we'd filter if it exists.
  const userCommitments = mockData.commitments.filter((c) => {
    const commitmentAny = c as any;
    return !commitmentAny.ownerAddress || commitmentAny.ownerAddress === ownerAddress;
  });

  const commitmentIds = new Set(userCommitments.map((c) => c.id));
  const userAttestations = mockData.attestations.filter((a) => commitmentIds.has(a.commitmentId));

  const notifications: Notification[] = [];

  // Derive notifications from commitments
  for (const c of userCommitments) {
    // Check for expiry within 7 days
    if (c.daysRemaining !== undefined && c.daysRemaining <= 7 && c.status === 'Active') {
      notifications.push({
        id: crypto.randomUUID(),
        ownerAddress,
        title: 'Commitment Nearing Expiry',
        message: `Your commitment ${c.id} for ${c.asset} expires in ${c.daysRemaining} days.`,
        severity: 'warning',
        type: 'expiry',
        read: false,
        createdAt: new Date().toISOString(),
        relatedCommitmentId: c.id,
      });
    }

    // Check for violation
    if (c.status === 'Violated') {
      notifications.push({
        id: crypto.randomUUID(),
        ownerAddress,
        title: 'Commitment Violated',
        message: `Your commitment ${c.id} has been marked as violated.`,
        severity: 'critical',
        type: 'violation',
        read: false,
        createdAt: new Date().toISOString(),
        relatedCommitmentId: c.id,
      });
    }
  }

  // Derive notifications from attestations
  for (const a of userAttestations) {
    if (a.severity === 'violation' || a.verdict === 'fail' || (a as any).status === 'Violated' || (a as any).status === 'Invalid') {
      notifications.push({
        id: crypto.randomUUID(),
        ownerAddress,
        title: 'Attestation Failure',
        message: `A recent attestation for your commitment ${a.commitmentId} failed.`,
        severity: 'critical',
        type: 'violation',
        read: false,
        createdAt: a.observedAt || (a as any).timestamp || new Date().toISOString(),
        relatedCommitmentId: a.commitmentId,
      });
    } else if (a.severity === 'warning') {
      notifications.push({
        id: crypto.randomUUID(),
        ownerAddress,
        title: 'Attestation Warning',
        message: `A recent attestation for your commitment ${a.commitmentId} issued a warning.`,
        severity: 'warning',
        type: 'health_check',
        read: false,
        createdAt: a.observedAt || (a as any).timestamp || new Date().toISOString(),
        relatedCommitmentId: a.commitmentId,
      });
    }
  }

  // Sort by createdAt descending
  notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return notifications;
}
