import {
  Account,
  Address,
  BASE_FEE,
  Contract,
  Keypair,
  SorobanRpc,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
} from "@stellar/stellar-sdk";
import {
  BackendError,
  BackendErrorCode,
  normalizeBackendError,
} from "@/lib/backend/errors";
import { getBackendConfig } from "@/lib/backend/config";
import { logInfo } from "@/lib/backend/logger";
import { cache } from "@/lib/backend/cache/factory";
import { CacheKey, CacheTTL } from "@/lib/backend/cache/index";
import { getCountersAdapter } from "@/lib/backend/counters/provider";

export type ChainCommitmentStatus =
  | "ACTIVE"
  | "SETTLED"
  | "VIOLATED"
  | "EARLY_EXIT"
  | "UNKNOWN";

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

export interface SettleCommitmentOnChainParams {
  commitmentId: string;
  callerAddress?: string;
}

export interface SettleCommitmentOnChainResult {
  settlementAmount: string;
  txHash?: string;
  reference?: string;
  finalStatus: string;
}

type ContractCallMode = "read" | "write";
interface ContractInvocationResult {
  value: unknown;
  txHash?: string;
}

const ANALYTICS_SCALE = 100;

function getRpcUrl(): string {
  return getBackendConfig().sorobanRpcUrl;
}

function getNetworkPassphrase(): string {
  return getBackendConfig().networkPassphrase;
}

function getContractId(kind: "commitmentCore" | "attestationEngine"): string {
  const config = getBackendConfig();
  if (kind === "commitmentCore") {
    return config.contractAddresses.commitmentCore;
  }
  return config.contractAddresses.attestationEngine;
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
  return new SorobanRpc.Server(url, { allowHttp: url.startsWith("http://") });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }
  return fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function normalizeStatus(value: unknown): ChainCommitmentStatus {
  const raw = asString(value, "UNKNOWN").toUpperCase();
  if (
    raw === "ACTIVE" ||
    raw === "SETTLED" ||
    raw === "VIOLATED" ||
    raw === "EARLY_EXIT"
  ) {
    return raw;
  }
  return "UNKNOWN";
}

/**
 * Normalizes blockchain-related errors into stable BackendError types.
 * Maps RPC failures, simulation errors, and timeouts to appropriate status codes.
 * Ensures that sensitive raw RPC details are not leaked to the client.
 */
function normalizeContractError(
  error: unknown,
  defaults: {
    code: BackendErrorCode;
    message: string;
    status: number;
    details?: Record<string, unknown>;
  },
): BackendError {
  // If it's already a well-formed BackendError, we enrich it with defaults
  if (error instanceof BackendError) {
    const isRetryable = [429, 503, 504].includes(error.status);
    return new BackendError({
      code: error.code,
      message: error.message,
      status: error.status,
      details: {
        ...asRecord(error.details),
        ...asRecord(defaults.details),
        retryable: isRetryable || asRecord(error.details).retryable === true,
      },
    });
  }

  const errMessage = error instanceof Error ? error.message : String(error);
  const errStr = errMessage.toLowerCase();

  let status = defaults.status;
  let code = defaults.code;
  let message = defaults.message;
  let retryable = false;

  // Pattern match for specific failure types from Soroban RPC or SDK
  if (
    errStr.includes("timeout") ||
    errStr.includes("deadline") ||
    errStr.includes("timed out")
  ) {
    status = 504;
    code = "GATEWAY_TIMEOUT";
    message =
      "The blockchain operation timed out. It may still be processed later.";
    retryable = true;
  } else if (
    errStr.includes("429") ||
    errStr.includes("rate limit") ||
    errStr.includes("too many requests")
  ) {
    status = 429;
    code = "TOO_MANY_REQUESTS";
    message =
      "Rate limit exceeded for blockchain calls. Please try again later.";
    retryable = true;
  } else if (errStr.includes("not found") || errStr.includes("404")) {
    status = 404;
    code = "NOT_FOUND";
    message = "The requested resource was not found on the blockchain.";
  } else if (
    errStr.includes("insufficient") ||
    errStr.includes("invalid") ||
    errStr.includes("malformed")
  ) {
    status = 400;
    code = "VALIDATION_ERROR";
    message =
      "The transaction was rejected due to invalid parameters or state.";
  } else if (status >= 500) {
    retryable = true;
  }

  return new BackendError({
    code,
    message,
    status,
    details: {
      ...asRecord(defaults.details),
      retryable,
    },
  });
}

