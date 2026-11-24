import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateEnv } from './validate-env.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const networkTsPath = path.resolve(__dirname, '../src/lib/network.ts');

/**
 * Extracts `defaultHorizonUrl` and `defaultSorobanRpcUrl` per network id
 * from `src/lib/network.ts` without requiring a TypeScript compiler.
 */
function parseNetworkUrlsFromTs(source) {
  const blockMatch = source.match(
    /export const NETWORKS:\s*Record<NetworkId,\s*NetworkConfig>\s*=\s*\{([\s\S]*?)\n\};/,
  );
  if (!blockMatch) {
    throw new Error('Could not locate NETWORKS object in src/lib/network.ts');
  }

  const body = blockMatch[1];
  const entryRegex =
    /(\w+):\s*\{[\s\S]*?defaultHorizonUrl:\s*'([^']+)'[\s\S]*?defaultSorobanRpcUrl:\s*'([^']+)'[\s\S]*?\n  \}/g;

  const parsed = {};
  let match;
  while ((match = entryRegex.exec(body)) !== null) {
    const [, networkId, defaultHorizonUrl, defaultSorobanRpcUrl] = match;
    parsed[networkId] = {
      defaultHorizonUrl,
      defaultSorobanRpcUrl,
    };
  }

  if (Object.keys(parsed).length === 0) {
    throw new Error('Parsed zero network entries from src/lib/network.ts');
  }

  return parsed;
}

test('accepts valid defaults when env vars are unset', () => {
  assert.doesNotThrow(() => validateEnv({}));
});

test('accepts empty or whitespace-only NEXT_PUBLIC_ESCROW_CONTRACT_ID', () => {
  assert.doesNotThrow(() =>
    validateEnv({ NEXT_PUBLIC_ESCROW_CONTRACT_ID: '' }),
  );
  assert.doesNotThrow(() =>
    validateEnv({ NEXT_PUBLIC_ESCROW_CONTRACT_ID: '   \t  ' }),
  );
});

test('accepts a valid 56-character Soroban contract id starting with C', () => {
  const validContractId = `C${'A'.repeat(55)}`;
  assert.doesNotThrow(() =>
    validateEnv({
      NEXT_PUBLIC_STELLAR_NETWORK: 'testnet',
      NEXT_PUBLIC_ESCROW_CONTRACT_ID: validContractId,
    }),
  );
});

test('rejects unknown NEXT_PUBLIC_STELLAR_NETWORK', () => {
  assert.throws(
    () => validateEnv({ NEXT_PUBLIC_STELLAR_NETWORK: 'unknownnet' }),
    /Invalid NEXT_PUBLIC_STELLAR_NETWORK: "unknownnet"\. Must be one of: testnet, futurenet, mainnet/,
  );
});

test('rejects empty NEXT_PUBLIC_HORIZON_URL and NEXT_PUBLIC_SOROBAN_RPC_URL', () => {
  assert.throws(
    () => validateEnv({ NEXT_PUBLIC_HORIZON_URL: '' }),
    /NEXT_PUBLIC_HORIZON_URL cannot be empty/,
  );
  assert.throws(
    () => validateEnv({ NEXT_PUBLIC_SOROBAN_RPC_URL: '' }),
    /NEXT_PUBLIC_SOROBAN_RPC_URL cannot be empty/,
  );
});

test('rejects malformed URLs for Horizon and Soroban RPC', () => {
  assert.throws(
    () => validateEnv({ NEXT_PUBLIC_HORIZON_URL: 'not-a-valid-url' }),
    /Invalid URL for NEXT_PUBLIC_HORIZON_URL: "not-a-valid-url"/,
  );
  assert.throws(
    () => validateEnv({ NEXT_PUBLIC_SOROBAN_RPC_URL: ':::invalid' }),
    /Invalid URL for NEXT_PUBLIC_SOROBAN_RPC_URL: ":::invalid"/,
  );
});

test('rejects non-https (http:) Horizon and Soroban RPC URLs', () => {
  assert.throws(
    () =>
      validateEnv({
        NEXT_PUBLIC_HORIZON_URL: 'http://horizon-testnet.stellar.org',
      }),
    /NEXT_PUBLIC_HORIZON_URL must use https: protocol, got "http:"/,
  );
  assert.throws(
    () =>
      validateEnv({
        NEXT_PUBLIC_SOROBAN_RPC_URL: 'http://soroban-testnet.stellar.org',
      }),
    /NEXT_PUBLIC_SOROBAN_RPC_URL must use https: protocol, got "http:"/,
  );
});

test('rejects malformed NEXT_PUBLIC_ESCROW_CONTRACT_ID', () => {
  assert.throws(
    () =>
      validateEnv({
        NEXT_PUBLIC_ESCROW_CONTRACT_ID: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      }),
    /Invalid NEXT_PUBLIC_ESCROW_CONTRACT_ID/,
  );
  assert.throws(
    () =>
      validateEnv({
        NEXT_PUBLIC_ESCROW_CONTRACT_ID: 'C123',
      }),
    /Invalid NEXT_PUBLIC_ESCROW_CONTRACT_ID/,
  );
  assert.throws(
    () =>
      validateEnv({
        NEXT_PUBLIC_ESCROW_CONTRACT_ID: `C${'a'.repeat(55)}`,
      }),
    /Invalid NEXT_PUBLIC_ESCROW_CONTRACT_ID/,
  );
});

test('matches default Horizon and Soroban RPC URLs in src/lib/network.ts per network', () => {
  const source = fs.readFileSync(networkTsPath, 'utf8');
  const tsNetworks = parseNetworkUrlsFromTs(source);

  assert.deepEqual(Object.keys(tsNetworks).sort(), [
    'futurenet',
    'mainnet',
    'testnet',
  ]);

  for (const [networkId, expectedUrls] of Object.entries(tsNetworks)) {
    const capturedUrls = [];
    const originalFetch = globalThis.fetch;

    assert.doesNotThrow(() => {
      validateEnv({ NEXT_PUBLIC_STELLAR_NETWORK: networkId });
      capturedUrls.push(
        expectedUrls.defaultHorizonUrl,
        expectedUrls.defaultSorobanRpcUrl,
      );
    });

    assert.ok(capturedUrls[0].startsWith('https://'));
    assert.ok(capturedUrls[1].startsWith('https://'));
    globalThis.fetch = originalFetch;
  }
});

test('validate-env.mjs network defaults match NETWORKS in src/lib/network.ts', () => {
  const scriptSource = fs.readFileSync(
    path.resolve(__dirname, './validate-env.mjs'),
    'utf8',
  );
  const tsSource = fs.readFileSync(networkTsPath, 'utf8');

  const scriptNetworks = parseNetworkUrlsFromScript(scriptSource);
  const tsNetworks = parseNetworkUrlsFromTs(tsSource);

  assert.deepEqual(scriptNetworks, tsNetworks);
});