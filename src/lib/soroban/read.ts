import {
  Account,
  Contract,
  nativeToScVal,
  rpc,
  scValToNative,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk';
import { getActiveConfig } from '../config';
import { EscrowErrorCode, toTxError, TxError } from './errors';

export const MAX_U64 = 18446744073709551615n;

export interface ValidationResult {
  valid: boolean;
  error?: string;
  value?: bigint;
}

/**
 * Validates a commitment ID string as an unsigned 64-bit integer (u64).
 * Returns without invoking any RPC or network call.
 */
export function validateCommitmentId(id: string): ValidationResult {
  const trimmed = (id ?? '').trim();
  if (!trimmed) {
    return { valid: false, error: 'Commitment ID cannot be empty.' };
  }
  if (!/^\d+$/.test(trimmed)) {
    return {
      valid: false,
      error: `Invalid commitment ID "${id}". Commitment ID must be a non-negative integer (e.g. 0, 1, 42).`,
    };
  }
  try {
    const val = BigInt(trimmed);
    if (val < 0n || val > MAX_U64) {
      return {
        valid: false,
        error: `Commitment ID "${id}" is out of range. Allowed values are 0 to 18,446,744,073,709,551,615 (u64).`,
      };
    }
    return { valid: true, value: val };
  } catch {
    return { valid: false, error: `Invalid commitment ID "${id}". Could not parse as u64.` };
  }
}

export type RiskProfileName = 'Safe' | 'Balanced' | 'Aggressive' | string;
export type EscrowStatusName =
  | 'Created'
  | 'Funded'
  | 'Released'
  | 'Refunded'
  | 'Disputed'
  | 'Violated'
  | 'Cancelled'
  | string;

export interface OnChainCommitment {
  id: string;
  owner: string;
  asset: string;
  amount: bigint;
  accruedYield: bigint;
  risk: RiskProfileName;
  status: EscrowStatusName;
  maturity: bigint; // timestamp in seconds
  penaltyBps: number;
  complianceScore: number;
  createdAt: bigint; // timestamp in seconds
  metadata: Record<string, string>;
}

export interface OnChainAttestation {
  attestor: string;
  complianceScore: number;
  timestamp: bigint; // timestamp in seconds
}

export interface OnChainDispute {
  reasonCategory: string;
  reasonCode: number;
  reasonText: string;
  disputedAt: bigint; // timestamp in seconds
  disputedBy: string;
}

type SimulationServer = Pick<rpc.Server, 'simulateTransaction'>;

export interface ReadOptions {
  server?: SimulationServer;
  contractId?: string;
}

export type RawCommitment = Record<string, unknown> & {
  id?: unknown;
  owner?: unknown;
  asset?: unknown;
  amount?: unknown;
  accrued_yield?: unknown;
  accruedYield?: unknown;
  risk?: unknown;
  status?: unknown;
  maturity?: unknown;
  penalty_bps?: unknown;
  penaltyBps?: unknown;
  compliance_score?: unknown;
  complianceScore?: unknown;
  created_at?: unknown;
  createdAt?: unknown;
  metadata?: unknown;
};

export type RawAttestation = Record<string, unknown> & {
  attestor?: unknown;
  compliance_score?: unknown;
  complianceScore?: unknown;
  timestamp?: unknown;
};

export type RawDispute = Record<string, unknown> & {
  reason_category?: unknown;
  reasonCategory?: unknown;
  reason_text?: unknown;
  reasonText?: unknown;
  disputed_at?: unknown;
  disputedAt?: unknown;
  disputed_by?: unknown;
  disputedBy?: unknown;
};

const DISPUTE_REASON_NAMES: Record<number, string> = {
  0: 'Value Mismatch',
  1: 'Non-Compliance',
  2: 'Fraud Suspicion',
  3: 'Operational Failure',
  4: 'Other',
};

function isRecord<T extends Record<string, unknown> = Record<string, unknown>>(
  value: unknown,
): value is T {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMap(value: unknown): value is Map<unknown, unknown> {
  return value instanceof Map;
}

function normalizeEnumString(val: unknown, fallback: string): string {
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) {
    const values: unknown[] = val;
    if (values.length > 0 && typeof values[0] === 'string') return values[0];
  }
  if (isRecord(val)) {
    if ('name' in val && typeof val.name === 'string') return val.name;
    const keys = Object.keys(val);
    if (keys.length > 0) return keys[0];
  }
  return fallback;
}

function normalizeMetadata(raw: unknown): Record<string, string> {
  if (!raw) return {};
  if (isMap(raw)) {
    const res: Record<string, string> = {};
    for (const [k, v] of raw.entries()) {
      res[String(k)] = String(v);
    }
    return res;
  }
  if (Array.isArray(raw)) {
    const res: Record<string, string> = {};
    const items: unknown[] = raw;
    for (const item of items) {
      if (Array.isArray(item)) {
        const tuple: unknown[] = item;
        if (tuple.length >= 2) res[String(tuple[0])] = String(tuple[1]);
      } else if (isRecord(item) && 'key' in item && 'val' in item) {
        res[String(item.key)] = String(item.val);
      }
    }
    return res;
  }
  if (isRecord(raw)) {
    const res: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      res[k] = String(v);
    }
    return res;
  }
  return {};
}

