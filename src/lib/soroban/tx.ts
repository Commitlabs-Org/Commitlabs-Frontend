import { Account, BASE_FEE, Keypair, Operation, Transaction, TransactionBuilder, rpc, xdr } from '@stellar/stellar-sdk';
import { getPublicKey, isConnected, signTransaction } from '@stellar/freighter-api';
import { config } from '@/lib/config';
import { TxError, toTxError } from '@/lib/soroban/errors';

const TX_TIMEOUT_SECONDS = 300;
const POLL_ATTEMPTS = 60;

function rpcServer(): rpc.Server {
  return new rpc.Server(config.sorobanRpcUrl);
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

export async function invokeContract({ method, args, source, signer }: InvokeContractParams): Promise<InvokeResult> {
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

  const signed = await signTransaction(tx.toXDR(), { networkPassphrase: config.passphrase });
  const sent = await rpcServer().sendTransaction(new Transaction(signed, config.passphrase));
  if (sent.status === 'ERROR') {
    throw toTxError(sent);
  }

  const result = await rpcServer().pollTransaction(sent.hash, { attempts: POLL_ATTEMPTS });
  if (result.status === 'FAILED') {
    throw toTxError({ message: `Transaction ${sent.hash} failed on chain.`, transactionHash: sent.hash, resultXdr: result.resultXdr });
  }
  if (result.status !== 'SUCCESS') {
    throw new TxError('failed', `Transaction ${sent.hash} ended with status ${result.status}.`, { transactionHash: sent.hash });
  }

  return { transactionHash: sent.hash };
}

export async function simulateRead({ method, args, source }: SimulateReadParams): Promise<SimulateReadResult> {
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
