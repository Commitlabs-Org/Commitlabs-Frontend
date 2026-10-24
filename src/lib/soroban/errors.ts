import { explorerContractUrl } from '../config';

export enum EscrowErrorCode {
  AlreadyInitialized = 1,
  NotInitialized = 2,
  NotFound = 3,
  Unauthorized = 4,
  InvalidAmount = 5,
  InvalidState = 6,
  NotMatured = 7,
  InvalidDuration = 8,
  PenaltyTooHigh = 9,
  InsufficientYieldPool = 10,
  Paused = 11,
  AssetMismatch = 12,
  InsufficientBalance = 13,
  CommitmentViolated = 14,
  InvalidWasmHash = 15,
  FundingWindowExpired = 16,
  ReservedYieldInvariant = 17,
  InvalidGracePeriod = 18,
  NoPendingAdmin = 19,
  NoPendingTransfer = 20,
  TransferExpired = 21,
  BelowMinimum = 22,
}

export interface ContractError {
  code: EscrowErrorCode;
  name: keyof typeof EscrowErrorCode;
  message: string;
  hint: string;
}

export const CONTRACT_ERRORS: Record<EscrowErrorCode, ContractError> = {
  [EscrowErrorCode.AlreadyInitialized]: {
    code: EscrowErrorCode.AlreadyInitialized,
    name: 'AlreadyInitialized',
    message: 'This escrow contract has already been initialized.',
    hint: 'Choose an existing initialized contract and try again.',
  },
  [EscrowErrorCode.NotInitialized]: {
    code: EscrowErrorCode.NotInitialized,
    name: 'NotInitialized',
    message: 'The escrow contract has not been initialized.',
    hint: 'Contact support or try again after the contract is initialized.',
  },
  [EscrowErrorCode.NotFound]: {
    code: EscrowErrorCode.NotFound,
    name: 'NotFound',
    message: 'The requested commitment could not be found.',
    hint: 'Check the commitment and try again.',
  },
  [EscrowErrorCode.Unauthorized]: {
    code: EscrowErrorCode.Unauthorized,
    name: 'Unauthorized',
    message: 'Your wallet is not authorized to perform this action.',
    hint: 'Connect the wallet that owns this commitment and try again.',
  },
  [EscrowErrorCode.InvalidAmount]: {
    code: EscrowErrorCode.InvalidAmount,
    name: 'InvalidAmount',
    message: 'The amount must be greater than zero.',
    hint: 'Enter a valid positive XLM amount and try again.',
  },
  [EscrowErrorCode.InvalidState]: {
    code: EscrowErrorCode.InvalidState,
    name: 'InvalidState',
    message: 'This commitment cannot be changed in its current state.',
    hint: 'Refresh the page to see its latest status.',
  },
  [EscrowErrorCode.NotMatured]: {
    code: EscrowErrorCode.NotMatured,
    name: 'NotMatured',
    message: 'This commitment has not reached its maturity date.',
    hint: 'Wait until the maturity date before releasing the funds.',
  },
  [EscrowErrorCode.InvalidDuration]: {
    code: EscrowErrorCode.InvalidDuration,
    name: 'InvalidDuration',
    message: 'The commitment duration is invalid.',
    hint: 'Choose a supported duration and try again.',
  },
  [EscrowErrorCode.PenaltyTooHigh]: {
    code: EscrowErrorCode.PenaltyTooHigh,
    name: 'PenaltyTooHigh',
    message: 'The early-exit penalty is above the allowed limit.',
    hint: 'Choose a lower penalty and try again.',
  },
  [EscrowErrorCode.InsufficientYieldPool]: {
    code: EscrowErrorCode.InsufficientYieldPool,
    name: 'InsufficientYieldPool',
    message: 'The yield pool does not have enough funds to complete this release.',
    hint: 'Try again later or contact the contract administrator.',
  },
  [EscrowErrorCode.Paused]: {
    code: EscrowErrorCode.Paused,
    name: 'Paused',
    message: 'Escrow actions are temporarily paused.',
    hint: 'Wait for the contract administrator to resume activity, then try again.',
  },
  [EscrowErrorCode.AssetMismatch]: {
    code: EscrowErrorCode.AssetMismatch,
    name: 'AssetMismatch',
    message: 'The selected asset is not supported by this escrow.',
    hint: 'Use the escrow’s configured token and try again.',
  },
  [EscrowErrorCode.InsufficientBalance]: {
    code: EscrowErrorCode.InsufficientBalance,
    name: 'InsufficientBalance',
    message: 'Your wallet does not hold enough XLM to fund this commitment.',
    hint: 'Add XLM to your wallet to cover the commitment and network fees.',
  },
  [EscrowErrorCode.CommitmentViolated]: {
    code: EscrowErrorCode.CommitmentViolated,
    name: 'CommitmentViolated',
    message: 'This commitment is in a violated state and cannot be released.',
    hint: 'Review the commitment status or contact support for help.',
  },
  [EscrowErrorCode.InvalidWasmHash]: {
    code: EscrowErrorCode.InvalidWasmHash,
    name: 'InvalidWasmHash',
    message: 'The contract Wasm hash is invalid.',
    hint: 'Check the contract configuration and try again.',
  },
  [EscrowErrorCode.FundingWindowExpired]: {
    code: EscrowErrorCode.FundingWindowExpired,
    name: 'FundingWindowExpired',
    message: "This commitment's funding window has elapsed.",
    hint: 'The commitment can no longer be funded. Contact support for options.',
  },
  [EscrowErrorCode.ReservedYieldInvariant]: {
    code: EscrowErrorCode.ReservedYieldInvariant,
    name: 'ReservedYieldInvariant',
    message: 'Yield reservation accounting invariant is broken.',
    hint: 'Contact the contract administrator for assistance.',
  },
  [EscrowErrorCode.InvalidGracePeriod]: {
    code: EscrowErrorCode.InvalidGracePeriod,
    name: 'InvalidGracePeriod',
    message: 'The grace period exceeds the maximum lock duration.',
    hint: 'Choose a shorter grace period and try again.',
  },
  [EscrowErrorCode.NoPendingAdmin]: {
    code: EscrowErrorCode.NoPendingAdmin,
    name: 'NoPendingAdmin',
    message: 'There is no pending admin proposal.',
    hint: 'Ask the current admin to propose a new admin first.',
  },
  [EscrowErrorCode.NoPendingTransfer]: {
    code: EscrowErrorCode.NoPendingTransfer,
    name: 'NoPendingTransfer',
    message: 'There is no pending ownership transfer for this commitment.',
    hint: 'Ask the current owner to start the transfer first.',
  },
  [EscrowErrorCode.TransferExpired]: {
    code: EscrowErrorCode.TransferExpired,
    name: 'TransferExpired',
    message: 'The ownership transfer offer has expired.',
    hint: 'Ask the current owner to create a new transfer offer.',
  },
  [EscrowErrorCode.BelowMinimum]: {
    code: EscrowErrorCode.BelowMinimum,
    name: 'BelowMinimum',
    message: 'The partial withdrawal or the remaining principal is below the 1-unit minimum.',
    hint: 'Withdraw at least 1 unit and leave at least 1 unit, or exit the full amount.',
  },
};

