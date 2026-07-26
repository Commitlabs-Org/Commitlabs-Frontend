// Client-side environment variable validation.
// All process.env.NEXT_PUBLIC_* reads for client config flow through getValidatedClientEnv().
// This module validates at startup in development to fail fast on misconfiguration.
// In production it validates eagerly to catch issues before runtime.

import { z } from "zod";

/**
 * URL validation that works with Zod v4
 */
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
 * Schema for all recognised client-side (NEXT_PUBLIC_*) environment variables.
 * These variables are exposed to the browser and must never contain secrets.
 */
const clientEnvSchema = z.object({
  // Soroban RPC endpoint — format-validated when present
  NEXT_PUBLIC_SOROBAN_RPC_URL: urlSchema.optional(),

  // Stellar network passphrase
  NEXT_PUBLIC_NETWORK_PASSPHRASE: z.string().optional(),

  // Soroban contract addresses
  NEXT_PUBLIC_COMMITMENT_NFT_CONTRACT: z.string().optional(),
  NEXT_PUBLIC_COMMITMENT_CORE_CONTRACT: z.string().optional(),
  NEXT_PUBLIC_ATTESTATION_ENGINE_CONTRACT: z.string().optional(),

  // Contract version / JSON overrides
  NEXT_PUBLIC_CONTRACTS_JSON: z.string().optional(),
  NEXT_PUBLIC_ACTIVE_CONTRACT_VERSION: z.string().optional(),

  // Mock-mode flag
  NEXT_PUBLIC_USE_MOCKS: z.string().optional(),

  // Application URLs (for CORS and links)
  NEXT_PUBLIC_APP_URL: urlSchema.optional(),
  NEXT_PUBLIC_SITE_URL: urlSchema.optional(),
});

/** Fully validated, type-safe client environment object */
export type ValidatedClientEnv = z.infer<typeof clientEnvSchema>;

/**
 * Thrown whenever client environment validation fails.
 */
export class ClientEnvValidationError extends Error {
  readonly issues: ReadonlyArray<{ path: string; message: string }>;

  constructor(issues: Array<{ path: string; message: string }>) {
    const lines = issues
      .map(({ path, message }) => `  - ${path}: ${message}`)
      .join("\n");
    super(`Client environment validation failed:\n${lines}`);
    this.name = "ClientEnvValidationError";
    this.issues = issues;
  }
}

function formatZodIssues(
  zodError: z.ZodError,
): Array<{ path: string; message: string }> {
  return zodError.issues.map((issue) => {
    const path = issue.path.join(".") || "(root)";
    return {
      path,
      message: issue.message,
    };
  });
}

/**
 * Parses and validates all client-side environment variables.
 *
 * - URL fields are format-checked whenever present.
 * - All fields are optional to allow gradual migration.
 * - In development, validation happens eagerly to catch issues early.
 * - In production, validation also happens eagerly to prevent runtime failures.
 *
 * @param source - Map of env vars to validate (defaults to process.env)
 * @throws {ClientEnvValidationError} when any validation rule fails
 */
export function validateClientEnv(
  source: Record<string, string | undefined> = process.env,
): ValidatedClientEnv {
  // Filter to only NEXT_PUBLIC_* variables to prevent accidental secret exposure
  const publicVars = Object.fromEntries(
    Object.entries(source).filter(([key]) => key.startsWith("NEXT_PUBLIC_")),
  );

  const result = clientEnvSchema.safeParse(publicVars);

  if (!result.success) {
    throw new ClientEnvValidationError(formatZodIssues(result.error));
  }

  return result.data;
}

let _cachedClientEnv: ValidatedClientEnv | null = null;

/**
 * Returns the validated client env object, caching it after the first successful
 * call. Pass a custom source only in tests (and call _resetClientEnvCache() in
 * beforeEach so tests are isolated).
 */
export function getValidatedClientEnv(
  source: Record<string, string | undefined> = process.env,
): ValidatedClientEnv {
  if (_cachedClientEnv) return _cachedClientEnv;
  _cachedClientEnv = validateClientEnv(source);
  return _cachedClientEnv;
}

/** Clears the module-level client env cache. For tests only. */
export function _resetClientEnvCache(): void {
  _cachedClientEnv = null;
}

// Fail fast in development and production: validate at module load time so a
// misconfigured deployment crashes immediately rather than at runtime.
if (
  process.env.NODE_ENV === "development" ||
  process.env.NODE_ENV === "production" ||
  process.env.VERCEL_ENV === "production"
) {
  getValidatedClientEnv();
}
