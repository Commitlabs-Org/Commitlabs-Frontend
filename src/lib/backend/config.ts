// Versioned contract configuration accessor
// Provides a centralized, typed, and validated way to access contract configs

export interface ContractEntry {
  address: string
  network?: string
  abi?: unknown
}

export type ContractsConfig = Record<string, Record<string, ContractEntry | undefined>>

const LEGACY_ENV_MAPPING = {
  commitmentNFT: 'NEXT_PUBLIC_COMMITMENT_NFT_CONTRACT',
  commitmentCore: 'NEXT_PUBLIC_COMMITMENT_CORE_CONTRACT',
  attestationEngine: 'NEXT_PUBLIC_ATTESTATION_ENGINE_CONTRACT',
}

function buildFromLegacyEnv(): ContractsConfig | null {
  const anySet = Object.values(LEGACY_ENV_MAPPING).some((k) => !!process.env[k])
  if (!anySet) return null

  const v1: Record<string, ContractEntry | undefined> = {}
  for (const [key, envName] of Object.entries(LEGACY_ENV_MAPPING)) {
    const addr = process.env[envName] || ''
    if (addr) v1[key] = { address: addr }
  }

  return Object.keys(v1).length ? { v1 } : null
}

function parseJsonEnv(): ContractsConfig | null {
  const raw = process.env.NEXT_PUBLIC_CONTRACTS_JSON || process.env.CONTRACTS_JSON
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('NEXT_PUBLIC_CONTRACTS_JSON must be a JSON object mapping versions to contract entries')
    }
    return parsed as ContractsConfig
  } catch (err) {
    throw new Error(`Failed to parse NEXT_PUBLIC_CONTRACTS_JSON: ${(err as Error).message}`)
  }
}

let cachedConfig: ContractsConfig | null = null

export function loadContractsConfig(): ContractsConfig {
  if (cachedConfig) return cachedConfig

  const byJson = parseJsonEnv()
  if (byJson) {
    cachedConfig = byJson
    return cachedConfig
  }

  const byLegacy = buildFromLegacyEnv()
  if (byLegacy) {
    cachedConfig = byLegacy
    return cachedConfig
  }

  // No config found; return empty object (validation will catch missing keys when used)
  cachedConfig = {}
  return cachedConfig
}

export function getActiveContractVersion(): string {
  return process.env.NEXT_PUBLIC_ACTIVE_CONTRACT_VERSION || process.env.ACTIVE_CONTRACT_VERSION || 'v1'
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

export function getActiveContracts(): Record<string, ContractEntry> {
  const config = loadContractsConfig()
  const active = getActiveContractVersion()
  const versionConfig = config[active]
  assert(
    !!versionConfig,
    `Active contract version "${active}" not found. Available versions: ${Object.keys(config).join(', ') || '<none>'}`
  )

  // Ensure that entries have addresses
  const result: Record<string, ContractEntry> = {}
  for (const [key, entry] of Object.entries(versionConfig)) {
    if (!entry || !entry.address) {
      throw new Error(
        `Contract entry for key "${key}" in version "${active}" is missing or has no address. Check your config for version ${active}.`
      )
    }
    result[key] = entry
  }

  return result
}

export function getContractAddress(key: string): string {
  const contracts = getActiveContracts()
  const entry = contracts[key]
  if (!entry) throw new Error(`Contract "${key}" not configured in active version "${getActiveContractVersion()}"`)
  return entry.address
export interface BackendConfig {
    sorobanRpcUrl: string;
    networkPassphrase: string;
    commitmentCoreContract: string;
    commitmentNftContract: string;
    attestationEngineContract: string;
    chainWritesEnabled: boolean;
}

export function getBackendConfig(): BackendConfig {
    return {
        sorobanRpcUrl:
            process.env.SOROBAN_RPC_URL ??
            process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ??
            'https://soroban-testnet.stellar.org:443',
        networkPassphrase:
            process.env.SOROBAN_NETWORK_PASSPHRASE ??
            process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ??
            'Test SDF Network ; September 2015',
        commitmentCoreContract:
            process.env.COMMITMENT_CORE_CONTRACT ??
            process.env.NEXT_PUBLIC_COMMITMENT_CORE_CONTRACT ??
            '',
        commitmentNftContract:
            process.env.COMMITMENT_NFT_CONTRACT ??
            process.env.NEXT_PUBLIC_COMMITMENT_NFT_CONTRACT ??
            '',
        attestationEngineContract:
            process.env.ATTESTATION_ENGINE_CONTRACT ??
            process.env.NEXT_PUBLIC_ATTESTATION_ENGINE_CONTRACT ??
            '',
        chainWritesEnabled: process.env.COMMITLABS_ENABLE_CHAIN_WRITES === 'true',
    };
}