function parseChainCommitment(value: unknown): ChainCommitment {
  const raw = asRecord(value);
  const id = asString(raw.id ?? raw.commitmentId);

  if (!id) {
    throw new BackendError({
      code: "BLOCKCHAIN_CALL_FAILED",
      message: "Soroban returned a commitment without an id.",
      status: 502,
      details: { raw },
    });
  }

  return {
    id,
    ownerAddress: asString(raw.ownerAddress ?? raw.owner_address),
    asset: asString(raw.asset),
    amount: asString(raw.amount, "0"),
    status: normalizeStatus(raw.status),
    complianceScore: asNumber(raw.complianceScore ?? raw.compliance_score),
    currentValue: asString(
      raw.currentValue ?? raw.current_value ?? raw.amount,
      "0",
    ),
    feeEarned: asString(raw.feeEarned ?? raw.fees_earned, "0"),
    violationCount: asNumber(raw.violationCount ?? raw.violation_count),
    createdAt: asString(raw.createdAt ?? raw.created_at) || undefined,
    expiresAt: asString(raw.expiresAt ?? raw.expires_at) || undefined,
  };
}

function parseCreateCommitmentResult(
  value: unknown,
  txHash?: string,
): CreateCommitmentOnChainResult {
  if (typeof value === "string") {
    return {
      commitmentId: value,
      commitment: {
        id: value,
        ownerAddress: "",
        asset: "",
        amount: "0",
        status: "UNKNOWN",
        complianceScore: 0,
        currentValue: "0",
        feeEarned: "0",
        violationCount: 0,
      },
      txHash,
    };
  }

  const raw = asRecord(value);
  const parsedCommitment = parseChainCommitment(raw.commitment ?? raw);

  return {
    commitmentId: parsedCommitment.id,
    commitment: parsedCommitment,
    txHash: asString(raw.txHash) || txHash,
  };
}

function parseAttestationResult(
  value: unknown,
  txHash?: string,
): RecordAttestationOnChainResult {
  const raw = asRecord(value);
  const attestationId = asString(raw.attestationId ?? raw.id);
  const commitmentId = asString(raw.commitmentId ?? raw.commitment_id);

  if (!attestationId || !commitmentId) {
    throw new BackendError({
      code: "BLOCKCHAIN_CALL_FAILED",
      message: "Soroban returned an invalid attestation payload.",
      status: 502,
      details: { raw },
    });
  }

  return {
    attestationId,
    commitmentId,
    complianceScore: asNumber(raw.complianceScore ?? raw.compliance_score),
    violation: Boolean(raw.violation),
    feeEarned: asString(raw.feeEarned ?? raw.fees_earned, "0"),
    recordedAt:
      asString(raw.recordedAt ?? raw.recorded_at) || new Date().toISOString(),
    txHash: asString(raw.txHash) || txHash,
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
  timeoutMs = 15_000,
): Promise<unknown> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const tx = await server.getTransaction(hash);
    if (tx.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
      return tx.returnValue ? scValToNative(tx.returnValue) : null;
    }
    if (tx.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
      throw normalizeContractError(new Error("Transaction execution failed"), {
        code: "BLOCKCHAIN_CALL_FAILED",
        message: "Soroban transaction failed.",
        status: 502,
        details: { hash, txStatus: tx.status },
      });
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 600);
    });
  }

  throw normalizeContractError(new Error("RPC Timeout"), {
    code: "BLOCKCHAIN_CALL_FAILED",
    message: "Timed out waiting for Soroban transaction result.",
    status: 504,
    details: { hash },
  });
}

