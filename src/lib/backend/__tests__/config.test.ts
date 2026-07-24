import { beforeEach, describe, expect, it } from "vitest";
import {
  _resetEnvCache,
  getActiveContractVersion,
  getActiveContracts,
  getBackendConfig,
  getContractAddress,
  getFeatureFlags,
  isFeatureEnabled,
  loadContractsConfig,
} from "../config";
import { _resetEnvCache as _resetConfigCache } from "../config";
import { _resetEnvCache as resetEnv } from "../env";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_BASE = { NODE_ENV: "test" } as const;

/** Minimal env with all three legacy contract addresses set. */
const LEGACY_CONTRACT_ENV = {
  ...TEST_BASE,
  COMMITMENT_NFT_CONTRACT: "GNFT111",
  COMMITMENT_CORE_CONTRACT: "GCORE222",
  ATTESTATION_ENGINE_CONTRACT: "GATTEST333",
} as const;

/** A valid JSON contracts payload for NEXT_PUBLIC_CONTRACTS_JSON. */
const JSON_CONTRACTS = JSON.stringify({
  v1: {
    commitmentNFT: { address: "GJSON_NFT" },
    commitmentCore: { address: "GJSON_CORE" },
    attestationEngine: { address: "GJSON_ATTEST" },
  },
});

