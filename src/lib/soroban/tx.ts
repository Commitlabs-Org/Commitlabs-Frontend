import {
  Account,
  BASE_FEE,
  Keypair,
  Operation,
  Transaction,
  TransactionBuilder,
  rpc,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk';
import { getPublicKey, isConnected, signTransaction } from '@stellar/freighter-api';
import { getActiveConfig } from '@/lib/config';
import { STELLAR_DECIMALS } from '@/lib/amount';
import { TxError, toTxError } from '@/lib/soroban/errors';

const TX_TIMEOUT_SECONDS = 300;
const POLL_ATTEMPTS = 60;

function rpcServer(): rpc.Server {
  return new rpc.Server(getActiveConfig().sorobanRpcUrl);
}

/** Fallback source account for read-only simulations that do not mutate state. */
function simulationSource(): Account {
  return new Account(Keypair.random().publicKey(), '0');
}

export interface InvokeContractParams {
  method: string;
  args: xdr.ScVal[];
  source: string;
  signer: string;
}

export interface InvokeResult {
  transactionHash: string;
  returnValue?: xdr.ScVal;
}

export interface PreparedInvocation {
  method: string;
  args: unknown[];
  rawArgs: xdr.ScVal[];
  fee: bigint;
  feeXlm: string;
  minResourceFee: bigint;
  baseFee: bigint;
  returnValue: unknown;
  rawReturnValue?: unknown;
  authEntries: unknown[];
  txXdr: string;
  tx: { toXDR: () => string };
}

export interface SimulateReadParams {
  method: string;
  args: xdr.ScVal[];
  source?: string;
}

export interface SimulateReadResult {
  error?: string;
  result?: unknown;
}

function parseStroops(val: unknown): bigint {
  if (typeof val === 'bigint') return val;
  if (typeof val === 'number' && Number.isFinite(val)) return BigInt(Math.trunc(val));
  if (typeof val === 'string' && /^-?\d+$/.test(val.trim())) return BigInt(val.trim());
  return 0n;
}

/**
 * Formats a fee in stroops as an exact 7-decimal XLM string using bigint math.
 */
export function formatFeeXlm(stroops: bigint | number | string): string {
  const value = parseStroops(stroops);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const digits = abs.toString().padStart(STELLAR_DECIMALS + 1, '0');
  const whole = digits.slice(0, digits.length - STELLAR_DECIMALS);
  const fraction = digits.slice(digits.length - STELLAR_DECIMALS);
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${grouped}.${fraction}`;
}

export function decodeScVal(val: unknown): unknown {
  if (val === null || val === undefined) return null;
  try {
    if (
      val instanceof xdr.ScVal ||
      (typeof val === 'object' && 'switch' in val && typeof (val as { switch?: unknown }).switch === 'function')
    ) {
      return scValToNative(val as xdr.ScVal);
    }
    if (typeof val === 'object' && 'type' in val) {
      const t = (val as { type?: unknown; value?: unknown }).type;
      if (t === 'scvVoid') return null;
      if ('value' in val) return (val as { value?: unknown }).value;
    }
  } catch {
    // fallback to raw value if XDR conversion fails in mock environments
  }
  return val;
}

export async function prepareInvocation({
  method,
  args,
  source,
  signer,
}: InvokeContractParams): Promise<PreparedInvocation> {
  const config = getActiveConfig();
  if (!config.escrowContractId) {
    throw new TxError('network', 'The escrow contract is not configured for this deployment.', {
      hint: 'Set NEXT_PUBLIC_ESCROW_CONTRACT_ID and redeploy.',
    });
  }

  const connected = await isConnected();
  if (!connected) {
    throw new TxError('failed', 'Freighter wallet is not connected.', {
      hint: 'Connect your wallet, then try again.',
    });
  }

  const walletAddress = await getPublicKey();
  if (!walletAddress) {
    throw new TxError('failed', 'Wallet access was not granted.', {
      hint: 'Approve the connection request in Freighter and try again.',
    });
  }
  if (walletAddress !== source || walletAddress !== signer) {
    throw new TxError('rejected', 'The connected wallet is not the owner of this commitment.', {
      hint: 'Connect the wallet that owns this commitment and try again.',
    });
  }

  let account: Account;
  try {
    account = await rpcServer().getAccount(source);
  } catch (err) {
    throw toTxError(err);
  }

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.passphrase,
  })
    .addOperation(Operation.invokeContractFunction({ contract: config.escrowContractId, function: method, args }))
    .setTimeout(TX_TIMEOUT_SECONDS)
    .build();

  // Simulate before asking the user to sign so rejections surface immediately.
  const simulation = await rpcServer().simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simulation)) {
    throw toTxError(simulation.error ?? simulation);
  }

  const baseFee = parseStroops(BASE_FEE);
  const minResourceFee = parseStroops((simulation as { minResourceFee?: unknown }).minResourceFee);
  const fee = baseFee + minResourceFee;
  const rawReturnValue = (simulation as { result?: { retval?: unknown } }).result?.retval;
  const authEntries = (simulation as { result?: { auth?: unknown[] } }).result?.auth ?? [];

  let assembledTx: { toXDR: () => string } = tx;
  if (typeof rpc.assembleTransaction === 'function') {
    try {
      const built = rpc.assembleTransaction(tx, simulation as rpc.Api.SimulateTransactionSuccessResponse).build();
      if (built && typeof built.toXDR === 'function') {
        assembledTx = built;
      }
    } catch {
      assembledTx = tx;
    }
  }

  const decodedArgs = args.map((arg) => decodeScVal(arg));
  const returnValue = decodeScVal(rawReturnValue);

  return {
    method,
    args: decodedArgs,
    rawArgs: args,
    fee,
    feeXlm: formatFeeXlm(fee),
    minResourceFee,
    baseFee,
    returnValue,
    rawReturnValue,
    authEntries,
    txXdr: assembledTx.toXDR(),
    tx: assembledTx,
  };
}

export async function submitPrepared(
  prepared: Pick<PreparedInvocation, 'txXdr'> | { tx: { toXDR: () => string } } | string,
): Promise<InvokeResult> {
  const config = getActiveConfig();
  const xdrString =
    typeof prepared === 'string'
      ? prepared
      : 'txXdr' in prepared && typeof prepared.txXdr === 'string'
        ? prepared.txXdr
        : 'tx' in prepared && prepared.tx && typeof prepared.tx.toXDR === 'function'
          ? prepared.tx.toXDR()
          : '';

  const signed = await signTransaction(xdrString, { networkPassphrase: config.passphrase });
  const sent = await rpcServer().sendTransaction(new Transaction(signed, config.passphrase));
  if (sent.status === 'ERROR') {
    throw toTxError(sent);
  }

  const result = await rpcServer().pollTransaction(sent.hash, { attempts: POLL_ATTEMPTS });
  if (result.status === 'FAILED') {
    throw toTxError({
      message: `Transaction ${sent.hash} failed on chain.`,
      transactionHash: sent.hash,
      resultXdr: result.resultXdr,
    });
  }
  if (result.status !== 'SUCCESS') {
    throw new TxError('failed', `Transaction ${sent.hash} ended with status ${result.status}.`, {
      transactionHash: sent.hash,
    });
  }

  return { transactionHash: sent.hash, returnValue: result.returnValue };
}

export async function invokeContract(params: InvokeContractParams): Promise<InvokeResult> {
  const prepared = await prepareInvocation(params);
  return submitPrepared(prepared);
}

export async function simulateRead({ method, args, source }: SimulateReadParams): Promise<SimulateReadResult> {
  const config = getActiveConfig();
  if (!config.escrowContractId) {
    return { error: 'The escrow contract is not configured for this deployment.' };
  }

  let account: Account;
  try {
    account = await rpcServer().getAccount(source ?? simulationSource().accountId());
  } catch {
    account = simulationSource();
  }

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.passphrase,
  })
    .addOperation(Operation.invokeContractFunction({ contract: config.escrowContractId, function: method, args }))
    .setTimeout(TX_TIMEOUT_SECONDS)
    .build();

  try {
    const simulation = await rpcServer().simulateTransaction(tx);
    if (rpc.Api.isSimulationError(simulation)) {
      return { error: String(simulation.error ?? 'Read simulation failed.') };
    }
    if (rpc.Api.isSimulationSuccess(simulation)) {
      return { result: simulation.result?.retval };
    }
    return { error: 'Read simulation did not return a result.' };
  } catch (err) {
    return { error: toTxError(err).message };
  }
}