async function invokeContractMethod(
  contractId: string,
  methodName: string,
  params: unknown[],
  mode: ContractCallMode,
): Promise<ContractInvocationResult> {
  if (!contractId) {
    throw new BackendError({
      code: "BLOCKCHAIN_UNAVAILABLE",
      message: "Missing Soroban contract configuration.",
      status: 500,
      details: { methodName },
    });
  }

  const sourcePublicKey = getSourcePublicKey();
  if (!sourcePublicKey) {
    throw new BackendError({
      code: "BLOCKCHAIN_UNAVAILABLE",
      message: "Missing SOROBAN source account configuration.",
      status: 500,
      details: { methodName },
    });
  }

  const server = getSorobanServer();
  const contract = new Contract(contractId);
  const account =
    mode === "write"
      ? await server.getAccount(sourcePublicKey)
      : new Account(sourcePublicKey, "0");
  const operation = contract.call(
    methodName,
    ...params.map((value) => nativeToScVal(value)),
  );

  const tx = new TransactionBuilder(account, {
    fee: String(BASE_FEE),
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  const simulation = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(simulation)) {
    throw normalizeContractError(new Error(simulation.error), {
      code: "BLOCKCHAIN_CALL_FAILED",
      message: `Soroban simulation failed for ${methodName}.`,
      status: 502,
      details: { methodName },
    });
  }

  if (mode === "read") {
    return {
      value: simulation.result ? scValToNative(simulation.result.retval) : null,
    };
  }

  const sourceKeypair = getSourceKeypair();
  if (!sourceKeypair) {
    throw new BackendError({
      code: "BLOCKCHAIN_UNAVAILABLE",
      message: "Missing SOROBAN_SERVER_SECRET_KEY for write contract calls.",
      status: 500,
      details: { methodName },
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
      code: "BAD_REQUEST",
      message: "Invalid owner address.",
      status: 400,
      details: { ownerAddress },
    });
  }
}

export async function createCommitmentOnChain(
  params: CreateCommitmentOnChainParams,
): Promise<CreateCommitmentOnChainResult> {
  try {
    validateOwnerAddress(params.ownerAddress);
    const invocation = await invokeContractMethod(
      getContractId("commitmentCore"),
      "create_commitment",
      [
        new Address(params.ownerAddress).toScVal(),
        nativeToScVal(params.asset),
        nativeToScVal(params.amount),
        nativeToScVal(params.durationDays),
        nativeToScVal(params.maxLossBps),
        nativeToScVal(params.metadata ?? {}),
      ],
      "write",
    );

    // Increment successful actions counter on successful commitment creation
    const countersAdapter = getCountersAdapter();
    void countersAdapter.incrementSuccessfulActions(); // Fire and forget for metrics

    void cache.delete(CacheKey.userCommitments(params.ownerAddress));

    return parseCreateCommitmentResult(invocation.value, invocation.txHash);
  } catch (error) {
    // Increment chain failures counter on blockchain operation failures
    const countersAdapter = getCountersAdapter();
    void countersAdapter.incrementChainFailures(); // Fire and forget for metrics

    throw normalizeBackendError(error, {
      code: "BLOCKCHAIN_CALL_FAILED",
      message: "Unable to create commitment on chain.",
      status: 502,
      details: { method: "create_commitment" },
    });
  }
}

export async function getCommitmentFromChain(
  commitmentId: string,
): Promise<ChainCommitment> {
  try {
    if (!commitmentId) {
      throw new BackendError({
        code: "BAD_REQUEST",
        message: "Missing commitment id.",
        status: 400,
      });
    }

    const cacheKey = CacheKey.commitment(commitmentId);
    const cached = await cache.get<ChainCommitment>(cacheKey);
    if (cached !== null) {
      logInfo(undefined, "[cache] hit commitment", { commitmentId });
      return cached;
    }
    logInfo(undefined, "[cache] miss commitment", { commitmentId });

    const invocation = await invokeContractMethod(
      getContractId("commitmentCore"),
      "get_commitment",
      [commitmentId],
      "read",
    );

    // Increment successful actions counter on successful chain read
    const countersAdapter = getCountersAdapter();
    void countersAdapter.incrementSuccessfulActions(); // Fire and forget for metrics

    const commitment = parseChainCommitment(invocation.value);
    await cache.set(cacheKey, commitment, CacheTTL.COMMITMENT_DETAIL);
    return commitment;
  } catch (error) {
    // Increment chain failures counter on blockchain operation failures
    const countersAdapter = getCountersAdapter();
    void countersAdapter.incrementChainFailures(); // Fire and forget for metrics

    throw normalizeBackendError(error, {
      code: "BLOCKCHAIN_CALL_FAILED",
      message: "Unable to fetch commitment from chain.",
      status: 502,
      details: { method: "get_commitment", commitmentId },
    });
  }
}

export async function getUserCommitmentsFromChain(
  ownerAddress: string,
): Promise<ChainCommitment[]> {
  try {
    validateOwnerAddress(ownerAddress);

    const cacheKey = CacheKey.userCommitments(ownerAddress);
    const cached = await cache.get<ChainCommitment[]>(cacheKey);
    if (cached !== null) {
      logInfo(undefined, "[cache] hit user-commitments", { ownerAddress });
      return cached;
    }
    logInfo(undefined, "[cache] miss user-commitments", { ownerAddress });

    const contractId = getContractId("commitmentCore");

    try {
      const directResult = await invokeContractMethod(
        contractId,
        "get_user_commitments",
        [ownerAddress],
        "read",
      );
      const commitments = parseCommitmentList(directResult.value);
      if (commitments.length > 0) {
        await cache.set(cacheKey, commitments, CacheTTL.USER_COMMITMENTS);
        // Increment successful actions counter on successful chain read
        const countersAdapter = getCountersAdapter();
        void countersAdapter.incrementSuccessfulActions();
        return commitments;
      }
    } catch (error) {
      if (!(error instanceof BackendError)) {
        throw error;
      }
    }

    const idsResult = await invokeContractMethod(
      contractId,
      "get_user_commitment_ids",
      [ownerAddress],
      "read",
    );
    const commitmentIds = Array.isArray(idsResult.value)
      ? idsResult.value.map((id) => asString(id)).filter(Boolean)
      : [];
    const commitments = await Promise.all(
      commitmentIds.map((commitmentId) => getCommitmentFromChain(commitmentId)),
    );

    await cache.set(cacheKey, commitments, CacheTTL.USER_COMMITMENTS);
    // Increment successful actions counter on successful chain read
    const countersAdapter = getCountersAdapter();
    void countersAdapter.incrementSuccessfulActions();
    return commitments;
  } catch (error) {
    // Increment chain failures counter on blockchain operation failures
    const countersAdapter = getCountersAdapter();
    void countersAdapter.incrementChainFailures();

    throw normalizeContractError(error, {
      code: "BLOCKCHAIN_CALL_FAILED",
      message: "Unable to fetch user commitments from chain.",
      status: 502,
      details: { method: "get_user_commitments", ownerAddress },
    });
  }
}

export async function recordAttestationOnChain(
  params: RecordAttestationOnChainParams,
): Promise<RecordAttestationOnChainResult> {
  try {
    if (!params.commitmentId) {
      throw new BackendError({
        code: "BAD_REQUEST",
        message: "Missing commitment id for attestation.",
        status: 400,
      });
    }

    // Snapshot ownerAddress from cache before writing so we can invalidate the
    // user-commitments list even though attestation params don't carry it.
    const cachedCommitment = await cache.get<ChainCommitment>(
      CacheKey.commitment(params.commitmentId),
    );

    const invocation = await invokeContractMethod(
      getContractId("attestationEngine"),
      "record_attestation",
      [
        nativeToScVal(params.commitmentId),
        new Address(params.attestorAddress).toScVal(),
        nativeToScVal(params.complianceScore / ANALYTICS_SCALE),
        nativeToScVal(params.violation),
        nativeToScVal(params.feeEarned ?? "0"),
        nativeToScVal(params.timestamp ?? new Date().toISOString()),
        nativeToScVal(params.details ?? {}),
      ],
      "write",
    );

    // Increment successful actions counter on successful attestation recording
    const countersAdapter = getCountersAdapter();
    void countersAdapter.incrementSuccessfulActions(); // Fire and forget for metrics

    void cache.delete(CacheKey.commitment(params.commitmentId));
    if (cachedCommitment?.ownerAddress) {
      void cache.delete(
        CacheKey.userCommitments(cachedCommitment.ownerAddress),
      );
    }

    return parseAttestationResult(invocation.value, invocation.txHash);
  } catch (error) {
    // Increment chain failures counter on blockchain operation failures
    const countersAdapter = getCountersAdapter();
    void countersAdapter.incrementChainFailures(); // Fire and forget for metrics

    throw normalizeBackendError(error, {
      code: "BLOCKCHAIN_CALL_FAILED",
      message: "Unable to record attestation on chain.",
      status: 502,
      details: {
        method: "record_attestation",
        commitmentId: params.commitmentId,
      },
    });
  }
}

export async function settleCommitmentOnChain(
  params: SettleCommitmentOnChainParams,
): Promise<SettleCommitmentOnChainResult> {
  try {
    if (!params.commitmentId) {
      throw new BackendError({
        code: "BAD_REQUEST",
        message: "Missing commitment id for settlement.",
        status: 400,
      });
    }

    // First, get the commitment to check if it's matured
    const commitment = await getCommitmentFromChain(params.commitmentId);

    // Check if commitment is matured (expired or can be settled)
    if (commitment.status === "SETTLED") {
      throw new BackendError({
        code: "CONFLICT" as BackendErrorCode,
        message: "Commitment has already been settled.",
        status: 409,
      });
    }

    if (commitment.status === "ACTIVE") {
      // Check if commitment has expired (if expiresAt is available)
      if (commitment.expiresAt) {
        const expiryTime = new Date(commitment.expiresAt).getTime();
        const now = new Date().getTime();
        if (now < expiryTime) {
          throw new BackendError({
            code: "BAD_REQUEST",
            message: "Commitment has not matured yet and cannot be settled.",
            status: 400,
          });
        }
      }
      // TODO: Add additional maturity checks if needed
      // For now, we'll allow settling active commitments
    }

    // Call the settlement function on the contract
    const invocation = await invokeContractMethod(
      getContractId("commitmentCore"),
      "settle_commitment",
      [
        nativeToScVal(params.commitmentId),
        new Address(params.callerAddress ?? commitment.ownerAddress).toScVal(),
      ],
      "write",
    );

    // Increment successful actions counter on successful settlement
    const countersAdapter = getCountersAdapter();
    void countersAdapter.incrementSuccessfulActions(); // Fire and forget for metrics

    void cache.delete(CacheKey.commitment(params.commitmentId));
    if (commitment.ownerAddress) {
      void cache.delete(CacheKey.userCommitments(commitment.ownerAddress));
    }

    // Parse the settlement result
    const result = asRecord(invocation.value);
    const settlementAmount = asString(result.settlementAmount, "0");
    const finalStatus = asString(result.finalStatus, "SETTLED");

    return {
      settlementAmount,
      finalStatus,
      txHash: invocation.txHash,
      reference: invocation.txHash
        ? undefined
        : "TODO_CHAIN_CALL_SETTLE_COMMITMENT",
    };
  } catch (error) {
    // Increment chain failures counter on blockchain operation failures
    const countersAdapter = getCountersAdapter();
    void countersAdapter.incrementChainFailures(); // Fire and forget for metrics

    throw normalizeContractError(error, {
      code: "BLOCKCHAIN_CALL_FAILED",
      message: "Unable to settle commitment on chain.",
      status: 502,
      details: {
        method: "settle_commitment",
        commitmentId: params.commitmentId,
      },
    });
  }
}
