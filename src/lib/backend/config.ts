// Versioned contract configuration accessor
// Provides a centralized, typed, and validated way to access contract configs

export interface ContractEntry {
  address: string;
  network?: string;
  abi?: unknown;
}

export type ContractsConfig = Record<
  string,
  Record<string, ContractEntry | undefined>
>;

const LEGACY_ENV_MAPPING = {
  commitmentNFT: "NEXT_PUBLIC_COMMITMENT_NFT_CONTRACT",
  commitmentCore: "NEXT_PUBLIC_COMMITMENT_CORE_CONTRACT",
  attestationEngine: "NEXT_PUBLIC_ATTESTATION_ENGINE_CONTRACT",
};

function buildFromLegacyEnv(): ContractsConfig | null {
  const anySet = Object.values(LEGACY_ENV_MAPPING).some(
    (k) => !!process.env[k],
  );
  if (!anySet) return null;

  const v1: Record<string, ContractEntry | undefined> = {};
  for (const [key, envName] of Object.entries(LEGACY_ENV_MAPPING)) {
    const addr = process.env[envName] || "";
    if (addr) v1[key] = { address: addr };
  }

  return Object.keys(v1).length ? { v1 } : null;
}

function parseJsonEnv(): ContractsConfig | null {
  const raw =
    process.env.NEXT_PUBLIC_CONTRACTS_JSON || process.env.CONTRACTS_JSON;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      throw new Error(
        "NEXT_PUBLIC_CONTRACTS_JSON must be a JSON object mapping versions to contract entries",
      );
    }
    return parsed as ContractsConfig;
  } catch (err) {
    throw new Error(
      `Failed to parse NEXT_PUBLIC_CONTRACTS_JSON: ${(err as Error).message}`,
    );
  }
}

let cachedConfig: ContractsConfig | null = null;

export function loadContractsConfig(): ContractsConfig {
  if (cachedConfig) return cachedConfig;

  const byJson = parseJsonEnv();
  if (byJson) {
    cachedConfig = byJson;
    return cachedConfig;
  }

  const byLegacy = buildFromLegacyEnv();
  if (byLegacy) {
    cachedConfig = byLegacy;
    return cachedConfig;
  }

  // No config found; return empty object (validation will catch missing keys when used)
  cachedConfig = {};
  return cachedConfig;
}

export function getActiveContractVersion(): string {
  return (
    process.env.NEXT_PUBLIC_ACTIVE_CONTRACT_VERSION ||
    process.env.ACTIVE_CONTRACT_VERSION ||
    "v1"
  );
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function getActiveContracts(): Record<string, ContractEntry> {
  const config = loadContractsConfig();
  const active = getActiveContractVersion();
  const versionConfig = config[active];
  assert(
    !!versionConfig,
    `Active contract version "${active}" not found. Available versions: ${Object.keys(config).join(", ") || "<none>"}`,
  );

  // Ensure that entries have addresses
  const result: Record<string, ContractEntry> = {};
  for (const [key, entry] of Object.entries(versionConfig)) {
    if (!entry || !entry.address) {
      throw new Error(
        `Contract entry for key "${key}" in version "${active}" is missing or has no address. Check your config for version ${active}.`,
      );
    }
    result[key] = entry;
  }

  return result;
}

export function getContractAddress(key: string): string {
  const contracts = getActiveContracts();
  const entry = contracts[key];
  if (!entry)
    throw new Error(
      `Contract "${key}" is not configured in active version "${getActiveContractVersion()}"`,
    );
  return entry.address;
}

/**
 * Contract addresses for Soroban smart contracts.
 * @property commitmentNFT - Address of the Commitment NFT contract (env: COMMITMENT_NFT_CONTRACT or NEXT_PUBLIC_COMMITMENT_NFT_CONTRACT)
 * @property commitmentCore - Address of the Core Logic contract (env: COMMITMENT_CORE_CONTRACT or NEXT_PUBLIC_COMMITMENT_CORE_CONTRACT)
 * @property attestationEngine - Address of the Attestation Engine contract (env: ATTESTATION_ENGINE_CONTRACT or NEXT_PUBLIC_ATTESTATION_ENGINE_CONTRACT)
 */
export interface ContractAddresses {
  commitmentNFT: string;
  commitmentCore: string;
  attestationEngine: string;
}

/**
 * Environment type for the application.
 */
export type Environment = "development" | "preview" | "production";

/**
 * Backend configuration for API routes and server-side code.
 * All API routes should access env variables and network settings through this interface.
 *
 * @property sorobanRpcUrl - URL of the Soroban RPC endpoint (env: SOROBAN_RPC_URL or NEXT_PUBLIC_SOROBAN_RPC_URL)
 * @property networkPassphrase - Stellar network passphrase (env: SOROBAN_NETWORK_PASSPHRASE or NEXT_PUBLIC_NETWORK_PASSPHRASE)
 * @property contractAddresses - Addresses of deployed Soroban smart contracts
 * @property environment - Current environment (development | preview | production)
 * @property chainWritesEnabled - Whether on-chain write operations are enabled (env: COMMITLABS_ENABLE_CHAIN_WRITES)
 */
export interface BackendConfig {
  sorobanRpcUrl: string;
  networkPassphrase: string;
  contractAddresses: ContractAddresses;
  environment: Environment;
  chainWritesEnabled: boolean;
}

/**
 * Determines the current environment based on NODE_ENV and VERCEL_ENV.
 * @returns The current environment: 'development', 'preview', or 'production'
 */
function getEnvironment(): Environment {
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv === "production") return "production";
  if (vercelEnv === "preview") return "preview";

  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv === "production") return "production";
  if (nodeEnv === "test") return "development";

  return "development";
}

