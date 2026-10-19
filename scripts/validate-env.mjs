#!/usr/bin/env node

const NETWORKS = {
  testnet: {
    defaultHorizonUrl: 'https://horizon-testnet.stellar.org',
    defaultSorobanRpcUrl: 'https://soroban-testnet.stellar.org',
  },
  futurenet: {
    defaultHorizonUrl: 'https://horizon-futurenet.stellar.org',
    defaultSorobanRpcUrl: 'https://rpc-futurenet.stellar.org',
  },
  mainnet: {
    defaultHorizonUrl: 'https://horizon.stellar.org',
    defaultSorobanRpcUrl: 'https://mainnet.stellar.org',
  },
};

export function validateEnv(env = process.env) {
  const rawNetwork = env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet';
  if (!(rawNetwork in NETWORKS)) {
    throw new Error(
      `Invalid NEXT_PUBLIC_STELLAR_NETWORK: "${rawNetwork}". Must be one of: ${Object.keys(NETWORKS).join(', ')}`
    );
  }
  const netDetails = NETWORKS[rawNetwork];

  const horizonUrl = env.NEXT_PUBLIC_HORIZON_URL ?? netDetails.defaultHorizonUrl;
  validateHttpsUrl(horizonUrl, 'NEXT_PUBLIC_HORIZON_URL');

  const sorobanRpcUrl = env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? netDetails.defaultSorobanRpcUrl;
  validateHttpsUrl(sorobanRpcUrl, 'NEXT_PUBLIC_SOROBAN_RPC_URL');

  const rawContractId = env.NEXT_PUBLIC_ESCROW_CONTRACT_ID?.trim() ?? '';
  if (rawContractId && !/^C[A-Z2-7]{55}$/.test(rawContractId)) {
    throw new Error(
      `Invalid NEXT_PUBLIC_ESCROW_CONTRACT_ID: "${rawContractId}". Must be a valid 56-character Soroban contract address starting with 'C'`
    );
  }
}

function validateHttpsUrl(val, name) {
  if (!val) {
    throw new Error(`${name} cannot be empty`);
  }
  let parsed;
  try {
    parsed = new URL(val);
  } catch {
    throw new Error(`Invalid URL for ${name}: "${val}"`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`${name} must use https: protocol, got "${parsed.protocol}"`);
  }
}

// When executed directly as a script
if (process.argv[1]?.endsWith('validate-env.mjs')) {
  try {
    validateEnv(process.env);
    console.log('✓ Runtime network configuration valid');
  } catch (err) {
    console.error('Configuration Error:\n ', err.message);
    process.exit(1);
  }
}
