import { signTransaction } from '@stellar/freighter-api';
import { getActiveConfig } from '@/lib/config';
import { getDeploymentTokenId } from '@/lib/deployments';
import { CONTRACT_ERRORS, EscrowErrorCode, TxError, toTxError } from '@/lib/soroban/errors';
import { getEscrowClient, RISK_PROFILES, type EscrowSignTransactionFn } from '@/lib/soroban/escrow-client';

export type CreateRiskKey = keyof typeof RISK_PROFILES;

export interface CreateAndFundParams {
  owner: string;
  asset: string;
  amount: bigint;
  risk: CreateRiskKey;
  days: number;
  penaltyBps: number;
  onProgress?: (stage: 'creating' | 'funding') => void;
  signTransaction?: EscrowSignTransactionFn;
}

export interface CreateAndFundSuccess {
  status: 'funded';
  commitmentId: string;
  createTxHash: string | null;
  fundTxHash: string | null;
  txHash: string | null;
}

export interface CreateAndFundPartialFailure {
  status: 'created_unfunded';
  commitmentId: string;
  createTxHash: string | null;
  error: TxError;
}

export type CreateAndFundResult = CreateAndFundSuccess | CreateAndFundPartialFailure;

export interface FundCommitmentParams {
  commitmentId: string | bigint;
  owner: string;
  signTransaction?: EscrowSignTransactionFn;
}

export interface FundCommitmentResult {
  txHash: string | null;
}

const CONTRACT_ID_PATTERN = /^C[A-Z2-7]{55}$/;

function resolveTokenAddress(asset: string): string {
  const trimmed = asset.trim();
  if (CONTRACT_ID_PATTERN.test(trimmed)) {
    return trimmed;
  }
  const active = getActiveConfig();
  const configured = active.escrowTokenId || getDeploymentTokenId(active.network);
  if (configured && CONTRACT_ID_PATTERN.test(configured)) {
    return configured;
  }
  throw new TxError('network', 'The escrow token contract is not configured for this network.', {
    hint: 'Set NEXT_PUBLIC_ESCROW_TOKEN_ID or configure deployments/<network>.json.',
  });
}

function normalizeContractErr(errVal: unknown): TxError {
  if (typeof errVal === 'number' && errVal in CONTRACT_ERRORS) {
    return toTxError(`Error(Contract, #${errVal})`);
  }
  if (typeof errVal === 'object' && errVal !== null) {
    const rec = errVal as Record<string, unknown>;
    if (typeof rec.code === 'number' && rec.code in CONTRACT_ERRORS) {
      return toTxError(`Error(Contract, #${rec.code})`);
    }
    if (typeof rec.message === 'string') {
      const matched = Object.values(CONTRACT_ERRORS).find(
        (entry) => entry.name.toLowerCase() === rec.message?.toString().toLowerCase()
      );
      if (matched) {
        return toTxError(`Error(Contract, #${matched.code})`);
      }
    }
  }
  return toTxError(errVal);
}

function unwrapResult<T>(value: unknown): T {
  if (typeof value === 'object' && value !== null) {
    const maybeResult = value as {
      isErr?: () => boolean;
      isOk?: () => boolean;
      unwrap?: () => T;
      unwrapErr?: () => unknown;
    };
    if (typeof maybeResult.isErr === 'function' && maybeResult.isErr()) {
      const errVal = typeof maybeResult.unwrapErr === 'function' ? maybeResult.unwrapErr() : maybeResult;
      throw normalizeContractErr(errVal);
    }
    if (typeof maybeResult.isOk === 'function' && maybeResult.isOk() && typeof maybeResult.unwrap === 'function') {
      return maybeResult.unwrap();
    }
  }
  return value as T;
}

function extractTxHash(sent: unknown): string | null {
  if (typeof sent !== 'object' || sent === null) return null;
  const s = sent as {
    txHash?: unknown;
    hash?: unknown;
    sendTransactionResponse?: { hash?: unknown };
    getTransactionResponse?: { txHash?: unknown };
  };
  const candidates = [
    s.getTransactionResponse?.txHash,
    s.sendTransactionResponse?.hash,
    s.txHash,
    s.hash,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
}

function toBigIntId(id: unknown): bigint {
  if (typeof id === 'bigint') return id;
  if (typeof id === 'number' && Number.isInteger(id) && id >= 0) return BigInt(id);
  if (typeof id === 'string' && /^\d+$/.test(id.trim())) return BigInt(id.trim());
  throw new TxError('failed', 'The escrow contract returned an invalid commitment ID.');
}

/**
 * Creates a commitment on-chain via `create_commitment` and immediately funds it via `fund_escrow`.
 *
 * - If `create_commitment` fails, throws a normalized `TxError`.
 * - If `create_commitment` succeeds but `fund_escrow` fails, returns a `created_unfunded`
 *   result containing the created `commitmentId`, `createTxHash`, and normalized `TxError`
 *   so the caller can persist a recoverable record and offer a retry-fund action.
 */
export async function createAndFundCommitment({
  owner,
  asset,
  amount,
  risk,
  days,
  penaltyBps,
  onProgress,
  signTransaction: customSigner,
}: CreateAndFundParams): Promise<CreateAndFundResult> {
  if (typeof amount !== 'bigint' || amount <= 0n) {
    throw toTxError(`Error(Contract, #${EscrowErrorCode.InvalidAmount})`);
  }

  const tokenAddress = resolveTokenAddress(asset);
  const client = getEscrowClient({
    publicKey: owner,
    signTransaction: customSigner ?? signTransaction,
  });

  let commitmentId: bigint;
  let createTxHash: string | null = null;

  try {
    onProgress?.('creating');
    const createTx = await client.create_commitment({
      owner,
      asset: tokenAddress,
      amount,
      risk: RISK_PROFILES[risk],
      duration_days: days,
      penalty_bps: penaltyBps,
      metadata: new Map<string, string>(),
    });
    const createSent = await createTx.signAndSend();
    const rawId = unwrapResult<unknown>(createSent.result);
    commitmentId = toBigIntId(rawId);
    createTxHash = extractTxHash(createSent);
  } catch (err) {
    throw toTxError(err);
  }

  try {
    onProgress?.('funding');
    const fundTx = await client.fund_escrow({
      commitment_id: commitmentId,
    });
    const fundSent = await fundTx.signAndSend();
    unwrapResult<void>(fundSent.result);
    const fundTxHash = extractTxHash(fundSent);

    return {
      status: 'funded',
      commitmentId: commitmentId.toString(),
      createTxHash,
      fundTxHash,
      txHash: fundTxHash ?? createTxHash,
    };
  } catch (err) {
    return {
      status: 'created_unfunded',
      commitmentId: commitmentId.toString(),
      createTxHash,
      error: toTxError(err),
    };
  }
}

/**
 * Retries funding an already-created on-chain commitment via `fund_escrow`.
 */
export async function fundCommitment({
  commitmentId,
  owner,
  signTransaction: customSigner,
}: FundCommitmentParams): Promise<FundCommitmentResult> {
  const id = toBigIntId(commitmentId);
  const client = getEscrowClient({
    publicKey: owner,
    signTransaction: customSigner ?? signTransaction,
  });

  try {
    const fundTx = await client.fund_escrow({
      commitment_id: id,
    });
    const fundSent = await fundTx.signAndSend();
    unwrapResult<void>(fundSent.result);
    return {
      txHash: extractTxHash(fundSent),
    };
  } catch (err) {
    throw toTxError(err);
  }
}
