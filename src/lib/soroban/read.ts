import {
  Account,
  Contract,
  nativeToScVal,
  rpc,
  scValToNative,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk';
import { config, ESCROW_CONTRACT_ID, SOROBAN_RPC_URL } from '../config';
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

export interface ReadOptions {
  server?: rpc.Server | { simulateTransaction: (tx: any) => Promise<any> };
  contractId?: string;
}

const DISPUTE_REASON_NAMES: Record<number, string> = {
  0: 'Value Mismatch',
  1: 'Non-Compliance',
  2: 'Fraud Suspicion',
  3: 'Operational Failure',
  4: 'Other',
};

function normalizeEnumString(val: any, fallback: string): string {
  if (typeof val === 'string') return val;
  if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'string') return val[0];
  if (val && typeof val === 'object') {
    if ('name' in val && typeof val.name === 'string') return val.name;
    const keys = Object.keys(val);
    if (keys.length > 0) return keys[0];
  }
  return fallback;
}

function normalizeMetadata(raw: any): Record<string, string> {
  if (!raw) return {};
  if (raw instanceof Map) {
    const res: Record<string, string> = {};
    for (const [k, v] of raw.entries()) {
      res[String(k)] = String(v);
    }
    return res;
  }
  if (Array.isArray(raw)) {
    const res: Record<string, string> = {};
    for (const item of raw) {
      if (Array.isArray(item) && item.length >= 2) {
        res[String(item[0])] = String(item[1]);
      } else if (item && typeof item === 'object' && 'key' in item && 'val' in item) {
        res[String(item.key)] = String(item.val);
      }
    }
    return res;
  }
  if (typeof raw === 'object') {
    const res: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      res[k] = String(v);
    }
    return res;
  }
  return {};
}

export function normalizeCommitment(raw: any): OnChainCommitment {
  return {
    id: String(raw.id ?? '0'),
    owner: String(raw.owner ?? ''),
    asset: String(raw.asset ?? ''),
    amount: typeof raw.amount === 'bigint' ? raw.amount : BigInt(raw.amount ?? 0),
    accruedYield:
      typeof raw.accrued_yield === 'bigint'
        ? raw.accrued_yield
        : typeof raw.accruedYield === 'bigint'
          ? raw.accruedYield
          : BigInt(raw.accrued_yield ?? raw.accruedYield ?? 0),
    risk: normalizeEnumString(raw.risk, 'Balanced'),
    status: normalizeEnumString(raw.status, 'Created'),
    maturity: typeof raw.maturity === 'bigint' ? raw.maturity : BigInt(raw.maturity ?? 0),
    penaltyBps: Number(raw.penalty_bps ?? raw.penaltyBps ?? 0),
    complianceScore: Number(raw.compliance_score ?? raw.complianceScore ?? 100),
    createdAt:
      typeof raw.created_at === 'bigint'
        ? raw.created_at
        : typeof raw.createdAt === 'bigint'
          ? raw.createdAt
          : BigInt(raw.created_at ?? raw.createdAt ?? 0),
    metadata: normalizeMetadata(raw.metadata),
  };
}

export function normalizeAttestation(raw: any): OnChainAttestation {
  return {
    attestor: String(raw.attestor ?? ''),
    complianceScore: Number(raw.compliance_score ?? raw.complianceScore ?? 0),
    timestamp: typeof raw.timestamp === 'bigint' ? raw.timestamp : BigInt(raw.timestamp ?? 0),
  };
}

export function normalizeDispute(raw: any): OnChainDispute | null {
  if (!raw || (typeof raw === 'object' && Object.keys(raw).length === 0)) {
    return null;
  }
  let code = 4;
  let category = 'Other';
  const rawCat = raw.reason_category ?? raw.reasonCategory;
  if (typeof rawCat === 'bigint' || typeof rawCat === 'number') {
    code = Number(rawCat);
    category = DISPUTE_REASON_NAMES[code] ?? `Category #${code}`;
  } else if (typeof rawCat === 'string') {
    category = rawCat;
  } else if (Array.isArray(rawCat) && typeof rawCat[0] === 'string') {
    category = rawCat[0];
  }

  return {
    reasonCategory: category,
    reasonCode: code,
    reasonText: String(raw.reason_text ?? raw.reasonText ?? ''),
    disputedAt:
      typeof raw.disputed_at === 'bigint'
        ? raw.disputed_at
        : typeof raw.disputedAt === 'bigint'
          ? raw.disputedAt
          : BigInt(raw.disputed_at ?? raw.disputedAt ?? 0),
    disputedBy: String(raw.disputed_by ?? raw.disputedBy ?? ''),
  };
}

