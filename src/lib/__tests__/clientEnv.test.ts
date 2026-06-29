import { describe, it, expect, beforeEach } from "vitest";
import {
  validateClientEnv,
  getValidatedClientEnv,
  _resetClientEnvCache,
  ClientEnvValidationError,
} from "../clientEnv";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const VALID_CLIENT_ENV = {
  NEXT_PUBLIC_SOROBAN_RPC_URL: "https://soroban-testnet.stellar.org:443",
  NEXT_PUBLIC_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
  NEXT_PUBLIC_COMMITMENT_NFT_CONTRACT: "CABC123...",
  NEXT_PUBLIC_COMMITMENT_CORE_CONTRACT: "CDEF456...",
  NEXT_PUBLIC_ATTESTATION_ENGINE_CONTRACT: "CGHI789...",
  NEXT_PUBLIC_ACTIVE_CONTRACT_VERSION: "v1",
  NEXT_PUBLIC_USE_MOCKS: "true",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
} as const;

const MINIMAL_CLIENT_ENV = {
  NEXT_PUBLIC_SOROBAN_RPC_URL: "https://soroban-testnet.stellar.org:443",
} as const;

// ---------------------------------------------------------------------------
// ClientEnvValidationError
// ---------------------------------------------------------------------------

describe("ClientEnvValidationError", () => {
  it("extends Error", () => {
    const err = new ClientEnvValidationError([{ path: "FOO", message: "missing" }]);
    expect(err).toBeInstanceOf(Error);
  });

  it("has name ClientEnvValidationError", () => {
    const err = new ClientEnvValidationError([{ path: "FOO", message: "missing" }]);
    expect(err.name).toBe("ClientEnvValidationError");
  });

  it("includes path and message in the error string", () => {
    const err = new ClientEnvValidationError([
      { path: "SOME_VAR", message: "is required" },
    ]);
    expect(err.message).toContain("SOME_VAR");
    expect(err.message).toContain("is required");
  });

  it("exposes a readonly issues array", () => {
    const input = [
      { path: "A", message: "msg A" },
      { path: "B", message: "msg B" },
    ];
    const err = new ClientEnvValidationError(input);
    expect(err.issues).toHaveLength(2);
    expect(err.issues[0]).toEqual({ path: "A", message: "msg A" });
    expect(err.issues[1]).toEqual({ path: "B", message: "msg B" });
  });

  it("formats a multi-issue message with bullet lines", () => {
    const err = new ClientEnvValidationError([
      { path: "A", message: "msg A" },
      { path: "B", message: "msg B" },
    ]);
    expect(err.message).toContain("  - A: msg A");
    expect(err.message).toContain("  - B: msg B");
  });
});

// ---------------------------------------------------------------------------
// validateClientEnv — basic validation
// ---------------------------------------------------------------------------