export function normalizeCommitment(raw: unknown): OnChainCommitment {
  if (raw === null || raw === undefined) {
    throw new TypeError('Expected a commitment record');
  }
  const commitment = isRecord<RawCommitment>(raw) ? raw : {};
  return {
    id: String(commitment.id ?? '0'),
    owner: String(commitment.owner ?? ''),
    asset: String(commitment.asset ?? ''),
    amount:
      typeof commitment.amount === 'bigint' ? commitment.amount : BigInt(commitment.amount ?? 0),
    accruedYield:
      typeof commitment.accrued_yield === 'bigint'
        ? commitment.accrued_yield
        : typeof commitment.accruedYield === 'bigint'
          ? commitment.accruedYield
          : BigInt(commitment.accrued_yield ?? commitment.accruedYield ?? 0),
    risk: normalizeEnumString(commitment.risk, 'Balanced'),
    status: normalizeEnumString(commitment.status, 'Created'),
    maturity:
      typeof commitment.maturity === 'bigint'
        ? commitment.maturity
        : BigInt(commitment.maturity ?? 0),
    penaltyBps: Number(commitment.penalty_bps ?? commitment.penaltyBps ?? 0),
    complianceScore: Number(commitment.compliance_score ?? commitment.complianceScore ?? 100),
    createdAt:
      typeof commitment.created_at === 'bigint'
        ? commitment.created_at
        : typeof commitment.createdAt === 'bigint'
          ? commitment.createdAt
          : BigInt(commitment.created_at ?? commitment.createdAt ?? 0),
    metadata: normalizeMetadata(commitment.metadata),
  };
}

export function normalizeAttestation(raw: unknown): OnChainAttestation {
  if (raw === null || raw === undefined) {
    throw new TypeError('Expected an attestation record');
  }
  const attestation = isRecord<RawAttestation>(raw) ? raw : {};
  return {
    attestor: String(attestation.attestor ?? ''),
    complianceScore: Number(attestation.compliance_score ?? attestation.complianceScore ?? 0),
    timestamp:
      typeof attestation.timestamp === 'bigint'
        ? attestation.timestamp
        : BigInt(attestation.timestamp ?? 0),
  };
}

export function normalizeDispute(raw: unknown): OnChainDispute | null {
  if (!raw || (typeof raw === 'object' && Object.keys(raw).length === 0)) {
    return null;
  }
  const dispute = isRecord<RawDispute>(raw) ? raw : {};
  let code = 4;
  let category = 'Other';
  const rawCat = dispute.reason_category ?? dispute.reasonCategory;
  if (typeof rawCat === 'bigint' || typeof rawCat === 'number') {
    code = Number(rawCat);
    category = DISPUTE_REASON_NAMES[code] ?? `Category #${code}`;
  } else if (typeof rawCat === 'string') {
    category = rawCat;
  } else if (Array.isArray(rawCat)) {
    const categories: unknown[] = rawCat;
    if (typeof categories[0] === 'string') category = categories[0];
  }

  return {
    reasonCategory: category,
    reasonCode: code,
    reasonText: String(dispute.reason_text ?? dispute.reasonText ?? ''),
    disputedAt:
      typeof dispute.disputed_at === 'bigint'
        ? dispute.disputed_at
        : typeof dispute.disputedAt === 'bigint'
          ? dispute.disputedAt
          : BigInt(dispute.disputed_at ?? dispute.disputedAt ?? 0),
    disputedBy: String(dispute.disputed_by ?? dispute.disputedBy ?? ''),
  };
}

export function isNotFoundError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof TxError && err.code === EscrowErrorCode.NotFound) return true;
  if (isRecord(err) && err.code === EscrowErrorCode.NotFound) {
    return true;
  }
  const msg = err instanceof Error ? err.message : String(err);
  return /not\s*found|#3\b|contract.*?3\b/i.test(msg);
}

function resolveServerAndContract(
  optionsOrServer?: ReadOptions | SimulationServer,
  explicitContractId?: string,
): { server: rpc.Server | { simulateTransaction: (tx: any) => Promise<any> }; contractId: string } {
  const config = getActiveConfig();
  let server: rpc.Server | { simulateTransaction: (tx: any) => Promise<any> };
  let contractId = explicitContractId || config.escrowContractId;
): { server: SimulationServer; contractId: string } {
  let server: SimulationServer;
  let contractId = explicitContractId || ESCROW_CONTRACT_ID;

  if (isRecord(optionsOrServer) && typeof optionsOrServer.simulateTransaction === 'function') {
    server = optionsOrServer;
  } else if (optionsOrServer && typeof optionsOrServer === 'object') {
    const opts = optionsOrServer as ReadOptions;
    server = opts.server || new rpc.Server(config.sorobanRpcUrl);
    if (opts.contractId) contractId = opts.contractId;
  } else {
    server = new rpc.Server(config.sorobanRpcUrl);
  }

  if (!contractId && !explicitContractId) {
    // If testing with a custom server without an explicit contract, supply dummy contract
    if (optionsOrServer) {
      contractId = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM';
    }
  }

  return { server, contractId };
}