export function isNotFoundError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof TxError && err.code === EscrowErrorCode.NotFound) return true;
  if (typeof err === 'object' && err !== null && 'code' in err && (err as any).code === EscrowErrorCode.NotFound) {
    return true;
  }
  const msg = err instanceof Error ? err.message : String(err);
  return /not\s*found|#3\b|contract.*?3\b/i.test(msg);
}

function resolveServerAndContract(
  optionsOrServer?: ReadOptions | rpc.Server | { simulateTransaction: (tx: any) => Promise<any> },
  explicitContractId?: string,
): { server: rpc.Server | { simulateTransaction: (tx: any) => Promise<any> }; contractId: string } {
  let server: rpc.Server | { simulateTransaction: (tx: any) => Promise<any> };
  let contractId = explicitContractId || ESCROW_CONTRACT_ID;

  if (optionsOrServer && 'simulateTransaction' in optionsOrServer) {
    server = optionsOrServer;
  } else if (optionsOrServer && typeof optionsOrServer === 'object') {
    const opts = optionsOrServer as ReadOptions;
    server = opts.server || new rpc.Server(SOROBAN_RPC_URL);
    if (opts.contractId) contractId = opts.contractId;
  } else {
    server = new rpc.Server(SOROBAN_RPC_URL);
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
  optionsOrServer?: ReadOptions | rpc.Server | { simulateTransaction: (tx: any) => Promise<any> },
  contractIdOverride?: string,
): Promise<any> {
  const { server, contractId } = resolveServerAndContract(optionsOrServer, contractIdOverride);

  if (!contractId) {
    throw new Error('Escrow contract is not configured. Set NEXT_PUBLIC_ESCROW_CONTRACT_ID.');
  }

  const dummyAccount = new Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '0');
  const contract = new Contract(contractId);
  const tx = new TransactionBuilder(dummyAccount, {
    fee: '100',
    networkPassphrase: config.passphrase,
  })
    .addOperation(contract.call(functionName, ...args))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);

  // Check for simulation errors
  if (sim && typeof sim === 'object' && ('error' in sim || 'diagnostics' in sim)) {
    if (sim.error || (Array.isArray(sim.diagnostics) && sim.diagnostics.length > 0 && !('result' in sim))) {
      throw toTxError(sim);
    }
  }

  let retvalScVal: xdr.ScVal | undefined;

  if (sim && typeof sim === 'object') {
    if ('result' in sim && sim.result && 'retval' in sim.result) {
      retvalScVal = sim.result.retval as xdr.ScVal;
    } else if ('results' in sim && Array.isArray(sim.results) && sim.results[0]?.xdr) {
      retvalScVal = xdr.ScVal.fromXDR(sim.results[0].xdr, 'base64');
    }
  }

  if (!retvalScVal) {
    if (sim && typeof sim === 'object' && 'error' in sim) {
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
  optionsOrServer?: ReadOptions | rpc.Server | { simulateTransaction: (tx: any) => Promise<any> },
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
  optionsOrServer?: ReadOptions | rpc.Server | { simulateTransaction: (tx: any) => Promise<any> },
  contractId?: string,
): Promise<OnChainAttestation[]> {
  const u64Val = BigInt(id);
  const scVal = nativeToScVal(u64Val, { type: 'u64' });
  const raw = await simulateEscrowRead('get_attestations', [scVal], optionsOrServer, contractId);
  const list: OnChainAttestation[] = (Array.isArray(raw) ? raw : []).map(normalizeAttestation);
  return list.sort((a, b) => (b.timestamp > a.timestamp ? 1 : b.timestamp < a.timestamp ? -1 : 0));
}

/**
 * Reads dispute status for a commitment. Returns null if not in dispute (None).
 */
export async function getDispute(
  id: string | bigint,
  optionsOrServer?: ReadOptions | rpc.Server | { simulateTransaction: (tx: any) => Promise<any> },
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

export function shortenAddress(addr: string): string {
  if (!addr || addr.length <= 14) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
}

