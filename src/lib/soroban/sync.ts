import { Address, nativeToScVal } from '@stellar/stellar-sdk';
import { fromOnChain, type Commitment } from '@/lib/commitments';
import {
  getCommitment,
  simulateEscrowRead,
  type OnChainCommitment,
  type ReadOptions,
} from './read';

const OWNER_COMMITMENT_PAGE_LIMIT = 100;

export async function listOwnerCommitmentIds(
  owner: string,
  options?: ReadOptions,
): Promise<string[]> {
  const ids: string[] = [];
  let start = 0;

  while (true) {
    const raw = await simulateEscrowRead(
      'get_user_commitment_ids_page',
      [
        new Address(owner).toScVal(),
        nativeToScVal(start, { type: 'u32' }),
        nativeToScVal(OWNER_COMMITMENT_PAGE_LIMIT, { type: 'u32' }),
      ],
      options,
    );
    if (!Array.isArray(raw)) {
      throw new TypeError('Expected a page of owner commitment IDs from Soroban.');
    }

    const page = raw.map((value) => {
      const id = BigInt(value as string | number | bigint);
      if (id < 0n) throw new TypeError('Owner commitment IDs cannot be negative.');
      return id.toString();
    });
    if (page.length === 0) break;

    ids.push(...page);
    start += page.length;
  }

  return ids;
}

export async function listOwnerCommitments(
  owner: string,
  options?: ReadOptions,
): Promise<OnChainCommitment[]> {
  const ids = await listOwnerCommitmentIds(owner, options);
  return Promise.all(ids.map((id) => getCommitment(id, options)));
}

export function mergeCommitments(local: Commitment[], chain: Commitment[]): Commitment[] {
  const merged = local.map((commitment) => ({ ...commitment }));
  const localIndex = new Map<string, number>();
  merged.forEach((commitment, index) => localIndex.set(canonicalId(commitment.id), index));

  for (const chainCommitment of chain) {
    const key = canonicalId(chainCommitment.id);
    const existingIndex = localIndex.get(key);
    if (existingIndex === undefined) {
      localIndex.set(key, merged.length);
      merged.push({ ...chainCommitment });
      continue;
    }

    const existing = merged[existingIndex];
    merged[existingIndex] = {
      ...existing,
      ...chainCommitment,
      txHash: existing.txHash ?? chainCommitment.txHash,
      ...(existing.demo ? { demo: true } : {}),
      ...(existing.dispute ? { dispute: existing.dispute } : {}),
      ...(existing.exitAmount !== undefined ? { exitAmount: existing.exitAmount } : {}),
      ...(existing.exitPenaltyAmount !== undefined
        ? { exitPenaltyAmount: existing.exitPenaltyAmount }
        : {}),
      ...(existing.exitTxHash !== undefined ? { exitTxHash: existing.exitTxHash } : {}),
    };
  }

  return merged;
}

function canonicalId(id: string): string {
  return /^\d+$/.test(id) ? BigInt(id).toString() : id;
}

export interface SyncResult {
  commitments: Commitment[];
  syncedAt: number;
}

const syncCache = new Map<string, SyncResult>();
const inFlightSyncs = new Map<string, Promise<SyncResult>>();

export function syncOwnerCommitments(
  owner: string,
  options: { refresh?: boolean; readOptions?: ReadOptions } = {},
): Promise<SyncResult> {
  if (!options.refresh) {
    const cached = syncCache.get(owner);
    if (cached) return Promise.resolve(cached);
    const inFlight = inFlightSyncs.get(owner);
    if (inFlight) return inFlight;
  }

  const request = listOwnerCommitments(owner, options.readOptions)
    .then((records) => {
      const result = { commitments: records.map(fromOnChain), syncedAt: Date.now() };
      syncCache.set(owner, result);
      return result;
    })
    .finally(() => {
      if (inFlightSyncs.get(owner) === request) inFlightSyncs.delete(owner);
    });
  inFlightSyncs.set(owner, request);
  return request;
}