/**
 * Checks if the current environment is a test environment.
 * @returns true if NODE_ENV is 'test'
 */
function isTestEnvironment(): boolean {
  return process.env.NODE_ENV === "test";
}

/**
 * Validates that a required configuration value is present.
 * Throws a clear error if the value is missing in non-test environments.
 *
 * @param value - The configuration value to validate
 * @param name - The name of the configuration field (for error messages)
 * @param envVars - The environment variable names that can provide this value
 * @throws Error if the value is missing and not in test environment
 */
function validateRequired(
  value: string,
  name: string,
  envVars: string[],
): void {
  if (!value && !isTestEnvironment()) {
    throw new Error(
      `Missing required configuration: ${name}. ` +
        `Set one of the following environment variables: ${envVars.join(", ")}`,
    );
  }
}

/**
 * Returns the backend configuration for API routes and server-side code.
 * This function provides a centralized, typed, and validated way to access
 * environment variables and network settings.
 *
 * In non-test environments, this function will throw a clear error if any
 * required configuration values are missing.
 *
 * @returns BackendConfig object with all configuration values
 * @throws Error if required configuration values are missing (in non-test envs)
 *
 * @example
 * ```typescript
 * import { getBackendConfig } from '@/lib/backend/config';
 *
 * const config = getBackendConfig();
 * console.log(config.sorobanRpcUrl);
 * console.log(config.contractAddresses.commitmentCore);
 * ```
 */
export function getBackendConfig(): BackendConfig {
  const sorobanRpcUrl =
    process.env.SOROBAN_RPC_URL ??
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ??
    "https://soroban-testnet.stellar.org:443";

  const networkPassphrase =
    process.env.SOROBAN_NETWORK_PASSPHRASE ??
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ??
    "Test SDF Network ; September 2015";

  const commitmentNFT =
    process.env.COMMITMENT_NFT_CONTRACT ??
    process.env.NEXT_PUBLIC_COMMITMENT_NFT_CONTRACT ??
    "";

  const commitmentCore =
    process.env.COMMITMENT_CORE_CONTRACT ??
    process.env.NEXT_PUBLIC_COMMITMENT_CORE_CONTRACT ??
    "";

  const attestationEngine =
    process.env.ATTESTATION_ENGINE_CONTRACT ??
    process.env.NEXT_PUBLIC_ATTESTATION_ENGINE_CONTRACT ??
    "";

  // Validate required values in non-test environments
  validateRequired(commitmentNFT, "commitmentNFT", [
    "COMMITMENT_NFT_CONTRACT",
    "NEXT_PUBLIC_COMMITMENT_NFT_CONTRACT",
  ]);
  validateRequired(commitmentCore, "commitmentCore", [
    "COMMITMENT_CORE_CONTRACT",
    "NEXT_PUBLIC_COMMITMENT_CORE_CONTRACT",
  ]);
  validateRequired(attestationEngine, "attestationEngine", [
    "ATTESTATION_ENGINE_CONTRACT",
    "NEXT_PUBLIC_ATTESTATION_ENGINE_CONTRACT",
  ]);

  return {
    sorobanRpcUrl,
    networkPassphrase,
    contractAddresses: {
      commitmentNFT,
      commitmentCore,
      attestationEngine,
    },
    environment: getEnvironment(),
    chainWritesEnabled: process.env.COMMITLABS_ENABLE_CHAIN_WRITES === "true",
  };
}
