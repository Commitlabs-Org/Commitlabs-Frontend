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
  | "CREATED"
  | "ACTIVE"
  | "SETTLED"
  | "VIOLATED"
  | "EARLY_EXIT"
  | "DISPUTED"
  | "UNKNOWN";

export interface CreateCommitmentOnChainParams {
  ownerAddress: string;
  asset: string;
  amount: string;
  durationDays: number;
  maxLossBps: number;
  metadata?: Record<string, unknown>;
}

export interface LoggingContext {
  requestId?: string;
  commitmentId?: string;
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
  contractVersion?: string;
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

export interface DisputeOnChainParams {
  commitmentId: string;
  reason: string;
  evidence?: string;
  callerAddress: string;
}

export interface DisputeOnChainResult {
  commitmentId: string;
  disputeId: string;
  status: string;
  txHash?: string;
  disputedAt: string;
}

export interface ResolveDisputeOnChainParams {
  commitmentId: string;
  resolution: "resolved_in_favor_of_owner" | "resolved_in_favor_of_counterparty" | "dismissed";
  notes?: string;
  resolverAddress: string;
}

export interface ResolveDisputeOnChainResult {
  commitmentId: string;
  disputeId: string;
  resolution: string;
  finalStatus: string;
  txHash?: string;
  resolvedAt: string;
}

export interface EarlyExitCommitmentOnChainParams {
  commitmentId: string;
  callerAddress?: string;
}

export interface EarlyExitCommitmentOnChainResult {
  exitAmount: string;
  penaltyAmount: string;
  finalStatus: string;
  txHash?: string;
  reference?: string;
}

type ContractCallMode = "read" | "write";
interface ContractInvocationResult {
  value: unknown;
  txHash?: string;
  version?: string;
}

/**
 * Scaling factor for compliance scores sent to/from the blockchain.
 * Compliance scores are stored on-chain as integers in the range [0, 100]
 * to avoid floating-point precision issues. When writing to the chain,
 * scores are divided by this scale; when reading from the chain, they
 * are multiplied by this scale to restore the original value.
 *
 * Example: A compliance score of 85 is stored as 0.85 on-chain,
 * and read back as 85 in the application.
 */
const ANALYTICS_SCALE = 100;

function getRpcUrl(): string {
  return getBackendConfig().sorobanRpcUrl;
}

function getNetworkPassphrase(): string {
  return getBackendConfig().networkPassphrase;
}

function getRpcTimeoutMs(): number {
  const raw = Number(process.env.SOROBAN_RPC_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 15_000;
}

async function withRpcTimeout<T>(
  promise: Promise<T>,
  methodName: string,
): Promise<T> {
  const timeoutMs = getRpcTimeoutMs();
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(
            new BackendError({
              code: "GATEWAY_TIMEOUT",
              message:
                "The blockchain operation timed out. It may still be processed later.",
              status: 504,
              details: {
                methodName,
                timeoutMs,
                retryable: true,
              },
            }),
          );
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
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

function getRpcTimeoutMs(): number {
  const raw = Number(process.env.SOROBAN_RPC_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 15_000;
}

async function withRpcTimeout<T>(
  operation: Promise<T>,
  methodName: string,
  timeoutMs = getRpcTimeoutMs(),
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(
            new BackendError({
              code: "GATEWAY_TIMEOUT",
              message: "The blockchain operation timed out. It may still be processed later.",
              status: 504,
              details: {
                methodName,
                timeoutMs,
                retryable: true,
              },
            }),
          );
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
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
    raw === "CREATED" ||
    raw === "ACTIVE" ||
    raw === "SETTLED" ||
    raw === "VIOLATED" ||
    raw === "EARLY_EXIT" ||
    raw === "DISPUTED"
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

// ---------------------------------------------------------------------------
// Retry-with-backoff for read-mode Soroban calls
//
// Transient RPC failures (429 / 503 / 504 / timeouts) on *read* calls are safe
// to retry because reads are idempotent — re-running one cannot change on-chain
// state. Write transactions are NEVER retried here: re-submitting a signed
// transaction risks double execution. The retry path is therefore exposed only
// through `invokeReadContractMethod`, whose call mode is hard-coded to "read".
//
// Both the attempt count and the cumulative backoff are bounded so that a flaky
// endpoint cannot stall a request indefinitely.
// ---------------------------------------------------------------------------

/** Async sleep helper. Injectable so unit tests run without real timers. */
export type SleepFn = (ms: number) => Promise<void>;

const defaultSleep: SleepFn = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** Tunables for {@link retryWithBackoff}. */
export interface RetryOptions {
  /** Total attempts, including the first. Coerced to at least 1. */
  maxAttempts: number;
  /** Delay used to seed the first backoff, in milliseconds. */
  baseDelayMs: number;
  /** Hard ceiling for any single backoff delay, in milliseconds. */
  maxDelayMs: number;
  /** Hard ceiling for the sum of all backoff delays in a single call. */
  maxTotalBackoffMs: number;
  /** Growth factor applied to the delay ceiling after each failed attempt. */
  backoffMultiplier: number;
  /** Returns true when an error is a transient failure worth retrying. */
  isRetryable: (error: unknown) => boolean;
  /** Random source in [0, 1) used for jitter. Injectable for tests. */
  random?: () => number;
  /** Sleep implementation. Injectable for tests. */
  sleep?: SleepFn;
  /** Observability hook fired immediately before each backoff sleep. */
  onRetry?: (info: {
    attempt: number;
    delayMs: number;
    error: unknown;
  }) => void;
}

/**
 * Runs `operation` and retries it with bounded exponential backoff for as long
 * as it keeps failing with a *retryable* error.
 *
 * Guarantees:
 * - Bounded work: at most `maxAttempts` invocations and at most
 *   `maxTotalBackoffMs` of cumulative sleeping, so a failing dependency can
 *   never stall the caller indefinitely.
 * - Non-retryable errors are re-thrown on first occurrence, untouched.
 * - The error from the final attempt is re-thrown unchanged, so the caller's
 *   existing error handling (normalization, failure metrics) is unaffected.
 * - No side effects of its own: it does not log or emit metrics. The caller
 *   decides what happens once retries are exhausted.
 *
 * Backoff uses "equal jitter" (half fixed, half random) so that many concurrent
 * callers — e.g. parallel per-commitment reads — do not retry in lock-step and
 * stampede the RPC endpoint.
 */
export async function retryWithBackoff<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const random = options.random ?? Math.random;
  const sleep = options.sleep ?? defaultSleep;
  const maxAttempts = Math.max(1, Math.floor(options.maxAttempts));

  let totalBackoffMs = 0;

  for (let attempt = 1; ; attempt += 1) {
    try {
      // The operation receives the 1-based attempt number so lower layers can
      // enforce per-attempt invariants (see assertRetrySafe).
      return await operation(attempt);
    } catch (error) {
      const isLastAttempt = attempt >= maxAttempts;
      if (isLastAttempt || !options.isRetryable(error)) {
        throw error;
      }

      // Exponential growth, capped per attempt, then jittered.
      const ceiling = Math.min(
        options.baseDelayMs * options.backoffMultiplier ** (attempt - 1),
        options.maxDelayMs,
      );
      const delayMs = ceiling / 2 + random() * (ceiling / 2);

      // Honour the cumulative backoff budget: rather than stalling, stop and
      // surface the error if the next sleep would exceed it.
      if (totalBackoffMs + delayMs > options.maxTotalBackoffMs) {
        throw error;
      }
      totalBackoffMs += delayMs;

      options.onRetry?.({ attempt, delayMs, error });
      await sleep(delayMs);
    }
  }
}

/**
 * Bounded retry policy applied to read-mode Soroban calls only. Worst-case
 * added latency is roughly `maxTotalBackoffMs` on top of the time spent in the
 * failed attempts themselves. These values are intentionally conservative:
 * they absorb brief RPC hiccups, not sustained outages.
 */
const READ_RETRY_CONFIG = {
  maxAttempts: 3,
  baseDelayMs: 200,
  maxDelayMs: 2_000,
  maxTotalBackoffMs: 4_000,
  backoffMultiplier: 2,
} as const;

/**
 * Decides whether a failed Soroban call is a *transient* failure worth
 * retrying. It reuses the retryable classification produced by
 * {@link normalizeContractError} (429 / 503 / 504 / timeouts and generic
 * gateway errors), so there is a single source of truth. Deterministic
 * failures — 404 (not found) and 400 (validation) — are never retried.
 */
export function isRetryableContractError(error: unknown): boolean {
  if (error instanceof BackendError && error.code === "GATEWAY_TIMEOUT") {
    return false;
  }

  const normalized = normalizeContractError(error, {
    code: "BLOCKCHAIN_CALL_FAILED",
    message: "Soroban read call failed.",
    status: 502,
    details: {},
  });
  return asRecord(normalized.details).retryable === true;
}

/**
 * Guard against retrying write transactions.
 *
 * Read calls are idempotent and may safely run multiple times. A write
 * transaction must be submitted exactly once: retrying it (attempt > 1) risks
 * a double submission. This invariant is enforced at the lowest level — inside
 * {@link invokeContractMethod} — so it holds regardless of how a call is wired
 * up. If the invariant is ever violated by a future change, this throws a
 * non-retryable error *before* any transaction is submitted, converting a
 * silent double-spend into a loud, safe failure.
 *
 * Exported so the guard can be unit tested directly.
 */
export function assertRetrySafe(mode: ContractCallMode, attempt: number): void {
  if (attempt > 1 && mode !== "read") {
    throw new BackendError({
      code: "BLOCKCHAIN_CALL_FAILED",
      message: "Internal error: write transactions must never be retried.",
      status: 500,
      details: { mode, attempt },
    });
  }
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
    complianceScore: asNumber(raw.complianceScore ?? raw.compliance_score) * ANALYTICS_SCALE,
    currentValue: asString(
      raw.currentValue ?? raw.current_value ?? raw.amount,
      "0",
    ),
    feeEarned: asString(raw.feeEarned ?? raw.fees_earned, "0"),
    violationCount: asNumber(raw.violationCount ?? raw.violation_count),
    createdAt: asString(raw.createdAt ?? raw.created_at) || undefined,
    expiresAt: asString(raw.expiresAt ?? raw.expires_at) || undefined,
    contractVersion: (getBackendConfig() as { activeVersion?: string }).activeVersion,
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
    complianceScore: asNumber(raw.complianceScore ?? raw.compliance_score) * ANALYTICS_SCALE,
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

function getRpcTimeoutMs(): number {
  const raw = process.env.SOROBAN_RPC_TIMEOUT_MS;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15_000;
}

function withRpcTimeout<T>(
  promise: Promise<T>,
  methodName: string,
  timeoutMs = getRpcTimeoutMs(),
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new BackendError({
          code: "GATEWAY_TIMEOUT",
          message: "The blockchain operation timed out. It may still be processed later.",
          status: 504,
          details: {
            methodName,
            timeoutMs,
            retryable: true,
          },
        }),
      );
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function waitForTransactionResult(
  server: SorobanRpc.Server,
  hash: string,
  timeoutMs = 15_000,
): Promise<unknown> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const tx = await withRpcTimeout(
      server.getTransaction(hash),
      "getTransaction",
      timeoutMs,
    );
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
  attempt = 1,
): Promise<ContractInvocationResult> {
  // Guard: a write transaction must be submitted exactly once. Retrying one
  // (attempt > 1) risks a double submission, so it is rejected before any
  // network work is performed. Direct (non-retried) calls always pass
  // attempt = 1 and are unaffected.
  assertRetrySafe(mode, attempt);

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
      ? await withRpcTimeout(
          server.getAccount(sourcePublicKey),
          `${methodName}.getAccount`,
        )
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

  const simulation = await withRpcTimeout(
    server.simulateTransaction(tx),
    `${methodName}.simulateTransaction`,
  );
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
      version: getBackendConfig().activeVersion,
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

  const preparedTx = await withRpcTimeout(
    server.prepareTransaction(tx),
    `${methodName}.prepareTransaction`,
  );
  preparedTx.sign(sourceKeypair);
  const sendResult = await withRpcTimeout(
    server.sendTransaction(preparedTx),
    "sendTransaction",
  );
  const txHash = sendResult.hash;

  const onChainValue = await waitForTransactionResult(server, txHash);
  return { value: onChainValue, txHash, version: getBackendConfig().activeVersion };
}

/**
 * Read-only counterpart of {@link invokeContractMethod} that adds bounded
 * retry-with-exponential-backoff for transient RPC failures.
 *
 * Use this for ALL read-mode contract calls. The call mode is hard-coded to
 * "read", so a write transaction can never be submitted — let alone
 * re-submitted — through this path. Write calls must keep calling
 * `invokeContractMethod(..., "write")` directly so each runs exactly once.
 *
 * Only failures classified retryable by {@link isRetryableContractError} are
 * retried; attempts and total backoff are capped by {@link READ_RETRY_CONFIG}.
 * The final error is propagated unchanged, so a caller's `incrementChainFailures`
 * runs exactly once, only after retries are exhausted.
 */
async function invokeReadContractMethod(
  contractId: string,
  methodName: string,
  params: unknown[],
): Promise<ContractInvocationResult> {
  return retryWithBackoff(
    (attempt) =>
      invokeContractMethod(contractId, methodName, params, "read", attempt),
    {
      ...READ_RETRY_CONFIG,
      isRetryable: (error) =>
        !(
          error instanceof BackendError &&
          error.code === "GATEWAY_TIMEOUT" &&
          asRecord(error.details).timeoutMs !== undefined
        ) && isRetryableContractError(error),
      onRetry: ({ attempt, delayMs, error }) => {
        logInfo(undefined, "[soroban] retrying read after transient failure", {
          methodName,
          attempt,
          delayMs: Math.round(delayMs),
          error: error instanceof Error ? error.message : String(error),
        });
      },
    },
  );
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
  loggingContext?: LoggingContext,
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
  loggingContext?: LoggingContext,
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
      logInfo(loggingContext?.requestId, "[cache] hit commitment", { commitmentId });
      return cached;
    }
    logInfo(loggingContext?.requestId, "[cache] miss commitment", { commitmentId });

    // Read call: wrapped with bounded retry-and-backoff for transient failures.
    const invocation = await invokeReadContractMethod(
      getContractId("commitmentCore"),
      "get_commitment",
      [commitmentId],
    );

    // Increment successful actions counter on successful chain read
    const countersAdapter = getCountersAdapter();
    void countersAdapter.incrementSuccessfulActions(); // Fire and forget for metrics

    const commitment = {
      ...parseChainCommitment(invocation.value),
      contractVersion: invocation.version ?? getBackendConfig().activeVersion,
    };
    await cache.set(cacheKey, commitment, CacheTTL.COMMITMENT_DETAIL);
    return commitment;
  } catch (error) {
    // Increment chain failures counter on blockchain operation failures.
    // Reached only after read retries (if any) have been exhausted.
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
  loggingContext?: LoggingContext,
): Promise<ChainCommitment[]> {
  try {
    validateOwnerAddress(ownerAddress);

    const cacheKey = CacheKey.userCommitments(ownerAddress);
    const cached = await cache.get<ChainCommitment[]>(cacheKey);
    if (cached !== null) {
      logInfo(loggingContext?.requestId, "[cache] hit user-commitments", { ownerAddress });
      return cached;
    }
    logInfo(loggingContext?.requestId, "[cache] miss user-commitments", { ownerAddress });

    const contractId = getContractId("commitmentCore");

    try {
      // Optimistic probe. `get_user_commitments` may not exist on every
      // deployed contract, and its failure is expected and handled by the
      // id-based fallback below — so it is deliberately NOT retried. Retrying
      // an expected failure would only add latency. Genuine transient errors
      // are still covered: the fallback `get_user_commitment_ids` read and the
      // per-id `getCommitmentFromChain` reads each go through
      // `invokeReadContractMethod` and so are retried.
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

    // Read call: wrapped with bounded retry-and-backoff for transient failures.
    const idsResult = await invokeReadContractMethod(
      contractId,
      "get_user_commitment_ids",
      [ownerAddress],
    );
    const commitmentIds = Array.isArray(idsResult.value)
      ? idsResult.value.map((id) => asString(id)).filter(Boolean)
      : [];
    const commitments = await Promise.all(
      commitmentIds.map((commitmentId) => getCommitmentFromChain(commitmentId, loggingContext)),
    );

    await cache.set(cacheKey, commitments, CacheTTL.USER_COMMITMENTS);
    // Increment successful actions counter on successful chain read
    const countersAdapter = getCountersAdapter();
    void countersAdapter.incrementSuccessfulActions();
    return commitments;
  } catch (error) {
    // Increment chain failures counter on blockchain operation failures.
    // Reached only after read retries (if any) have been exhausted.
    const countersAdapter = getCountersAdapter();
    void countersAdapter.incrementChainFailures();

    throw normalizeContractError(error, {
      code: "BLOCKCHAIN_CALL_FAILED",
      message: "Unable to fetch user commitments from chain.",
      status: 502,
      details: { method: "get_user_commitments", ownerAddress, requestId: loggingContext?.requestId },
    });
  }
}

export async function recordAttestationOnChain(
  params: RecordAttestationOnChainParams,
  loggingContext?: LoggingContext,
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

    // Add logging context to payload if needed
    const eventPayload = { ...params, requestId: loggingContext?.requestId };
    // (Potentially emit an event here)

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
  loggingContext?: LoggingContext,
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
    const commitment = await getCommitmentFromChain(params.commitmentId, loggingContext);

    // Check if commitment is matured (expired or can be settled)
    if (commitment.status === "SETTLED") {
      throw new BackendError({
        code: "CONFLICT" as BackendErrorCode,
        message: "Commitment has already been settled.",
        status: 409,
      });
    }

    if (commitment.status === "ACTIVE") {
      // Invariant: An active commitment can only be settled if it has matured.
      // If expiresAt is present, we check if the current time is past the expiry time.
      // If expiresAt is missing, we err on the side of safety and block settlement
      // to prevent un-matured commitments from being settled prematurely.
      if (commitment.expiresAt) {
        const expiryTime = new Date(commitment.expiresAt).getTime();
        const now = new Date().getTime();
        if (now < expiryTime) {
          throw new BackendError({
            code: "NOT_MATURED",
            message: "Commitment has not matured yet and cannot be settled.",
            status: 400,
          });
        }
      } else {
        throw new BackendError({
          code: "NOT_MATURED",
          message: "Commitment maturity information is missing. Cannot settle.",
          status: 400,
        });
      }
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
        requestId: loggingContext?.requestId,
      },
    });
  }
}

export async function fundEscrowOnChain(
  params: FundEscrowOnChainParams,
): Promise<FundEscrowOnChainResult> {
  try {
    if (!params.commitmentId) {
      throw new BackendError({
        code: "BAD_REQUEST",
        message: "Missing commitment id for funding.",
        status: 400,
      });
    }

    if (params.callerAddress) {
      validateOwnerAddress(params.callerAddress);
    }

    const commitment = await getCommitmentFromChain(params.commitmentId);

    if (!commitment) {
      throw new BackendError({
        code: "NOT_FOUND",
        message: "Commitment not found.",
        status: 404,
        details: { commitmentId: params.commitmentId },
      });
    }

    if (commitment.status !== "CREATED") {
      throw new BackendError({
        code: "CONFLICT",
        message: "Only created commitments can be funded.",
        status: 409,
        details: { commitmentId: params.commitmentId, status: commitment.status },
      });
    }

    const callerAddress = params.callerAddress ?? commitment.ownerAddress;
    if (!callerAddress || callerAddress !== commitment.ownerAddress) {
      throw new BackendError({
        code: "FORBIDDEN",
        message: "Only the commitment owner may fund this commitment.",
        status: 403,
        details: { commitmentId: params.commitmentId, callerAddress },
      });
    }

    const invocation = await invokeContractMethod(
      getContractId("commitmentCore"),
      "fund_escrow",
      [
        nativeToScVal(params.commitmentId),
        new Address(callerAddress).toScVal(),
      ],
      "write",
    );

    const countersAdapter = getCountersAdapter();
    void countersAdapter.incrementSuccessfulActions();

    void cache.delete(CacheKey.commitment(params.commitmentId));
    if (commitment.ownerAddress) {
      void cache.delete(CacheKey.userCommitments(commitment.ownerAddress));
    }

    return {
      commitmentId: params.commitmentId,
      txHash: invocation.txHash,
      contractVersion: invocation.version,
      reference: invocation.txHash ? undefined : "TODO_CHAIN_CALL_FUND_ESCROW",
    };
  } catch (error) {
    const countersAdapter = getCountersAdapter();
    void countersAdapter.incrementChainFailures();

    throw normalizeBackendError(error, {
      code: "BLOCKCHAIN_CALL_FAILED",
      message: "Unable to fund escrow on chain.",
      status: 502,
      details: {
        method: "fund_escrow",
        commitmentId: params.commitmentId,
      },
    });
  }
}

export async function earlyExitCommitmentOnChain(
  params: EarlyExitCommitmentOnChainParams,
  loggingContext?: LoggingContext,
): Promise<EarlyExitCommitmentOnChainResult> {
  try {
    if (!params.commitmentId) {
      throw new BackendError({
        code: "BAD_REQUEST",
        message: "Missing commitment id for early exit.",
        status: 400,
      });
    }

    const commitment = await getCommitmentFromChain(params.commitmentId, loggingContext);

    if (commitment.status === "SETTLED") {
      throw new BackendError({
        code: "CONFLICT",
        message:
          "Commitment has already been settled and cannot be exited early.",
        status: 409,
      });
    }

    if (commitment.status === "EARLY_EXIT") {
      throw new BackendError({
        code: "CONFLICT",
        message: "Commitment has already been exited early.",
        status: 409,
      });
    }

    if (commitment.status === "VIOLATED") {
      throw new BackendError({
        code: "CONFLICT",
        message: "Commitment has been violated and cannot be exited early.",
        status: 409,
      });
    }

    const invocation = await invokeContractMethod(
      getContractId("commitmentCore"),
      "early_exit_commitment",
      [params.commitmentId, params.callerAddress ?? commitment.ownerAddress],
      "write",
    );

    const result = asRecord(invocation.value);
    const exitAmount = asString(result.exitAmount, "0");
    const penaltyAmount = asString(result.penaltyAmount, "0");
    const finalStatus = asString(result.finalStatus, "EARLY_EXIT");

    return {
      exitAmount,
      penaltyAmount,
      finalStatus,
      txHash: invocation.txHash,
      contractVersion: invocation.version,
      reference: invocation.txHash ? undefined : `TODO_CHAIN_CALL_EARLY_EXIT`,
    };
  } catch (error) {
    throw normalizeContractError(error, {
      code: "BLOCKCHAIN_CALL_FAILED",
      message: "Unable to exit commitment early on chain.",
      status: 502,
      details: {
        method: "early_exit_commitment",
        commitmentId: params.commitmentId,
      },
    });
  }
}

export async function openDisputeOnChain(
  params: DisputeOnChainParams,
): Promise<DisputeOnChainResult> {
  try {
    if (!params.commitmentId) {
      throw new BackendError({
        code: "BAD_REQUEST",
        message: "Missing commitment id for dispute.",
        status: 400,
      });
    }

    const commitment = await getCommitmentFromChain(params.commitmentId);

    if (commitment.status === "SETTLED" || commitment.status === "EARLY_EXIT") {
      throw new BackendError({
        code: "CONFLICT",
        message: "Cannot dispute a commitment that is already settled or exited.",
        status: 409,
      });
    }

    if (commitment.status === "DISPUTED") {
      throw new BackendError({
        code: "CONFLICT",
        message: "Commitment is already in dispute.",
        status: 409,
      });
    }

    const invocation = await invokeContractMethod(
      getContractId("commitmentCore"),
      "early_exit_commitment",
      [params.commitmentId, params.callerAddress ?? commitment.ownerAddress],
      "write",
    );

    const result = asRecord(invocation.value);
    const exitAmount = asString(result.exitAmount, "0");
    const penaltyAmount = asString(result.penaltyAmount, "0");
    const finalStatus = asString(result.finalStatus, "EARLY_EXIT");

    await cache.delete(CacheKey.commitment(params.commitmentId));
    if (commitment.ownerAddress) {
      await cache.delete(CacheKey.userCommitments(commitment.ownerAddress));
    }

    return {
      exitAmount,
      penaltyAmount,
      finalStatus,
      txHash: invocation.txHash,
      reference: invocation.txHash ? undefined : "TODO_CHAIN_CALL_EARLY_EXIT",
    };
  } catch (error) {
    throw normalizeContractError(error, {
      code: "BLOCKCHAIN_CALL_FAILED",
      message: "Unable to exit commitment early on chain.",
      status: 502,
      details: {
        method: "early_exit_commitment",
        commitmentId: params.commitmentId,
      },
    });
  }
}

export async function resolveDisputeOnChain(
  params: ResolveDisputeOnChainParams,
): Promise<ResolveDisputeOnChainResult> {
  try {
    if (!params.commitmentId) {
      throw new BackendError({
        code: "BAD_REQUEST",
        message: "Missing commitment id for dispute resolution.",
        status: 400,
      });
    }

    const commitment = await getCommitmentFromChain(params.commitmentId);

    if (commitment.status !== "DISPUTED") {
      throw new BackendError({
        code: "CONFLICT",
        message: "Can only resolve a commitment that is currently in dispute.",
        status: 409,
      });
    }

    const invocation = await invokeContractMethod(
      getContractId("commitmentCore"),
      "resolve_dispute",
      [params.commitmentId, params.resolution, params.notes ?? ""],
      "write",
    );

    const result = asRecord(invocation.value);
    const disputeId = asString(result.disputeId ?? result.id);
    const finalStatus = asString(result.finalStatus, "ACTIVE");

    // Status changed — invalidate detail and owner list.
    await cache.delete(CacheKey.commitment(params.commitmentId));
    if (commitment.ownerAddress) {
      await cache.delete(CacheKey.userCommitments(commitment.ownerAddress));
    }
    logInfo(undefined, "[cache] invalidated commitment after dispute resolution", {
      commitmentId: params.commitmentId,
    });

    return {
      commitmentId: params.commitmentId,
      disputeId: disputeId || `dsp-${params.commitmentId}`,
      resolution: params.resolution,
      finalStatus,
      txHash: invocation.txHash,
      resolvedAt: new Date().toISOString(),
    };
  } catch (error) {
    throw normalizeBackendError(error, {
      code: "BLOCKCHAIN_CALL_FAILED",
      message: "Unable to resolve dispute on chain.",
      status: 502,
      details: {
        method: "resolve_dispute",
        commitmentId: params.commitmentId,
        requestId: loggingContext?.requestId,
      },
    });
  }
}