function stubEnv(vars: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function clearContractEnvVars(): void {
  const keys = [
    "COMMITMENT_NFT_CONTRACT",
    "NEXT_PUBLIC_COMMITMENT_NFT_CONTRACT",
    "COMMITMENT_CORE_CONTRACT",
    "NEXT_PUBLIC_COMMITMENT_CORE_CONTRACT",
    "ATTESTATION_ENGINE_CONTRACT",
    "NEXT_PUBLIC_ATTESTATION_ENGINE_CONTRACT",
    "NEXT_PUBLIC_CONTRACTS_JSON",
    "CONTRACTS_JSON",
    "NEXT_PUBLIC_ACTIVE_CONTRACT_VERSION",
    "ACTIVE_CONTRACT_VERSION",
    "SOROBAN_RPC_URL",
    "NEXT_PUBLIC_SOROBAN_RPC_URL",
    "SOROBAN_NETWORK_PASSPHRASE",
    "NEXT_PUBLIC_NETWORK_PASSPHRASE",
    "COMMITLABS_ENABLE_CHAIN_WRITES",
    "COMMITLABS_FEATURE_ANALYTICS_USER",
    "COMMITLABS_FEATURE_MARKETPLACE",
    "COMMITLABS_FEATURE_FLAGS_JSON",
    "VERCEL_ENV",
  ];
  for (const k of keys) delete process.env[k];
}

// ---------------------------------------------------------------------------
// Reset caches before each test so tests are fully isolated
// ---------------------------------------------------------------------------

beforeEach(() => {
  clearContractEnvVars();
  process.env.NODE_ENV = "test";
  resetEnv();
  _resetEnvCache();
});

// ---------------------------------------------------------------------------
// loadContractsConfig — JSON path
// ---------------------------------------------------------------------------

describe("loadContractsConfig — JSON env var", () => {
  it("parses NEXT_PUBLIC_CONTRACTS_JSON into a ContractsConfig", () => {
    process.env.NEXT_PUBLIC_CONTRACTS_JSON = JSON_CONTRACTS;
    const config = loadContractsConfig();
    expect(config).toHaveProperty("v1");
    expect(config.v1?.commitmentNFT?.address).toBe("GJSON_NFT");
  });

  it("also accepts CONTRACTS_JSON (server-side alias)", () => {
    process.env.CONTRACTS_JSON = JSON_CONTRACTS;
    const config = loadContractsConfig();
    expect(config.v1?.commitmentCore?.address).toBe("GJSON_CORE");
  });

  it("throws when the JSON value is not an object", () => {
    process.env.NEXT_PUBLIC_CONTRACTS_JSON = '"just-a-string"';
    expect(() => loadContractsConfig()).toThrow(/NEXT_PUBLIC_CONTRACTS_JSON/);
  });

  it("throws when the JSON is malformed", () => {
    process.env.NEXT_PUBLIC_CONTRACTS_JSON = "{ bad json }";
    expect(() => loadContractsConfig()).toThrow(/Failed to parse/);
  });
});

// ---------------------------------------------------------------------------
// loadContractsConfig — legacy env-var path
// ---------------------------------------------------------------------------

describe("loadContractsConfig — legacy contract env vars", () => {
  it("builds a v1 config from individual COMMITMENT_* env vars", () => {
    stubEnv(LEGACY_CONTRACT_ENV);
    const config = loadContractsConfig();
    expect(config.v1?.commitmentNFT?.address).toBe("GNFT111");
    expect(config.v1?.commitmentCore?.address).toBe("GCORE222");
    expect(config.v1?.attestationEngine?.address).toBe("GATTEST333");
  });

  it("falls back to NEXT_PUBLIC_* prefixed vars when primary vars are absent", () => {
    process.env.NEXT_PUBLIC_COMMITMENT_NFT_CONTRACT = "GNFT_PUB";
    process.env.NEXT_PUBLIC_COMMITMENT_CORE_CONTRACT = "GCORE_PUB";
    process.env.NEXT_PUBLIC_ATTESTATION_ENGINE_CONTRACT = "GATTEST_PUB";
    const config = loadContractsConfig();
    expect(config.v1?.commitmentNFT?.address).toBe("GNFT_PUB");
  });

  it("returns an empty object when no contract vars are set", () => {
    const config = loadContractsConfig();
    expect(config).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// loadContractsConfig — caching / memoization
// ---------------------------------------------------------------------------

describe("loadContractsConfig — memoization", () => {
  it("returns the same object reference on repeated calls", () => {
    stubEnv(LEGACY_CONTRACT_ENV);
    const first = loadContractsConfig();
    const second = loadContractsConfig();
    expect(first).toBe(second);
  });

  it("_resetEnvCache clears the contract cache so the next call re-reads env", () => {
    stubEnv(LEGACY_CONTRACT_ENV);
    const first = loadContractsConfig();
    _resetConfigCache();
    resetEnv();
    process.env.COMMITMENT_NFT_CONTRACT = "GNFT_UPDATED";
    const second = loadContractsConfig();
    expect(first).not.toBe(second);
    expect(second.v1?.commitmentNFT?.address).toBe("GNFT_UPDATED");
  });
});

// ---------------------------------------------------------------------------
// getActiveContractVersion
// ---------------------------------------------------------------------------

describe("getActiveContractVersion", () => {
  it("defaults to 'v1' when no version env var is set", () => {
    expect(getActiveContractVersion()).toBe("v1");
  });

  it("returns NEXT_PUBLIC_ACTIVE_CONTRACT_VERSION when set", () => {
    process.env.NEXT_PUBLIC_ACTIVE_CONTRACT_VERSION = "v2";
    resetEnv();
    expect(getActiveContractVersion()).toBe("v2");
  });

  it("prefers ACTIVE_CONTRACT_VERSION over the NEXT_PUBLIC_ variant", () => {
    process.env.ACTIVE_CONTRACT_VERSION = "v3";
    process.env.NEXT_PUBLIC_ACTIVE_CONTRACT_VERSION = "v2";
    resetEnv();
    expect(getActiveContractVersion()).toBe("v3");
  });
});

// ---------------------------------------------------------------------------
// getActiveContracts
// ---------------------------------------------------------------------------

describe("getActiveContracts", () => {
  it("returns the contracts for the active version", () => {
    process.env.NEXT_PUBLIC_CONTRACTS_JSON = JSON_CONTRACTS;
    const contracts = getActiveContracts();
    expect(contracts.commitmentNFT.address).toBe("GJSON_NFT");
    expect(contracts.commitmentCore.address).toBe("GJSON_CORE");
    expect(contracts.attestationEngine.address).toBe("GJSON_ATTEST");
  });

  it("throws when the active version is not present in the config", () => {
    process.env.NEXT_PUBLIC_CONTRACTS_JSON = JSON_CONTRACTS;
    process.env.NEXT_PUBLIC_ACTIVE_CONTRACT_VERSION = "v99";
    resetEnv();
    expect(() => getActiveContracts()).toThrow(/v99/);
  });

  it("throws when a contract entry has no address", () => {
    process.env.NEXT_PUBLIC_CONTRACTS_JSON = JSON.stringify({
      v1: { commitmentNFT: { address: "" } },
    });
    expect(() => getActiveContracts()).toThrow(/address/);
  });
});

// ---------------------------------------------------------------------------
// getContractAddress
// ---------------------------------------------------------------------------

describe("getContractAddress", () => {
  it("returns the address for a known contract key", () => {
    process.env.NEXT_PUBLIC_CONTRACTS_JSON = JSON_CONTRACTS;
    expect(getContractAddress("commitmentNFT")).toBe("GJSON_NFT");
  });

  it("throws for an unknown contract key", () => {
    process.env.NEXT_PUBLIC_CONTRACTS_JSON = JSON_CONTRACTS;
    expect(() => getContractAddress("unknownContract")).toThrow(/unknownContract/);
  });
});

// ---------------------------------------------------------------------------
// getBackendConfig — defaults and env wiring
// ---------------------------------------------------------------------------

describe("getBackendConfig", () => {
  it("returns the default Soroban RPC URL when no env var is set", () => {
    const cfg = getBackendConfig();
    expect(cfg.sorobanRpcUrl).toBe("https://soroban-testnet.stellar.org:443");
  });

  it("uses SOROBAN_RPC_URL when provided", () => {
    process.env.SOROBAN_RPC_URL = "https://rpc.example.com";
    resetEnv();
    const cfg = getBackendConfig();
    expect(cfg.sorobanRpcUrl).toBe("https://rpc.example.com");
  });

  it("falls back to NEXT_PUBLIC_SOROBAN_RPC_URL when primary is absent", () => {
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL = "https://pub-rpc.example.com";
    resetEnv();
    const cfg = getBackendConfig();
    expect(cfg.sorobanRpcUrl).toBe("https://pub-rpc.example.com");
  });

  it("returns the default network passphrase when no env var is set", () => {
    const cfg = getBackendConfig();
    expect(cfg.networkPassphrase).toBe("Test SDF Network ; September 2015");
  });

  it("uses SOROBAN_NETWORK_PASSPHRASE when provided", () => {
    process.env.SOROBAN_NETWORK_PASSPHRASE = "Public Global Stellar Network ; September 2015";
    resetEnv();
    const cfg = getBackendConfig();
    expect(cfg.networkPassphrase).toBe("Public Global Stellar Network ; September 2015");
  });

  it("chainWritesEnabled is false by default", () => {
    const cfg = getBackendConfig();
    expect(cfg.chainWritesEnabled).toBe(false);
  });

  it("chainWritesEnabled is true when COMMITLABS_ENABLE_CHAIN_WRITES=true", () => {
    process.env.COMMITLABS_ENABLE_CHAIN_WRITES = "true";
    resetEnv();
    const cfg = getBackendConfig();
    expect(cfg.chainWritesEnabled).toBe(true);
  });

  it("returns activeVersion matching the configured version", () => {
    process.env.NEXT_PUBLIC_CONTRACTS_JSON = JSON_CONTRACTS;
    const cfg = getBackendConfig();
    expect(cfg.activeVersion).toBe("v1");
  });

  it("returns empty contract addresses in test env (no contract vars set)", () => {
    const cfg = getBackendConfig();
    expect(cfg.contractAddresses.commitmentNFT).toBe("");
    expect(cfg.contractAddresses.commitmentCore).toBe("");
    expect(cfg.contractAddresses.attestationEngine).toBe("");
  });

  it("fills contract addresses from JSON config", () => {
    process.env.NEXT_PUBLIC_CONTRACTS_JSON = JSON_CONTRACTS;
    const cfg = getBackendConfig();
    expect(cfg.contractAddresses.commitmentNFT).toBe("GJSON_NFT");
    expect(cfg.contractAddresses.commitmentCore).toBe("GJSON_CORE");
    expect(cfg.contractAddresses.attestationEngine).toBe("GJSON_ATTEST");
  });
});

// ---------------------------------------------------------------------------
// getBackendConfig — environment detection
// ---------------------------------------------------------------------------

describe("getBackendConfig — environment field", () => {
  it("returns 'development' when NODE_ENV=test", () => {
    const cfg = getBackendConfig();
    expect(cfg.environment).toBe("development");
  });

  it("returns 'development' when NODE_ENV=development", () => {
    process.env.NODE_ENV = "development";
    resetEnv();
    const cfg = getBackendConfig();
    expect(cfg.environment).toBe("development");
  });

  it("returns 'preview' when VERCEL_ENV=preview", () => {
    process.env.VERCEL_ENV = "preview";
    resetEnv();
    const cfg = getBackendConfig();
    expect(cfg.environment).toBe("preview");
  });
});

// ---------------------------------------------------------------------------
// getFeatureFlags
// ---------------------------------------------------------------------------

describe("getFeatureFlags", () => {
  it("returns false for all flags when no env vars are set", () => {
    const flags = getFeatureFlags();
    expect(flags.analyticsUser).toBe(false);
    expect(flags.marketplace).toBe(false);
  });

  it("enables analyticsUser via COMMITLABS_FEATURE_ANALYTICS_USER=1", () => {
    process.env.COMMITLABS_FEATURE_ANALYTICS_USER = "1";
    resetEnv();
    expect(getFeatureFlags().analyticsUser).toBe(true);
  });

  it("enables marketplace via COMMITLABS_FEATURE_MARKETPLACE=true", () => {
    process.env.COMMITLABS_FEATURE_MARKETPLACE = "true";
    resetEnv();
    expect(getFeatureFlags().marketplace).toBe(true);
  });

  it("parses flags from COMMITLABS_FEATURE_FLAGS_JSON", () => {
    process.env.COMMITLABS_FEATURE_FLAGS_JSON = JSON.stringify({
      analyticsUser: true,
      marketplace: false,
    });
    resetEnv();
    const flags = getFeatureFlags();
    expect(flags.analyticsUser).toBe(true);
    expect(flags.marketplace).toBe(false);
  });

  it("JSON flags take precedence over individual env var flags", () => {
    process.env.COMMITLABS_FEATURE_MARKETPLACE = "true";
    process.env.COMMITLABS_FEATURE_FLAGS_JSON = JSON.stringify({
      marketplace: false,
    });
    resetEnv();
    expect(getFeatureFlags().marketplace).toBe(false);
  });

  it("throws when COMMITLABS_FEATURE_FLAGS_JSON is malformed", () => {
    process.env.COMMITLABS_FEATURE_FLAGS_JSON = "{ bad json }";
    resetEnv();
    expect(() => getFeatureFlags()).toThrow(/COMMITLABS_FEATURE_FLAGS_JSON/);
  });
});

// ---------------------------------------------------------------------------
// isFeatureEnabled
// ---------------------------------------------------------------------------

describe("isFeatureEnabled", () => {
  it("returns false for a disabled feature", () => {
    expect(isFeatureEnabled("marketplace")).toBe(false);
  });

  it("returns true for an enabled feature", () => {
    process.env.COMMITLABS_FEATURE_MARKETPLACE = "yes";
    resetEnv();
    expect(isFeatureEnabled("marketplace")).toBe(true);
  });
});