export type TxErrorKind =
  | 'contract'
  | 'simulation'
  | 'rejected'
  | 'timeout'
  | 'network'
  | 'failed'
  | 'wrong-network';

export class TxError extends Error {
  readonly kind: TxErrorKind;
  readonly code?: EscrowErrorCode;
  readonly hint?: string;
  readonly details?: string;
  readonly transactionHash?: string;

  constructor(
    kind: TxErrorKind,
    message: string,
    options: {
      code?: EscrowErrorCode;
      hint?: string;
      details?: string;
      transactionHash?: string;
    } = {},
  ) {
    super(message);
    this.name = 'TxError';
    this.kind = kind;
    this.code = options.code;
    this.hint = options.hint;
    this.details = options.details;
    this.transactionHash = options.transactionHash;
  }
}

const FALLBACK_MESSAGE = 'The transaction could not be completed.';
const FALLBACK_HINT = 'Please try again. If the problem continues, contact support.';
const CONTRACT_ERROR_PATTERN = /(?:Error\s*\(\s*Contract\s*,\s*#?\s*(\d+)\s*\)|HostError\s*\(\s*Contract\s*,\s*#?\s*(\d+)\s*\)|Contract(?:Error)?\s*[:(]\s*#?\s*(\d+))/i;
const HASH_PATTERN = /^[0-9a-f]{64}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function collectStrings(value: unknown, output: string[], visited = new Set<object>()): void {
  if (typeof value === 'string') {
    output.push(value);
  } else if (value instanceof Error) {
    output.push(value.name, value.message);
    if ('cause' in value) collectStrings(value.cause, output, visited);
  } else if (isRecord(value) || Array.isArray(value)) {
    if (visited.has(value)) return;
    visited.add(value);
    if (Array.isArray(value)) {
      value.forEach((item) => collectStrings(item, output, visited));
    } else {
      Object.entries(value).forEach(([key, item]) => {
        output.push(key);
        collectStrings(item, output, visited);
      });
    }
  }
}

function contractCodeFromText(text: string): EscrowErrorCode | undefined {
  const match = CONTRACT_ERROR_PATTERN.exec(text);
  const value = match ? Number(match[1] ?? match[2] ?? match[3]) : undefined;
  return value && value in CONTRACT_ERRORS ? (value as EscrowErrorCode) : undefined;
}

function contractCodeFromXdr(text: string): EscrowErrorCode | undefined {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(text) || text.length % 4 !== 0) return undefined;

  try {
    const binary = atob(text);
    const view = new DataView(
      Uint8Array.from(binary, (character) => character.charCodeAt(0)).buffer,
    );
    for (let offset = 0; offset + 12 <= view.byteLength; offset += 4) {
      if (
        view.getInt32(offset) === 7 &&
        view.getInt32(offset + 4) === 9 &&
        view.getInt32(offset + 8) in CONTRACT_ERRORS
      ) {
        return view.getInt32(offset + 8) as EscrowErrorCode;
      }
    }
    for (let offset = 0; offset + 8 <= view.byteLength; offset += 4) {
      if (view.getInt32(offset) === 9 && view.getInt32(offset + 4) in CONTRACT_ERRORS) {
        return view.getInt32(offset + 4) as EscrowErrorCode;
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function getTransactionHash(strings: string[]): string | undefined {
  return strings.find((value) => HASH_PATTERN.test(value));
}

function getStatus(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  for (const key of ['status', 'type', 'code']) {
    if (typeof value[key] === 'string') return value[key].toUpperCase();
  }
  return undefined;
}

function hasNamedError(value: unknown, name: string): boolean {
  if (value instanceof Error) return value.name.toLowerCase() === name.toLowerCase();
  return isRecord(value) && typeof value.name === 'string' &&
    value.name.toLowerCase() === name.toLowerCase();
}

function isFetchFailure(value: unknown): boolean {
  return (
    (value instanceof TypeError && /fetch|network/i.test(value.message)) ||
    (isRecord(value) && value.name === 'TypeError' && /fetch|network/i.test(String(value.message)))
  );
}

function isSimulationFailure(value: unknown, text: string): boolean {
  return (
    /simulation failed|simulation error|hosterror/i.test(text) ||
    (getStatus(value) === undefined && isRecord(value) && typeof value.error === 'string')
  );
}

export function toTxError(value: unknown): TxError {
  if (value instanceof TxError) return value;

  const strings: string[] = [];
  collectStrings(value, strings);
  const text = strings.join('\n');
  const transactionHash = getTransactionHash(strings);
  const code =
    contractCodeFromText(text) ??
    strings.map(contractCodeFromXdr).find((candidate) => candidate !== undefined);
  const status = getStatus(value);
  const details = strings.length > 0 ? strings.join('\n').slice(0, 2000) : undefined;
  const extra = { details, transactionHash };

  if (code !== undefined) {
    const contractError = CONTRACT_ERRORS[code];
    return new TxError('contract', contractError.message, {
      ...extra,
      code,
      hint: contractError.hint,
    });
  }

  if (/wrong network|network mismatch|does not match the network/i.test(text)) {
    return new TxError(
      'wrong-network',
      'Your wallet is connected to a different Stellar network.',
      { ...extra, hint: 'Switch your wallet to the network selected in CommitLabs.' },
    );
  }

  if (
    hasNamedError(value, 'AbortError') ||
    /timed?\s*out|timeout|deadline exceeded/i.test(text)
  ) {
    return new TxError('timeout', 'The transaction request timed out.', {
      ...extra,
      hint: 'Check your connection and transaction status before trying again.',
    });
  }

  if (
    (isRecord(value) && (value.code === 4001 || value.code === '4001')) ||
    /user rejected|user denied|user declined|request rejected|rejected by user|declined by user/i.test(text)
  ) {
    return new TxError('rejected', 'You declined the transaction in your wallet.', {
      ...extra,
      hint: 'Approve the request in your wallet if you want to continue.',
    });
  }

  if (isFetchFailure(value) || /failed to fetch|network request failed|fetch failed/i.test(text)) {
    return new TxError('network', 'Could not connect to the Stellar network.', {
      ...extra,
      hint: 'Check your internet connection and try again.',
    });
  }

  const simulationFailure = isSimulationFailure(value, text);
  if (status === 'FAILED' || status === 'ERROR' || simulationFailure) {
    return new TxError(
      simulationFailure ? 'simulation' : 'failed',
      'The transaction failed on the Stellar network.',
      { ...extra, hint: 'Refresh the page and try again.' },
    );
  }

  if (/pending|try_again_later|tx_bad_seq|tx_insufficient_fee/i.test(text)) {
    return new TxError('failed', 'The transaction could not be submitted.', {
      ...extra,
      hint: 'Refresh the page and try again with the latest account sequence.',
    });
  }

  return new TxError('failed', FALLBACK_MESSAGE, {
    ...extra,
    hint: FALLBACK_HINT,
  });
}

export function transactionExplorerUrl(error: TxError): string | undefined {
  return error.transactionHash
    ? `${explorerContractUrl('').replace(/\/contract\/$/, '')}/tx/${error.transactionHash}`
    : undefined;
}
