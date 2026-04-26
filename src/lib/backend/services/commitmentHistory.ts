/**
 * Commitment history service.
 *
 * Aggregates lifecycle events for a single commitment from all available
 * sources (mock DB + chain reads) and returns them in chronological order.
 *
 * Sources consulted:
 *  1. Commitment record itself  → `created` event
 *  2. Attestations in mockDb    → `attestation` events
 *  3. Commitment status         → `early_exit` / `settlement` terminal events
 *
 * When a real on-chain indexer is available, replace the mockDb reads with
 * indexed queries and remove the chain-status heuristic.
 */

import { getMockData } from '@/lib/backend/mockDb';
import type {
  HistoryEvent,
  CreatedEvent,
  AttestationEvent,
  EarlyExitEvent,
  SettlementEvent,
} from '@/lib/types/domain';
import type { ChainCommitment } from '@/lib/backend/services/contracts';

// ---------------------------------------------------------------------------
// Event builders
// ---------------------------------------------------------------------------

function buildCreatedEvent(commitment: ChainCommitment): CreatedEvent {
  return {
    eventId: `created:${commitment.id}`,
    kind: 'created',
    occurredAt: commitment.createdAt ?? new Date(0).toISOString(),
    payload: {
      asset: commitment.asset,
      amount: commitment.amount,
      expiresAt: commitment.expiresAt,
    },
  };
}

function buildAttestationEvents(
  commitmentId: string,
  attestations: Awaited<ReturnType<typeof getMockData>>['attestations'],
): AttestationEvent[] {
  return attestations
    .filter((a) => a.commitmentId === commitmentId)
    .map((a) => ({
      eventId: `attestation:${a.id}`,
      kind: 'attestation' as const,
      occurredAt: a.observedAt,
      txHash: a.txHash,
      payload: {
        attestationId: a.id,
        attestationType: a.kind ?? 'unknown',
        complianceScore:
          typeof a.details?.complianceScore === 'number'
            ? (a.details.complianceScore as number)
            : undefined,
        violation:
          typeof a.details?.violation === 'boolean'
            ? (a.details.violation as boolean)
            : undefined,
        severity: a.severity,
      },
    }));
}

function buildTerminalEvent(
  commitment: ChainCommitment,
): EarlyExitEvent | SettlementEvent | null {
  if (commitment.status === 'EARLY_EXIT') {
    const event: EarlyExitEvent = {
      eventId: `early_exit:${commitment.id}`,
      kind: 'early_exit',
      // Use expiresAt as a proxy timestamp until the indexer provides the real one
      occurredAt: commitment.expiresAt ?? new Date().toISOString(),
      payload: {
        penaltyAmount: undefined,
        exitedBy: commitment.ownerAddress,
      },
    };
    return event;
  }

  if (commitment.status === 'SETTLED') {
    const event: SettlementEvent = {
      eventId: `settlement:${commitment.id}`,
      kind: 'settlement',
      occurredAt: commitment.expiresAt ?? new Date().toISOString(),
      payload: {
        settlementAmount: commitment.feeEarned,
        finalStatus: 'SETTLED',
      },
    };
    return event;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface CommitmentHistoryResult {
  events: HistoryEvent[];
  total: number;
}

/**
 * Aggregates all lifecycle events for `commitmentId`, sorted oldest-first.
 *
 * @param commitment - Chain commitment record (caller is responsible for
 *                     fetching and 404-checking before calling this).
 * @returns All events sorted by `occurredAt` ascending.
 */
export async function getCommitmentHistory(
  commitment: ChainCommitment,
): Promise<CommitmentHistoryResult> {
  const { attestations } = await getMockData();

  const events: HistoryEvent[] = [
    buildCreatedEvent(commitment),
    ...buildAttestationEvents(commitment.id, attestations),
  ];

  const terminal = buildTerminalEvent(commitment);
  if (terminal) events.push(terminal);

  // Sort chronologically (oldest first)
  events.sort(
    (a, b) =>
      new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
  );

  return { events, total: events.length };
}