describe("validateClientEnv — basic validation", () => {
  it("passes with no environment variables (all optional)", () => {
    expect(() => validateClientEnv({})).not.toThrow();
  });

  it("returns undefined for unprovided optional fields", () => {
    const env = validateClientEnv({});
    expect(env.NEXT_PUBLIC_SOROBAN_RPC_URL).toBeUndefined();
    expect(env.NEXT_PUBLIC_NETWORK_PASSPHRASE).toBeUndefined();
    expect(env.NEXT_PUBLIC_COMMITMENT_NFT_CONTRACT).toBeUndefined();
  });

  it("accepts a valid NEXT_PUBLIC_SOROBAN_RPC_URL", () => {
    const env = validateClientEnv(MINIMAL_CLIENT_ENV);
    expect(env.NEXT_PUBLIC_SOROBAN_RPC_URL).toBe(
      "https://soroban-testnet.stellar.org:443",
    );
  });

  it("accepts localhost RPC URLs (development-friendly)", () => {
    expect(() =>
      validateClientEnv({
        NEXT_PUBLIC_SOROBAN_RPC_URL: "http://localhost:8000",
      }),
    ).not.toThrow();
  });

  it("accepts all valid client environment variables", () => {
    const env = validateClientEnv(VALID_CLIENT_ENV);
    expect(env.NEXT_PUBLIC_SOROBAN_RPC_URL).toBe(
      "https://soroban-testnet.stellar.org:443",
    );
    expect(env.NEXT_PUBLIC_NETWORK_PASSPHRASE).toBe(
      "Test SDF Network ; September 2015",
    );
    expect(env.NEXT_PUBLIC_COMMITMENT_NFT_CONTRACT).toBe("CABC123...");
    expect(env.NEXT_PUBLIC_COMMITMENT_CORE_CONTRACT).toBe("CDEF456...");
    expect(env.NEXT_PUBLIC_ATTESTATION_ENGINE_CONTRACT).toBe("CGHI789...");
    expect(env.NEXT_PUBLIC_ACTIVE_CONTRACT_VERSION).toBe("v1");
    expect(env.NEXT_PUBLIC_USE_MOCKS).toBe("true");
    expect(env.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
    expect(env.NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
  });

  it("ignores non-NEXT_PUBLIC_ environment variables", () => {
    expect(() =>
      validateClientEnv({
        ...MINIMAL_CLIENT_ENV,
        SECRET_KEY: "should-be-ignored",
        DATABASE_URL: "should-be-ignored",
      }),
    ).not.toThrow();
  });

  it("filters out non-NEXT_PUBLIC_ variables from the result", () => {
    const env = validateClientEnv({
      ...MINIMAL_CLIENT_ENV,
      SECRET_KEY: "should-be-ignored",
    });
    expect(env).not.toHaveProperty("SECRET_KEY");
  });
});

// ---------------------------------------------------------------------------
// validateClientEnv — URL format validation
// ---------------------------------------------------------------------------

describe("validateClientEnv — URL validation", () => {
  it("rejects an invalid NEXT_PUBLIC_SOROBAN_RPC_URL", () => {
    expect(() =>
      validateClientEnv({ NEXT_PUBLIC_SOROBAN_RPC_URL: "not-a-url" }),
    ).toThrow(ClientEnvValidationError);
  });

  it("includes the field name in the error for an invalid NEXT_PUBLIC_SOROBAN_RPC_URL", () => {
    try {
      validateClientEnv({ NEXT_PUBLIC_SOROBAN_RPC_URL: "not-a-url" });
    } catch (err) {
      expect(err).toBeInstanceOf(ClientEnvValidationError);
      const issue = (err as ClientEnvValidationError).issues.find(
        (i) => i.path === "NEXT_PUBLIC_SOROBAN_RPC_URL",
      );
      expect(issue).toBeDefined();
    }
  });

  it("rejects an invalid NEXT_PUBLIC_APP_URL", () => {
    expect(() =>
      validateClientEnv({ NEXT_PUBLIC_APP_URL: "no-protocol" }),
    ).toThrow(ClientEnvValidationError);
  });

  it("rejects an invalid NEXT_PUBLIC_SITE_URL", () => {
    expect(() =>
      validateClientEnv({ NEXT_PUBLIC_SITE_URL: "not-a-url" }),
    ).toThrow(ClientEnvValidationError);
  });

  it("accepts valid HTTPS URLs", () => {
    expect(() =>
      validateClientEnv({
        NEXT_PUBLIC_SOROBAN_RPC_URL: "https://example.com",
        NEXT_PUBLIC_APP_URL: "https://example.com",
        NEXT_PUBLIC_SITE_URL: "https://example.com",
      }),
    ).not.toThrow();
  });

  it("accepts valid HTTP URLs (for local development)", () => {
    expect(() =>
      validateClientEnv({
        NEXT_PUBLIC_SOROBAN_RPC_URL: "http://localhost:8000",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
        NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
      }),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// validateClientEnv — security: prevents secret exposure
// ---------------------------------------------------------------------------

describe("validateClientEnv — security: prevents secret exposure", () => {
  it("does not include non-NEXT_PUBLIC_ variables in validation", () => {
    // This test ensures that secrets without NEXT_PUBLIC_ prefix are not validated
    // and therefore won't accidentally be exposed through the client env module
    const env = validateClientEnv({
      SECRET_KEY: "my-secret-value",
      DATABASE_PASSWORD: "my-password",
    });
    expect(env).not.toHaveProperty("SECRET_KEY");
    expect(env).not.toHaveProperty("DATABASE_PASSWORD");
  });

  it("only validates variables with NEXT_PUBLIC_ prefix", () => {
    const env = validateClientEnv({
      NEXT_PUBLIC_SOROBAN_RPC_URL: "https://example.com",
      PRIVATE_VAR: "should-not-appear",
    });
    expect(env.NEXT_PUBLIC_SOROBAN_RPC_URL).toBe("https://example.com");
    expect(env).not.toHaveProperty("PRIVATE_VAR");
  });
});

// ---------------------------------------------------------------------------
// validateClientEnv — malformed values
// ---------------------------------------------------------------------------

describe("validateClientEnv — malformed values", () => {
  it("reports multiple validation errors together", () => {
    try {
      validateClientEnv({
        NEXT_PUBLIC_SOROBAN_RPC_URL: "not-a-url",
        NEXT_PUBLIC_APP_URL: "also-not-a-url",
      });
    } catch (err) {
      const error = err as ClientEnvValidationError;
      expect(error.issues.length).toBeGreaterThanOrEqual(2);
      const paths = error.issues.map((i) => i.path);
      expect(paths).toContain("NEXT_PUBLIC_SOROBAN_RPC_URL");
      expect(paths).toContain("NEXT_PUBLIC_APP_URL");
    }
  });

  it("accepts empty string values (optional fields)", () => {
    expect(() =>
      validateClientEnv({
        NEXT_PUBLIC_SOROBAN_RPC_URL: "",
        NEXT_PUBLIC_NETWORK_PASSPHRASE: "",
      }),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// getValidatedClientEnv — caching behaviour
// ---------------------------------------------------------------------------

describe("getValidatedClientEnv", () => {
  beforeEach(() => {
    _resetClientEnvCache();
  });

  it("returns a ValidatedClientEnv object on the first call", () => {
    const env = getValidatedClientEnv(MINIMAL_CLIENT_ENV);
    expect(env).toBeDefined();
    expect(env.NEXT_PUBLIC_SOROBAN_RPC_URL).toBe(
      "https://soroban-testnet.stellar.org:443",
    );
  });

  it("caches the result — subsequent calls return the same object reference", () => {
    const env1 = getValidatedClientEnv(MINIMAL_CLIENT_ENV);
    const env2 = getValidatedClientEnv({ NEXT_PUBLIC_SOROBAN_RPC_URL: "https://different.com" });
    expect(env1).toBe(env2);
  });

  it("ignores the source argument after the cache is populated", () => {
    getValidatedClientEnv(MINIMAL_CLIENT_ENV);
    const env2 = getValidatedClientEnv({ NEXT_PUBLIC_SOROBAN_RPC_URL: "https://different.com" });
    // Cache still holds the first result
    expect(env2.NEXT_PUBLIC_SOROBAN_RPC_URL).toBe("https://soroban-testnet.stellar.org:443");
  });

  it("throws ClientEnvValidationError when the source fails validation", () => {
    expect(() =>
      getValidatedClientEnv({ NEXT_PUBLIC_SOROBAN_RPC_URL: "not-a-url" }),
    ).toThrow(ClientEnvValidationError);
  });

  it("does not populate the cache on a failed validation", () => {
    try {
      getValidatedClientEnv({ NEXT_PUBLIC_SOROBAN_RPC_URL: "not-a-url" });
    } catch {
      // swallow
    }
    // After a failure the cache is still empty; a fresh valid source should succeed
    expect(() => getValidatedClientEnv(MINIMAL_CLIENT_ENV)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// _resetClientEnvCache
// ---------------------------------------------------------------------------

describe("_resetClientEnvCache", () => {
  it("clears the cache so the next call re-validates from the new source", () => {
    const env1 = getValidatedClientEnv(MINIMAL_CLIENT_ENV);
    _resetClientEnvCache();
    const env2 = getValidatedClientEnv({ NEXT_PUBLIC_SOROBAN_RPC_URL: "https://different.com" });
    expect(env1).not.toBe(env2);
    expect(env2.NEXT_PUBLIC_SOROBAN_RPC_URL).toBe("https://different.com");
  });

  it("is idempotent — calling it twice does not throw", () => {
    expect(() => {
      _resetClientEnvCache();
      _resetClientEnvCache();
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// validateClientEnv — root-level Zod issue path fallback
// ---------------------------------------------------------------------------

describe("validateClientEnv — root-level issue formatting", () => {
  it("uses '(root)' as path when a Zod issue has no field path (e.g. non-object input)", () => {
    // Passing null triggers z.object()'s root-level type error (path: [])
    try {
      validateClientEnv(null as unknown as Record<string, string | undefined>);
    } catch (err) {
      expect(err).toBeInstanceOf(ClientEnvValidationError);
      const error = err as ClientEnvValidationError;
      const rootIssue = error.issues.find((i) => i.path === "(root)");
      expect(rootIssue).toBeDefined();
    }
  });
});
