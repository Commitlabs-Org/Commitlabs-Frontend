// Backend environment variable validation.
// All process.env reads for backend config flow through getValidatedEnv().
// In production the module validates eagerly (fail fast); in dev/test it is
// lazy and lenient (only URL format and minimum-length constraints apply).

import { z } from "zod";

/** Env var names whose raw values must never appear in error output */
const SENSITIVE_ENV_KEYS = new Set([
  "SOROBAN_SERVER_SECRET_KEY",
  "SESSION_SECRET",
  "STORAGE_CONNECTION",
]);

/** URL validation that works with Zod v4 */
const urlSchema = z.string().refine(
  (val) => {
    try {
      new URL(val);
      return true;
    } catch {
      return false;
    }
  },
  { message: "Must be a valid URL (e.g. https://example.com)" },
);

/**
 * Schema for all recognised backend environment variables.
 * Every field is optional at this level; additional requirements for
 * production (or non-test) environments are enforced inside validateEnv().
 */
const envSchema = z.object({
  // Runtime environment
  NODE_ENV: z
    .enum(["development", "test", "production"] as const)
    .default("development"),
  VERCEL_ENV: z
    .enum(["production", "preview", "development"] as const)
    .optional(),

  // Soroban RPC endpoints — format-validated when present
  SOROBAN_RPC_URL: urlSchema.optional(),
  NEXT_PUBLIC_SOROBAN_RPC_URL: urlSchema.optional(),

  // Stellar network passphrase
  SOROBAN_NETWORK_PASSPHRASE: z.string().optional(),
  NEXT_PUBLIC_NETWORK_PASSPHRASE: z.string().optional(),

  // Soroban contract addresses
  COMMITMENT_NFT_CONTRACT: z.string().optional(),
  NEXT_PUBLIC_COMMITMENT_NFT_CONTRACT: z.string().optional(),
  COMMITMENT_CORE_CONTRACT: z.string().optional(),
  NEXT_PUBLIC_COMMITMENT_CORE_CONTRACT: z.string().optional(),
  ATTESTATION_ENGINE_CONTRACT: z.string().optional(),
  NEXT_PUBLIC_ATTESTATION_ENGINE_CONTRACT: z.string().optional(),

  // Signing credentials — SENSITIVE: values never appear in error messages
  SOROBAN_SERVER_SECRET_KEY: z.string().optional(),
  SOROBAN_SOURCE_ACCOUNT: z.string().optional(),

  // Session signing secret — SENSITIVE, min 32 chars when provided
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 characters")
    .optional(),

  // Blob / database connection string — SENSITIVE
  STORAGE_CONNECTION: z.string().optional(),

  // Comma-separated list of permitted Soroban RPC URLs (required in production)
  SOROBAN_RPC_URL_ALLOWLIST: z.string().optional(),

  // Feature flag toggles
  COMMITLABS_ENABLE_CHAIN_WRITES: z.string().optional(),
  COMMITLABS_FEATURE_ANALYTICS_USER: z.string().optional(),
  COMMITLABS_FEATURE_MARKETPLACE: z.string().optional(),
  COMMITLABS_FEATURE_FLAGS_JSON: z.string().optional(),

  // Contract version / JSON overrides
  NEXT_PUBLIC_CONTRACTS_JSON: z.string().optional(),
  CONTRACTS_JSON: z.string().optional(),
  NEXT_PUBLIC_ACTIVE_CONTRACT_VERSION: z.string().optional(),
  ACTIVE_CONTRACT_VERSION: z.string().optional(),

  // Mock-mode flag
  NEXT_PUBLIC_USE_MOCKS: z.string().optional(),
});

/** Fully validated, type-safe environment object */
export type ValidatedEnv = z.infer<typeof envSchema>;

/**
 * Thrown whenever environment validation fails.
 * Sensitive values are always redacted from the issues list and the message.
 */
export class EnvValidationError extends Error {
  readonly issues: ReadonlyArray<{ path: string; message: string }>;

