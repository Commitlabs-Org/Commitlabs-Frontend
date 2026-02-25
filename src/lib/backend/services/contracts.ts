import {
  Account,
  BASE_FEE,
  Contract,
  Keypair,
  SorobanRpc,
  TransactionBuilder,
  nativeToScVal,
  scValToNative
} from '@stellar/stellar-sdk';
import { BackendError, normalizeBackendError } from '@/lib/backend/errors';

export type ChainCommitmentStatus = 'ACTIVE' | 'SETTLED' | 'VIOLATED' | 'EARLY_EXIT' | 'UNKNOWN';

export interface CreateCommitmentOnChainParams {
  ownerAddress: string;
  asset: string;
  amount: string;
  durationDays: number;
  maxLossBps: number;
  metadata?: Record<string, unknown>;
}

export interface ChainCommitment {
  id: string;
  ownerAddress: string;
  asset: string;
  amount: string;
  status: ChainCommitmentStatus;
  complianceScore: number;
  currentValue: string;
  feeEarned: string;
  violationCount: number;
  createdAt?: string;
  expiresAt?: string;
}

export interface CreateCommitmentOnChainResult {
  commitmentId: string;
  commitment: ChainCommitment;
  txHash?: string;
}

export interface RecordAttestationOnChainParams {
  commitmentId: string;
  attestorAddress: string;
  complianceScore: number;
  violation: boolean;
  feeEarned?: string;
  timestamp?: string;
  details?: Record<string, unknown>;
}

export interface RecordAttestationOnChainResult {
  attestationId: string;
  commitmentId: string;
  complianceScore: number;
  violation: boolean;
  feeEarned: string;
  recordedAt: string;
  txHash?: string;
}

type ContractCallMode = 'read' | 'write';

interface ContractInvocationResult {
  value: unknown;
  txHash?: string;
}

const DEFAULT_RPC_URL = 'https://soroban-testnet.stellar.org:443';
const DEFAULT_NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';
const ANALYTICS_SCALE = 100;

function getRpcUrl(): string {
  return process.env.SOROBAN_RPC_URL || process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || DEFAULT_RPC_URL;
}

function getNetworkPassphrase(): string {
  return (
    process.env.SOROBAN_NETWORK_PASSPHRASE ||
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ||
    DEFAULT_NETWORK_PASSPHRASE
  );
}

function getContractId(kind: 'commitmentCore' | 'attestationEngine'): string {
  if (kind === 'commitmentCore') {
    return (
      process.env.SOROBAN_COMMITMENT_CORE_CONTRACT ||
      process.env.NEXT_PUBLIC_COMMITMENT_CORE_CONTRACT ||
      ''
    );
  }

  return (
    process.env.SOROBAN_ATTESTATION_ENGINE_CONTRACT ||
    process.env.NEXT_PUBLIC_ATTESTATION_ENGINE_CONTRACT ||
    ''
  );
}

function getSourceKeypair(): Keypair | null {
  const secret = process.env.SOROBAN_SERVER_SECRET_KEY;
  if (!secret) {
    return null;
  }
  return Keypair.fromSecret(secret);
}

function getSourcePublicKey(): string | null {
  const keypair = getSourceKeypair();
  if (keypair) {
    return keypair.publicKey();
  }

  return process.env.SOROBAN_SOURCE_ACCOUNT || null;
}

function getSorobanServer(): SorobanRpc.Server {
  const url = getRpcUrl();
  return new SorobanRpc.Server(url, { allowHttp: url.startsWith('http://') });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'bigint') {
    return String(value);
  }
  return fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function normalizeStatus(value: unknown): ChainCommitmentStatus {
  const raw = asString(value, 'UNKNOWN').toUpperCase();
  if (raw === 'ACTIVE' || raw === 'SETTLED' || raw === 'VIOLATED' || raw === 'EARLY_EXIT') {
    return raw;
  }
  return 'UNKNOWN';
}

function parseChainCommitment(value: unknown): ChainCommitment {
  const raw = asRecord(value);
  const id = asString(raw.id ?? raw.commitmentId);

  if (!id) {
    throw new BackendError({
      code: 'BLOCKCHAIN_CALL_FAILED',
      message: 'Soroban returned a commitment without an id.',
      status: 502,
      details: { raw }
    });
  }

  return {
    id,
    ownerAddress: asString(raw.ownerAddress ?? raw.owner_address),
    asset: asString(raw.asset),
    amount: asString(raw.amount, '0'),
    status: normalizeStatus(raw.status),
    complianceScore: asNumber(raw.complianceScore ?? raw.compliance_score),
    currentValue: asString(raw.currentValue ?? raw.current_value ?? raw.amount, '0'),
    feeEarned: asString(raw.feeEarned ?? raw.fees_earned, '0'),
    violationCount: asNumber(raw.violationCount ?? raw.violation_count),
    createdAt: asString(raw.createdAt ?? raw.created_at) || undefined,
    expiresAt: asString(raw.expiresAt ?? raw.expires_at) || undefined
  };
}

