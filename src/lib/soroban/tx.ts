import { Account, Contract, nativeToScVal, rpc, TransactionBuilder, xdr } from '@stellar/stellar-sdk';
import { config } from '../config';

export interface SimulateReadOptions {
  contractId?: string;
  rpcUrl?: string;
  server?: rpc.Server;
}

/**
 * Simulate a read-only invocation on a Soroban contract.
 */
export async function simulateRead(
  method: string,
  args: (xdr.ScVal | any)[] = [],
  options: SimulateReadOptions = {},
): Promise<xdr.ScVal> {
  const contractId = options.contractId || config.escrowContractId;
  if (!contractId) {
    throw new Error('Escrow contract ID is not configured');
  }

  const server = options.server || new rpc.Server(options.rpcUrl || config.sorobanRpcUrl);
  const contract = new Contract(contractId);
  const scValArgs = args.map((arg) => (arg instanceof xdr.ScVal ? arg : nativeToScVal(arg)));

  // Dummy account for read-only contract simulation
  const dummyAccount = new Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '0');
  const tx = new TransactionBuilder(dummyAccount, {
    fee: '100',
    networkPassphrase: config.passphrase,
  })
    .addOperation(contract.call(method, ...(scValArgs as any)))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error || `Simulation of ${method} failed`);
  }
  if (!rpc.Api.isSimulationSuccess(sim) || !sim.result?.retval) {
    throw new Error(`Simulation of ${method} returned no value`);
  }
  return sim.result.retval;
}

export interface InvokeContractParams {
  method: string;
  args?: (xdr.ScVal | any)[];
  source: string;
  signer?: (txXdr: string) => Promise<string>;
  contractId?: string;
  rpcUrl?: string;
  server?: rpc.Server;
}

/**
 * Minimal invokeContract helper matching the required exported API.
 */
export async function invokeContract({
  method,
  args = [],
  source,
  signer,
  contractId = config.escrowContractId,
  rpcUrl = config.sorobanRpcUrl,
  server = new rpc.Server(rpcUrl),
}: InvokeContractParams): Promise<{ status: string; txHash?: string }> {
  if (!contractId) {
    throw new Error('Escrow contract ID is not configured');
  }

  const contract = new Contract(contractId);
  const scValArgs = args.map((arg) => (arg instanceof xdr.ScVal ? arg : nativeToScVal(arg)));
  const dummyAccount = new Account(source, '0');
  const tx = new TransactionBuilder(dummyAccount, {
    fee: '1000',
    networkPassphrase: config.passphrase,
  })
    .addOperation(contract.call(method, ...(scValArgs as any)))
    .setTimeout(30)
    .build();

  if (signer) {
    const signedXdr = await signer(tx.toXDR());
    const sendRes = await server.sendTransaction(
      TransactionBuilder.fromXDR(signedXdr, config.passphrase) as any,
    );
    return { status: sendRes.status, txHash: sendRes.hash };
  }
  return { status: 'simulated' };
}
