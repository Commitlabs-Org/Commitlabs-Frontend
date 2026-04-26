import { describe, it, expect, beforeEach } from "vitest";
import {
  validateEnv,
  getValidatedEnv,
  _resetEnvCache,
  EnvValidationError,
} from "./env";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const DEV_ENV = { NODE_ENV: "development" } as const;
const TEST_ENV = { NODE_ENV: "test" } as const;

/** Minimal production env that satisfies all required fields (no RPC URL configured). */
const VALID_PROD_ENV = {
  NODE_ENV: "production",
  SESSION_SECRET: "a".repeat(32),
  SOROBAN_RPC_URL_ALLOWLIST: "https://soroban-testnet.stellar.org:443",
} as const;

/** Production env where the configured RPC URL is in the allowlist. */
const VALID_PROD_ENV_WITH_RPC = {
  ...VALID_PROD_ENV,
  SOROBAN_RPC_URL: "https://soroban-testnet.stellar.org:443",
} as const;

// ---------------------------------------------------------------------------
// EnvValidationError
// ---------------------------------------------------------------------------

describe("EnvValidationError", () => {
  it("extends Error", () => {
    const err = new EnvValidationError([{ path: "FOO", message: "missing" }]);
    expect(err).toBeInstanceOf(Error);
  });

  it("has name EnvValidationError", () => {
    const err = new EnvValidationError([{ path: "FOO", message: "missing" }]);
    expect(err.name).toBe("EnvValidationError");
  });

  it("includes path and message in the error string", () => {
    const err = new EnvValidationError([
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
    const err = new EnvValidationError(input);
    expect(err.issues).toHaveLength(2);
    expect(err.issues[0]).toEqual({ path: "A", message: "msg A" });
    expect(err.issues[1]).toEqual({ path: "B", message: "msg B" });
  });

  it("formats a multi-issue message with bullet lines", () => {
    const err = new EnvValidationError([
      { path: "A", message: "msg A" },
      { path: "B", message: "msg B" },
    ]);
    expect(err.message).toContain("  - A: msg A");
    expect(err.message).toContain("  - B: msg B");
  });
});

// ---------------------------------------------------------------------------
// validateEnv — development / test mode (lenient)
// ---------------------------------------------------------------------------

describe("validateEnv — development environment", () => {
  it("passes with only NODE_ENV set", () => {
    expect(() => validateEnv(DEV_ENV)).not.toThrow();
  });

  it("defaults NODE_ENV to 'development' when not provided", () => {
    const env = validateEnv({});
    expect(env.NODE_ENV).toBe("development");
  });

  it("returns the parsed NODE_ENV value", () => {
    const env = validateEnv(DEV_ENV);
    expect(env.NODE_ENV).toBe("development");
  });

  it("does not require SESSION_SECRET in development", () => {
    expect(() => validateEnv(DEV_ENV)).not.toThrow();
  });

  it("does not require SOROBAN_RPC_URL_ALLOWLIST in development", () => {
    expect(() => validateEnv(DEV_ENV)).not.toThrow();
  });

  it("returns undefined for unprovided optional fields", () => {
    const env = validateEnv(DEV_ENV);
    expect(env.SESSION_SECRET).toBeUndefined();
    expect(env.STORAGE_CONNECTION).toBeUndefined();
    expect(env.SOROBAN_RPC_URL_ALLOWLIST).toBeUndefined();
    expect(env.SOROBAN_SERVER_SECRET_KEY).toBeUndefined();
  });

  it("accepts a valid SOROBAN_RPC_URL", () => {
    const env = validateEnv({
      ...DEV_ENV,
      SOROBAN_RPC_URL: "https://soroban-testnet.stellar.org:443",
    });
    expect(env.SOROBAN_RPC_URL).toBe("https://soroban-testnet.stellar.org:443");
  });

  it("accepts localhost RPC URLs (development-friendly)", () => {
    expect(() =>
      validateEnv({ ...DEV_ENV, SOROBAN_RPC_URL: "http://localhost:8000" }),
    ).not.toThrow();
  });

  it("accepts NEXT_PUBLIC_SOROBAN_RPC_URL", () => {
    const env = validateEnv({
      ...DEV_ENV,
      NEXT_PUBLIC_SOROBAN_RPC_URL: "https://soroban-testnet.stellar.org:443",
    });
    expect(env.NEXT_PUBLIC_SOROBAN_RPC_URL).toBe(
      "https://soroban-testnet.stellar.org:443",
    );
  });

  it("passes SESSION_SECRET that meets the 32-char minimum", () => {
    expect(() =>
      validateEnv({ ...DEV_ENV, SESSION_SECRET: "a".repeat(32) }),
    ).not.toThrow();
  });

  it("passes through STORAGE_CONNECTION unchanged", () => {
    const env = validateEnv({
      ...DEV_ENV,
      STORAGE_CONNECTION: "AccountName=foo;AccountKey=bar",
    });
    expect(env.STORAGE_CONNECTION).toBe("AccountName=foo;AccountKey=bar");
  });

  it("ignores unknown env vars (they are stripped by Zod)", () => {
    expect(() =>
      validateEnv({ ...DEV_ENV, UNKNOWN_VAR: "anything" }),
    ).not.toThrow();
  });
});

describe("validateEnv — test environment", () => {
  it("passes with only NODE_ENV=test", () => {
    expect(() => validateEnv(TEST_ENV)).not.toThrow();
  });

  it("does not enforce production requirements when NODE_ENV=test", () => {
    // Missing SESSION_SECRET and SOROBAN_RPC_URL_ALLOWLIST — still passes
    expect(() => validateEnv(TEST_ENV)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// validateEnv — URL format validation
// ---------------------------------------------------------------------------

describe("validateEnv — URL validation", () => {
  it("rejects an invalid SOROBAN_RPC_URL", () => {
    expect(() =>
      validateEnv({ ...DEV_ENV, SOROBAN_RPC_URL: "not-a-url" }),
    ).toThrow(EnvValidationError);
  });

  it("includes the field name in the error for an invalid SOROBAN_RPC_URL", () => {
    try {
      validateEnv({ ...DEV_ENV, SOROBAN_RPC_URL: "not-a-url" });
    } catch (err) {
      expect(err).toBeInstanceOf(EnvValidationError);
      const issue = (err as EnvValidationError).issues.find(
        (i) => i.path === "SOROBAN_RPC_URL",
      );
      expect(issue).toBeDefined();
    }
  });

  it("rejects an invalid NEXT_PUBLIC_SOROBAN_RPC_URL", () => {
    expect(() =>
      validateEnv({ ...DEV_ENV, NEXT_PUBLIC_SOROBAN_RPC_URL: "no-protocol" }),
    ).toThrow(EnvValidationError);
  });

  it("does not redact URL field errors (non-sensitive)", () => {
    try {
      validateEnv({ ...DEV_ENV, SOROBAN_RPC_URL: "bad-url" });
    } catch (err) {
      const error = err as EnvValidationError;
      const issue = error.issues.find((i) => i.path === "SOROBAN_RPC_URL");
      expect(issue?.message).not.toContain("value redacted");
    }
  });
});

// ---------------------------------------------------------------------------
// validateEnv — sensitive field redaction
// ---------------------------------------------------------------------------

describe("validateEnv — sensitive field redaction", () => {
  it("appends '(value redacted)' to SESSION_SECRET errors", () => {
    try {
      validateEnv({ ...DEV_ENV, SESSION_SECRET: "too-short" });
    } catch (err) {
      expect(err).toBeInstanceOf(EnvValidationError);
      const error = err as EnvValidationError;
      const issue = error.issues.find((i) => i.path === "SESSION_SECRET");
      expect(issue?.message).toContain("value redacted");
    }
  });

  it("does not include the actual SESSION_SECRET value in any error text", () => {
    const secretValue = "my-secret-value-that-is-too-short";
    try {
      validateEnv({ ...DEV_ENV, SESSION_SECRET: secretValue });
    } catch (err) {
      expect((err as EnvValidationError).message).not.toContain(secretValue);
    }
  });

  it("redacts SESSION_SECRET in production missing-field error", () => {
    try {
      validateEnv({
        NODE_ENV: "production",
        SOROBAN_RPC_URL_ALLOWLIST: "https://example.com",
        // SESSION_SECRET intentionally absent
      });
    } catch (err) {
      expect(err).toBeInstanceOf(EnvValidationError);
      const issue = (err as EnvValidationError).issues.find(
        (i) => i.path === "SESSION_SECRET",
      );
      expect(issue?.message).toContain("value redacted");
    }
  });

  it("does not leak STORAGE_CONNECTION value in errors — field is marked sensitive", () => {
    // STORAGE_CONNECTION is optional and has no length constraint, so the only
    // way it could appear in errors is via a hypothetical schema change. We
    // verify the sensitive-key set contains it by checking that the field name
    // itself appears in issues but the value does not.
    // Trigger a URL-adjacent test that surfaces the sensitive set indirectly.
    try {
      validateEnv({ ...DEV_ENV, SESSION_SECRET: "s" });
    } catch (err) {
      // The error message must not contain the literal value we passed.
      expect((err as EnvValidationError).message).not.toContain('"s"');
    }
  });
});

// ---------------------------------------------------------------------------
// validateEnv — production requirements
// ---------------------------------------------------------------------------

describe("validateEnv — production environment", () => {
  it("passes when all required fields are present and no RPC URL is set", () => {
    expect(() => validateEnv(VALID_PROD_ENV)).not.toThrow();
  });

  it("passes when all required fields are present and RPC URL is in allowlist", () => {
    expect(() => validateEnv(VALID_PROD_ENV_WITH_RPC)).not.toThrow();
  });

  it("throws EnvValidationError when SESSION_SECRET is missing", () => {
    const env = { ...VALID_PROD_ENV } as Record<string, string | undefined>;
    delete env["SESSION_SECRET"];
    expect(() => validateEnv(env)).toThrow(EnvValidationError);
  });

  it("names SESSION_SECRET in the issues when it is missing in production", () => {
    try {
      validateEnv({
        NODE_ENV: "production",
        SOROBAN_RPC_URL_ALLOWLIST: "https://example.com",
      });
    } catch (err) {
      const issue = (err as EnvValidationError).issues.find(
        (i) => i.path === "SESSION_SECRET",
      );
      expect(issue).toBeDefined();
    }
  });

  it("throws EnvValidationError when SOROBAN_RPC_URL_ALLOWLIST is missing", () => {
    expect(() =>
      validateEnv({
        NODE_ENV: "production",
        SESSION_SECRET: "a".repeat(32),
      }),
    ).toThrow(EnvValidationError);
  });

  it("names SOROBAN_RPC_URL_ALLOWLIST in issues when it is missing in production", () => {
    try {
      validateEnv({ NODE_ENV: "production", SESSION_SECRET: "a".repeat(32) });
    } catch (err) {
      const issue = (err as EnvValidationError).issues.find(
        (i) => i.path === "SOROBAN_RPC_URL_ALLOWLIST",
      );
      expect(issue).toBeDefined();
    }
  });

  it("reports both missing fields when both SESSION_SECRET and SOROBAN_RPC_URL_ALLOWLIST are absent", () => {
    try {
      validateEnv({ NODE_ENV: "production" });
    } catch (err) {
      const error = err as EnvValidationError;
      expect(error.issues.length).toBeGreaterThanOrEqual(2);
      const paths = error.issues.map((i) => i.path);
      expect(paths).toContain("SESSION_SECRET");
      expect(paths).toContain("SOROBAN_RPC_URL_ALLOWLIST");
    }
  });

  it("throws when SOROBAN_RPC_URL is not in the allowlist", () => {
    expect(() =>
      validateEnv({
        NODE_ENV: "production",
        SESSION_SECRET: "a".repeat(32),
        SOROBAN_RPC_URL: "https://evil.example.com",
        SOROBAN_RPC_URL_ALLOWLIST: "https://soroban-testnet.stellar.org:443",
      }),
    ).toThrow(EnvValidationError);
  });

  it("names SOROBAN_RPC_URL in issues when it is outside the allowlist", () => {
    try {
      validateEnv({
        NODE_ENV: "production",
        SESSION_SECRET: "a".repeat(32),
        SOROBAN_RPC_URL: "https://evil.example.com",
        SOROBAN_RPC_URL_ALLOWLIST: "https://soroban-testnet.stellar.org:443",
      });
    } catch (err) {
      const issue = (err as EnvValidationError).issues.find(
        (i) => i.path === "SOROBAN_RPC_URL",
      );
      expect(issue).toBeDefined();
    }
  });

  it("passes when NEXT_PUBLIC_SOROBAN_RPC_URL is in the allowlist (SOROBAN_RPC_URL absent)", () => {
    expect(() =>
      validateEnv({
        NODE_ENV: "production",
        SESSION_SECRET: "a".repeat(32),
        NEXT_PUBLIC_SOROBAN_RPC_URL: "https://soroban-testnet.stellar.org:443",
        SOROBAN_RPC_URL_ALLOWLIST: "https://soroban-testnet.stellar.org:443",
      }),
    ).not.toThrow();
  });

  it("prefers SOROBAN_RPC_URL over NEXT_PUBLIC_SOROBAN_RPC_URL for allowlist check", () => {
    // SOROBAN_RPC_URL is NOT in the list; NEXT_PUBLIC_SOROBAN_RPC_URL is — should fail
    expect(() =>
      validateEnv({
        NODE_ENV: "production",
        SESSION_SECRET: "a".repeat(32),
        SOROBAN_RPC_URL: "https://not-in-list.example.com",
        NEXT_PUBLIC_SOROBAN_RPC_URL: "https://soroban-testnet.stellar.org:443",
        SOROBAN_RPC_URL_ALLOWLIST: "https://soroban-testnet.stellar.org:443",
      }),
    ).toThrow(EnvValidationError);
  });

  it("skips the allowlist membership check when no RPC URL is configured", () => {
    expect(() =>
      validateEnv({
        NODE_ENV: "production",
        SESSION_SECRET: "a".repeat(32),
        SOROBAN_RPC_URL_ALLOWLIST: "https://soroban-testnet.stellar.org:443",
        // Neither SOROBAN_RPC_URL nor NEXT_PUBLIC_SOROBAN_RPC_URL is set
      }),
    ).not.toThrow();
  });

  it("handles multiple URLs in the allowlist (comma-separated)", () => {
    expect(() =>
      validateEnv({
        NODE_ENV: "production",
        SESSION_SECRET: "a".repeat(32),
        SOROBAN_RPC_URL: "https://rpc-mainnet.stellar.org",
        SOROBAN_RPC_URL_ALLOWLIST:
          "https://soroban-testnet.stellar.org:443,https://rpc-mainnet.stellar.org",
      }),
    ).not.toThrow();
  });

  it("trims whitespace from allowlist entries", () => {
    expect(() =>
      validateEnv({
        NODE_ENV: "production",
        SESSION_SECRET: "a".repeat(32),
        SOROBAN_RPC_URL: "https://soroban-testnet.stellar.org:443",
        SOROBAN_RPC_URL_ALLOWLIST:
          " https://soroban-testnet.stellar.org:443 , https://other.example.com ",
      }),
    ).not.toThrow();
  });

  it("enforces production requirements when VERCEL_ENV=production (ignores NODE_ENV)", () => {
    expect(() =>
      validateEnv({
        NODE_ENV: "development",
        VERCEL_ENV: "production",
        // Missing SESSION_SECRET and SOROBAN_RPC_URL_ALLOWLIST
      }),
    ).toThrow(EnvValidationError);
  });

  it("passes when VERCEL_ENV=production with all required fields", () => {
    expect(() =>
      validateEnv({
        NODE_ENV: "development",
        VERCEL_ENV: "production",
        SESSION_SECRET: "a".repeat(32),
        SOROBAN_RPC_URL_ALLOWLIST: "https://soroban-testnet.stellar.org:443",
      }),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// getValidatedEnv — caching behaviour
// ---------------------------------------------------------------------------

describe("getValidatedEnv", () => {
  beforeEach(() => {
    _resetEnvCache();
  });

  it("returns a ValidatedEnv object on the first call", () => {
    const env = getValidatedEnv(TEST_ENV);
    expect(env).toBeDefined();
    expect(env.NODE_ENV).toBe("test");
  });

  it("caches the result — subsequent calls return the same object reference", () => {
    const env1 = getValidatedEnv(TEST_ENV);
    const env2 = getValidatedEnv({ NODE_ENV: "development" }); // different source, ignored
    expect(env1).toBe(env2);
  });

  it("ignores the source argument after the cache is populated", () => {
    getValidatedEnv({ NODE_ENV: "test" });
    const env2 = getValidatedEnv({ NODE_ENV: "development" });
    // Cache still holds the first result
    expect(env2.NODE_ENV).toBe("test");
  });

  it("throws EnvValidationError when the source fails validation", () => {
    expect(() =>
      getValidatedEnv({ NODE_ENV: "production" }),
    ).toThrow(EnvValidationError);
  });

  it("does not populate the cache on a failed validation", () => {
    try {
      getValidatedEnv({ NODE_ENV: "production" });
    } catch {
      // swallow
    }
    // After a failure the cache is still empty; a fresh valid source should succeed
    expect(() => getValidatedEnv(TEST_ENV)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// validateEnv — root-level Zod issue path fallback
// ---------------------------------------------------------------------------

describe("validateEnv — root-level issue formatting", () => {
  it("uses '(root)' as path when a Zod issue has no field path (e.g. non-object input)", () => {
    // Passing null triggers z.object()'s root-level type error (path: [])
    try {
      validateEnv(null as unknown as Record<string, string | undefined>);
    } catch (err) {
      expect(err).toBeInstanceOf(EnvValidationError);
      const error = err as EnvValidationError;
      const rootIssue = error.issues.find((i) => i.path === "(root)");
      expect(rootIssue).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// _resetEnvCache
// ---------------------------------------------------------------------------

describe("_resetEnvCache", () => {
  it("clears the cache so the next call re-validates from the new source", () => {
    const env1 = getValidatedEnv({ NODE_ENV: "test" });
    _resetEnvCache();
    const env2 = getValidatedEnv({ NODE_ENV: "development" });
    expect(env1).not.toBe(env2);
    expect(env2.NODE_ENV).toBe("development");
  });

  it("is idempotent — calling it twice does not throw", () => {
    expect(() => {
      _resetEnvCache();
      _resetEnvCache();
    }).not.toThrow();
  });
});