function parseCreateCommitmentResult(value: unknown, txHash?: string): CreateCommitmentOnChainResult {
  if (typeof value === 'string') {
    return {
      commitmentId: value,
      commitment: {
        id: value,
        ownerAddress: '',
        asset: '',
        amount: '0',
        status: 'UNKNOWN',
        complianceScore: 0,
        currentValue: '0',
        feeEarned: '0',
        violationCount: 0
      },
      txHash
    };
  }

  const raw = asRecord(value);
  const parsedCommitment = parseChainCommitment(raw.commitment ?? raw);

  return {
    commitmentId: parsedCommitment.id,
    commitment: parsedCommitment,
    txHash: asString(raw.txHash) || txHash
  };
}

function parseAttestationResult(value: unknown, txHash?: string): RecordAttestationOnChainResult {
  const raw = asRecord(value);
  const attestationId = asString(raw.attestationId ?? raw.id);
  const commitmentId = asString(raw.commitmentId ?? raw.commitment_id);

  if (!attestationId || !commitmentId) {
    throw new BackendError({
      code: 'BLOCKCHAIN_CALL_FAILED',
      message: 'Soroban returned an invalid attestation payload.',
      status: 502,
      details: { raw }
    });
  }

  return {
    attestationId,
    commitmentId,
    complianceScore: asNumber(raw.complianceScore ?? raw.compliance_score),
    violation: Boolean(raw.violation),
    feeEarned: asString(raw.feeEarned ?? raw.fees_earned, '0'),
    recordedAt: asString(raw.recordedAt ?? raw.recorded_at) || new Date().toISOString(),
    txHash: asString(raw.txHash) || txHash
  };
}

function parseCommitmentList(value: unknown): ChainCommitment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => parseChainCommitment(item));
}

async function waitForTransactionResult(
  server: SorobanRpc.Server,
  hash: string,
  timeoutMs = 15_000
): Promise<unknown> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const tx = await server.getTransaction(hash);
    if (tx.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
      return tx.returnValue ? scValToNative(tx.returnValue) : null;
    }
    if (tx.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
      throw new BackendError({
        code: 'BLOCKCHAIN_CALL_FAILED',
        message: 'Soroban transaction failed.',
        status: 502,
        details: { hash, txStatus: tx.status }
      });
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 600);
    });
  }

  throw new BackendError({
    code: 'BLOCKCHAIN_CALL_FAILED',
    message: 'Timed out waiting for Soroban transaction result.',
    status: 504,
    details: { hash }
  });
}