  constructor(issues: Array<{ path: string; message: string }>) {
    const lines = issues
      .map(({ path, message }) => `  - ${path}: ${message}`)
      .join("\n");
    super(`Environment validation failed:\n${lines}`);
    this.name = "EnvValidationError";
    this.issues = issues;
  }
}

function formatZodIssues(
  zodError: z.ZodError,
): Array<{ path: string; message: string }> {
  return zodError.issues.map((issue) => {
    const path = issue.path.join(".") || "(root)";
    const isSensitive = SENSITIVE_ENV_KEYS.has(path);
    return {
      path,
      message: isSensitive
        ? `${issue.message} (value redacted)`
        : issue.message,
    };
  });
}

/**
 * Returns additional issues that are only enforced in production
 * (NODE_ENV=production or VERCEL_ENV=production).
 */
function checkProductionRequirements(
  data: ValidatedEnv,
): Array<{ path: string; message: string }> {
  const isProduction =
    data.NODE_ENV === "production" || data.VERCEL_ENV === "production";

  if (!isProduction) return [];

  const issues: Array<{ path: string; message: string }> = [];

  if (!data.SESSION_SECRET) {
    issues.push({
      path: "SESSION_SECRET",
      message:
        "Required in production — generate a secure random secret of at least 32 characters (value redacted)",
    });
  }

  if (!data.SOROBAN_RPC_URL_ALLOWLIST) {
    issues.push({
      path: "SOROBAN_RPC_URL_ALLOWLIST",
      message:
        "Required in production — provide a comma-separated list of permitted Soroban RPC URLs",
    });
  } else {
    // Verify the active RPC URL is within the allowlist
    const rpcUrl =
      data.SOROBAN_RPC_URL ?? data.NEXT_PUBLIC_SOROBAN_RPC_URL;
    if (rpcUrl) {
      const allowlist = data.SOROBAN_RPC_URL_ALLOWLIST.split(",")
        .map((u) => u.trim())
        .filter(Boolean);
      if (!allowlist.includes(rpcUrl)) {
        issues.push({
          path: "SOROBAN_RPC_URL",
          message:
            "Configured RPC URL is not in SOROBAN_RPC_URL_ALLOWLIST — " +
            "add it to the allowlist or correct the URL",
        });
      }
    }
  }

  return issues;
}

/**
 * Parses and validates all backend environment variables.
 *
 * - URL fields are format-checked whenever present.
 * - SESSION_SECRET minimum length (32 chars) is always enforced when set.
 * - Production-only requirements (SESSION_SECRET, SOROBAN_RPC_URL_ALLOWLIST,
 *   and RPC allowlist membership) are enforced when NODE_ENV or VERCEL_ENV
 *   equals "production".
 * - Sensitive values are never included in error messages.
 *
 * @param source - Map of env vars to validate (defaults to process.env)
 * @throws {EnvValidationError} when any validation rule fails
 */
export function validateEnv(
  source: Record<string, string | undefined> = process.env,
): ValidatedEnv {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    throw new EnvValidationError(formatZodIssues(result.error));
  }

  const productionIssues = checkProductionRequirements(result.data);
  if (productionIssues.length > 0) {
    throw new EnvValidationError(productionIssues);
  }

  return result.data;
}

let _cachedEnv: ValidatedEnv | null = null;

/**
 * Returns the validated env object, caching it after the first successful
 * call. Pass a custom source only in tests (and call _resetEnvCache() in
 * beforeEach so tests are isolated).
 */
export function getValidatedEnv(
  source: Record<string, string | undefined> = process.env,
): ValidatedEnv {
  if (_cachedEnv) return _cachedEnv;
  _cachedEnv = validateEnv(source);
  return _cachedEnv;
}

/** Clears the module-level env cache. For tests only. */
export function _resetEnvCache(): void {
  _cachedEnv = null;
}

// Fail fast in production: validate at module load time so a misconfigured
// deployment crashes immediately rather than at the first inbound request.
/* c8 ignore next 5 */
if (
  process.env.NODE_ENV === "production" ||
  process.env.VERCEL_ENV === "production"
) {
  getValidatedEnv();
}