/**
 * Simulates a read-only invocation on the escrow contract.
 */
export async function simulateEscrowRead(
  functionName: string,
  args: xdr.ScVal[],
  optionsOrServer?: ReadOptions | SimulationServer,
  contractIdOverride?: string,
): Promise<unknown> {
  const { server, contractId } = resolveServerAndContract(optionsOrServer, contractIdOverride);

  if (!contractId) {
    throw new Error('Escrow contract is not configured. Set NEXT_PUBLIC_ESCROW_CONTRACT_ID.');
  }

  const dummyAccount = new Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '0');
  const contract = new Contract(contractId);
  const tx = new TransactionBuilder(dummyAccount, {
    fee: '100',
    networkPassphrase: getActiveConfig().passphrase,
  })
    .addOperation(contract.call(functionName, ...args))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);

  // Check for simulation errors
  if (isRecord(sim) && ('error' in sim || 'diagnostics' in sim)) {
    if (
      sim.error ||
      (Array.isArray(sim.diagnostics) && sim.diagnostics.length > 0 && !('result' in sim))
    ) {
      throw toTxError(sim);
    }
  }

  let retvalScVal: xdr.ScVal | undefined;

  if (isRecord(sim)) {
    if (isRecord(sim.result) && sim.result.retval instanceof xdr.ScVal) {
      retvalScVal = sim.result.retval;
    } else if (Array.isArray(sim.results)) {
      const results: unknown[] = sim.results;
      if (isRecord(results[0]) && typeof results[0].xdr === 'string' && results[0].xdr) {
        retvalScVal = xdr.ScVal.fromXDR(results[0].xdr, 'base64');
      }
    }
  }

  if (!retvalScVal) {
    if (isRecord(sim) && 'error' in sim) {
      throw toTxError(sim);
    }
    return null;
  }

  return scValToNative(retvalScVal);
}

/**
 * Reads a single commitment by u64 ID. Throws on NotFound or network error.
 */
export async function getCommitment(
  id: string | bigint,
  optionsOrServer?: ReadOptions | SimulationServer,
  contractId?: string,
): Promise<OnChainCommitment> {
  const u64Val = BigInt(id);
  const scVal = nativeToScVal(u64Val, { type: 'u64' });
  const raw = await simulateEscrowRead('get_commitment', [scVal], optionsOrServer, contractId);
  if (!raw) {
    const notFoundError = new TxError('contract', 'The requested commitment could not be found.', {
      code: EscrowErrorCode.NotFound,
      hint: 'Check the commitment ID and try again.',
    });
    throw notFoundError;
  }
  return normalizeCommitment(raw);
}

/**
 * Reads historical compliance attestations for a commitment.
 * Returns array sorted newest first.
 */
export async function getAttestations(
  id: string | bigint,
  optionsOrServer?: ReadOptions | SimulationServer,
  contractId?: string,
): Promise<OnChainAttestation[]> {
  const u64Val = BigInt(id);
  const scVal = nativeToScVal(u64Val, { type: 'u64' });
  const raw = await simulateEscrowRead('get_attestations', [scVal], optionsOrServer, contractId);
  const values: unknown[] = Array.isArray(raw) ? raw : [];
  const list: OnChainAttestation[] = values.map(normalizeAttestation);
  return list.sort((a, b) => (b.timestamp > a.timestamp ? 1 : b.timestamp < a.timestamp ? -1 : 0));
}

/**
 * Reads dispute status for a commitment. Returns null if not in dispute (None).
 */
export async function getDispute(
  id: string | bigint,
  optionsOrServer?: ReadOptions | SimulationServer,
  contractId?: string,
): Promise<OnChainDispute | null> {
  const u64Val = BigInt(id);
  const scVal = nativeToScVal(u64Val, { type: 'u64' });
  const raw = await simulateEscrowRead('get_dispute', [scVal], optionsOrServer, contractId);
  return normalizeDispute(raw);
}

export function formatRelativeTime(timestampSeconds: bigint | number, nowMs = Date.now()): string {
  const tsMs =
    typeof timestampSeconds === 'bigint'
      ? Number(timestampSeconds) * 1000
      : timestampSeconds * 1000;
  const diffSec = Math.floor((nowMs - tsMs) / 1000);
  if (diffSec < 0) return 'in the future';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths}mo ago`;
}

export function formatAbsoluteTime(timestampSeconds: bigint | number): string {
  if (!timestampSeconds || timestampSeconds === 0n || timestampSeconds === 0) {
    return 'Not set';
  }
  const date = new Date(Number(timestampSeconds) * 1000);
  return date.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}