async function invokeContractMethod(
  contractId: string,
  methodName: string,
  params: unknown[],
  mode: ContractCallMode
): Promise<ContractInvocationResult> {
  if (!contractId) {
    throw new BackendError({
      code: 'BLOCKCHAIN_UNAVAILABLE',
      message: 'Missing Soroban contract configuration.',
      status: 500,
      details: { methodName }
    });
  }

  const sourcePublicKey = getSourcePublicKey();
  if (!sourcePublicKey) {
    throw new BackendError({
      code: 'BLOCKCHAIN_UNAVAILABLE',
      message: 'Missing SOROBAN source account configuration.',
      status: 500,
      details: { methodName }
    });
  }

  const server = getSorobanServer();
  const contract = new Contract(contractId);
  const account =
    mode === 'write'
      ? await server.getAccount(sourcePublicKey)
      : new Account(sourcePublicKey, '0');
  const operation = contract.call(methodName, ...params.map((value) => nativeToScVal(value)));

  const tx = new TransactionBuilder(account, {
    fee: String(BASE_FEE),
    networkPassphrase: getNetworkPassphrase()
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  const simulation = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(simulation)) {
    throw new BackendError({
      code: 'BLOCKCHAIN_CALL_FAILED',
      message: `Soroban simulation failed for ${methodName}.`,
      status: 502,
      details: { methodName, error: simulation.error }
    });
  }

  if (mode === 'read') {
    return {
      value: simulation.result ? scValToNative(simulation.result.retval) : null
    };
  }

  const sourceKeypair = getSourceKeypair();
  if (!sourceKeypair) {
    throw new BackendError({
      code: 'BLOCKCHAIN_UNAVAILABLE',
      message: 'Missing SOROBAN_SERVER_SECRET_KEY for write contract calls.',
      status: 500,
      details: { methodName }
    });
  }

  const preparedTx = await server.prepareTransaction(tx);
  preparedTx.sign(sourceKeypair);
  const sendResult = await server.sendTransaction(preparedTx);
  const txHash = sendResult.hash;

  const onChainValue = await waitForTransactionResult(server, txHash);
  return { value: onChainValue, txHash };
}

function validateOwnerAddress(ownerAddress: string): void {
  if (!ownerAddress || ownerAddress.trim().length < 5) {
    throw new BackendError({
      code: 'BAD_REQUEST',
      message: 'Invalid owner address.',
      status: 400,
      details: { ownerAddress }
    });
  }
}

export async function createCommitmentOnChain(
  params: CreateCommitmentOnChainParams
): Promise<CreateCommitmentOnChainResult> {
  try {
    validateOwnerAddress(params.ownerAddress);
    const invocation = await invokeContractMethod(
      getContractId('commitmentCore'),
      'create_commitment',
      [
        params.ownerAddress,
        params.asset,
        params.amount,
        params.durationDays,
        params.maxLossBps,
        params.metadata ?? {}
      ],
      'write'
    );

    return parseCreateCommitmentResult(invocation.value, invocation.txHash);
  } catch (error) {
    throw normalizeBackendError(error, {
      code: 'BLOCKCHAIN_CALL_FAILED',
      message: 'Unable to create commitment on chain.',
      status: 502,
      details: { method: 'create_commitment' }
    });
  }
}

export async function getCommitmentFromChain(commitmentId: string): Promise<ChainCommitment> {
  try {
    if (!commitmentId) {
      throw new BackendError({
        code: 'BAD_REQUEST',
        message: 'Missing commitment id.',
        status: 400
      });
    }

    const invocation = await invokeContractMethod(
      getContractId('commitmentCore'),
      'get_commitment',
      [commitmentId],
      'read'
    );

    return parseChainCommitment(invocation.value);
  } catch (error) {
    throw normalizeBackendError(error, {
      code: 'BLOCKCHAIN_CALL_FAILED',
      message: 'Unable to fetch commitment from chain.',
      status: 502,
      details: { method: 'get_commitment', commitmentId }
    });
  }
}

export async function getUserCommitmentsFromChain(ownerAddress: string): Promise<ChainCommitment[]> {
  try {
    validateOwnerAddress(ownerAddress);
    const contractId = getContractId('commitmentCore');

    try {
      const directResult = await invokeContractMethod(
        contractId,
        'get_user_commitments',
        [ownerAddress],
        'read'
      );
      const commitments = parseCommitmentList(directResult.value);
      if (commitments.length > 0) {
        return commitments;
      }
    } catch (error) {
      if (!(error instanceof BackendError)) {
        throw error;
      }
    }

    const idsResult = await invokeContractMethod(contractId, 'get_user_commitment_ids', [ownerAddress], 'read');
    const commitmentIds = Array.isArray(idsResult.value) ? idsResult.value.map((id) => asString(id)).filter(Boolean) : [];
    const commitments = await Promise.all(commitmentIds.map((commitmentId) => getCommitmentFromChain(commitmentId)));

    return commitments;
  } catch (error) {
    throw normalizeBackendError(error, {
      code: 'BLOCKCHAIN_CALL_FAILED',
      message: 'Unable to fetch user commitments from chain.',
      status: 502,
      details: { method: 'get_user_commitments', ownerAddress }
    });
  }
}

export async function recordAttestationOnChain(
  params: RecordAttestationOnChainParams
): Promise<RecordAttestationOnChainResult> {
  try {
    if (!params.commitmentId) {
      throw new BackendError({
        code: 'BAD_REQUEST',
        message: 'Missing commitment id for attestation.',
        status: 400
      });
    }

    const invocation = await invokeContractMethod(
      getContractId('attestationEngine'),
      'record_attestation',
      [
        params.commitmentId,
        params.attestorAddress,
        params.complianceScore / ANALYTICS_SCALE,
        params.violation,
        params.feeEarned ?? '0',
        params.timestamp ?? new Date().toISOString(),
        params.details ?? {}
      ],
      'write'
    );

    return parseAttestationResult(invocation.value, invocation.txHash);
  } catch (error) {
    throw normalizeBackendError(error, {
      code: 'BLOCKCHAIN_CALL_FAILED',
      message: 'Unable to record attestation on chain.',
      status: 502,
      details: { method: 'record_attestation', commitmentId: params.commitmentId }
    });
  }
}
