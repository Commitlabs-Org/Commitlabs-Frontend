/**
 * Centralized registry of backend error codes.
 *
 * This registry serves as the single source of truth for all error codes used
 * across the backend API. Each error code is documented with:
 * - HTTP status code
 * - Semantic meaning
 * - Recommended client handling strategy
 * - Retriable status and retry guidance
 *
 * @see docs/backend-error-codes.md for detailed documentation
 */

export interface ErrorCodeDefinition {
  /** Error code identifier used in API responses. */
  code: string;
  /** HTTP status code. */
  statusCode: number;
  /** Human-readable meaning of the error. */
  meaning: string;
  /** Recommended client handling strategy. */
  clientHandling: string;
  /** Whether the error is retriable with exponential backoff. */
  retriable: boolean;
  /** Description of what triggers this error. */
  description: string;
}

/**
 * Complete registry of backend error codes.
 * Organized by HTTP status code for easy lookup.
 */
export const ERROR_CODE_REGISTRY: Record<string, ErrorCodeDefinition> = {
  // ─── 400 Bad Request ──────────────────────────────────────────────────────
  BAD_REQUEST: {
    code: "BAD_REQUEST",
    statusCode: 400,
    meaning: "The request was malformed or contains invalid syntax.",
    clientHandling:
      "Display a generic error message to the user. Check request headers, content-type, and method. Do not retry.",
    retriable: false,
    description:
      "Triggered when the HTTP request is malformed, has invalid headers, or violates the API protocol.",
  },

  // ─── 400 Validation Error ─────────────────────────────────────────────────
  VALIDATION_ERROR: {
    code: "VALIDATION_ERROR",
    statusCode: 400,
    meaning: "Request body or query parameters failed validation.",
    clientHandling:
      "Display specific validation error details to the user (from error.details). Highlight invalid fields in forms. Do not retry.",
    retriable: false,
    description:
      "Triggered when request data fails schema validation, type checking, or business rule validation.",
  },

  // ─── 401 Unauthorized ─────────────────────────────────────────────────────
  UNAUTHORIZED: {
    code: "UNAUTHORIZED",
    statusCode: 401,
    meaning: "Authentication credentials are missing, invalid, or expired.",
    clientHandling:
      "Redirect user to login page. Attempt token refresh if refresh token is available. Clear stored credentials.",
    retriable: true,
    description:
      "Triggered when the request lacks valid authentication (missing token, invalid signature, or expired session).",
  },

  // ─── 403 Forbidden ────────────────────────────────────────────────────────
  FORBIDDEN: {
    code: "FORBIDDEN",
    statusCode: 403,
    meaning: "Authenticated but lacks permission to perform the action.",
    clientHandling:
      "Display permission denied message. Do not retry. Log the attempt for audit purposes. Suggest alternatives if available.",
    retriable: false,
    description:
      "Triggered when the authenticated user does not have the required role, scope, or permission for the requested action.",
  },

  // ─── 404 Not Found ────────────────────────────────────────────────────────
  NOT_FOUND: {
    code: "NOT_FOUND",
    statusCode: 404,
    meaning: "The requested resource does not exist.",
    clientHandling:
      'Display "not found" message. Offer user navigation options or search functionality. Do not retry.',
    retriable: false,
    description:
      "Triggered when a resource lookup returns no result (e.g., commitment ID, user, marketplace item not found).",
  },

  // ─── 409 Conflict ─────────────────────────────────────────────────────────
  CONFLICT: {
    code: "CONFLICT",
    statusCode: 409,
    meaning: "Request conflicts with current resource state.",
    clientHandling:
      "Display conflict message with details. Prompt user to refresh data and retry, or take alternative action. Fetch latest state before retrying.",
    retriable: true,
    description:
      "Triggered when an action violates state constraints (e.g., resource already exists, already settled, or locked by another user).",
  },

  // ─── 422 Unprocessable Entity ─────────────────────────────────────────────
  UNPROCESSABLE_ENTITY: {
    code: "UNPROCESSABLE_ENTITY",
    statusCode: 422,
    meaning: "Request is syntactically valid but semantically unprocessable.",
    clientHandling:
      "Display semantic error details to user. Check business logic constraints (e.g., invalid amount ranges, allocation rules). Do not retry with same data.",
    retriable: false,
    description:
      "Triggered when request passes basic validation but violates complex business rules or constraints.",
  },

  // ─── 429 Too Many Requests ───────────────────────────────────────────────
  TOO_MANY_REQUESTS: {
    code: "TOO_MANY_REQUESTS",
    statusCode: 429,
    meaning: "Client has exceeded the rate limit.",
    clientHandling:
      "Implement exponential backoff with jitter. Respect Retry-After header. Display rate limit warning to user. Defer non-critical requests.",
    retriable: true,
    description:
      "Triggered when a client exceeds configured rate limits (per user, IP, or endpoint). Response includes Retry-After header.",
  },

  // ─── 500 Internal Server Error ────────────────────────────────────────────
  INTERNAL_ERROR: {
    code: "INTERNAL_ERROR",
    statusCode: 500,
    meaning: "Unexpected server-side failure.",
    clientHandling:
      "Display generic error message. Implement exponential backoff. Log error for debugging. Offer user to retry or contact support.",
    retriable: true,
    description:
      "Triggered when the server encounters an unhandled exception or unexpected failure during request processing.",
  },

  // ─── 502 Bad Gateway ──────────────────────────────────────────────────────
  BAD_GATEWAY: {
    code: "BAD_GATEWAY",
    statusCode: 502,
    meaning: "Invalid response from upstream server or service.",
    clientHandling:
      "Display service unavailable message. Implement exponential backoff. Retry the request after a delay.",
    retriable: true,
    description:
      "Triggered when the API server receives an invalid response from an upstream service (e.g., blockchain node, database).",
  },

  // ─── 503 Service Unavailable ──────────────────────────────────────────────
  SERVICE_UNAVAILABLE: {
    code: "SERVICE_UNAVAILABLE",
    statusCode: 503,
    meaning:
      "Service is temporarily unavailable (maintenance, overload, or degradation).",
    clientHandling:
      "Display maintenance or temporarily unavailable message. Implement exponential backoff. Respect Retry-After header.",
    retriable: true,
    description:
      "Triggered when the server is under heavy load, undergoing maintenance, or experiencing degraded service.",
  },

  // ─── 504 Gateway Timeout ──────────────────────────────────────────────────
  GATEWAY_TIMEOUT: {
    code: "GATEWAY_TIMEOUT",
    statusCode: 504,
    meaning: "Upstream service or gateway did not respond in time.",
    clientHandling:
      "Display timeout message. Implement exponential backoff. Retry the request with longer timeout or circuit breaker.",
    retriable: true,
    description:
      "Triggered when an upstream service (e.g., blockchain, external API) does not respond within the configured timeout.",
  },

  // ─── Domain-Specific Codes ────────────────────────────────────────────────
  BLOCKCHAIN_UNAVAILABLE: {
    code: "BLOCKCHAIN_UNAVAILABLE",
    statusCode: 503,
    meaning: "Blockchain service is temporarily unavailable.",
    clientHandling:
      "Display message that blockchain is temporarily unreachable. Implement exponential backoff. Retry after a delay.",
    retriable: true,
    description:
      "Triggered when the backend cannot connect to or communicate with the blockchain network or RPC provider.",
  },

  BLOCKCHAIN_CALL_FAILED: {
    code: "BLOCKCHAIN_CALL_FAILED",
    statusCode: 500,
    meaning: "Blockchain operation failed (e.g., revert, invalid transaction).",
    clientHandling:
      "Display detailed error message from blockchain. Offer user to review transaction details or contact support.",
    retriable: false,
    description:
      "Triggered when a blockchain transaction reverts, execution fails, or returns invalid state. Usually not retriable.",
  },
};

/**
 * Type-safe error code selector.
 * Use this instead of string literals to ensure only registered codes are used.
 */
export type RegisteredErrorCode = keyof typeof ERROR_CODE_REGISTRY;

/**
 * Get error code definition by code string.
 * Throws if code is not registered.
 */
export function getErrorCodeDefinition(code: string): ErrorCodeDefinition {
  const definition = ERROR_CODE_REGISTRY[code];
  if (!definition) {
    throw new Error(
      `Unregistered error code: ${code}. All error codes must be defined in ERROR_CODE_REGISTRY.`,
    );
  }
  return definition;
}

/**
 * Get all error codes grouped by HTTP status code.
 */
export function getErrorCodesByStatus(): Record<number, ErrorCodeDefinition[]> {
  const grouped: Record<number, ErrorCodeDefinition[]> = {};
  Object.values(ERROR_CODE_REGISTRY).forEach((definition) => {
    const status = definition.statusCode;
    if (!grouped[status]) {
      grouped[status] = [];
    }
    grouped[status].push(definition);
  });
  return grouped;
}

/**
 * Validate that all error codes in the registry are unique (no duplicates).
 * Call this in tests to enforce registry integrity.
 */
export function validateErrorCodeRegistry(): {
  valid: boolean;
  duplicates: string[];
  errors: string[];
} {
  const codes = Object.keys(ERROR_CODE_REGISTRY);
  const uniqueCodes = new Set(codes);
  const duplicates = codes.filter((code) => {
    const count = codes.filter((c) => c === code).length;
    return count > 1;
  });

  const errors: string[] = [];

  // Check for duplicate codes
  if (duplicates.length > 0) {
    errors.push(
      `Duplicate error codes found: ${[...new Set(duplicates)].join(", ")}`,
    );
  }

  // Check for empty code strings
  codes.forEach((code) => {
    if (!code || code.trim() === "") {
      errors.push(`Empty error code found`);
    }
  });

  // Check for required fields in each definition
  codes.forEach((code) => {
    const def = ERROR_CODE_REGISTRY[code];
    if (!def.code) errors.push(`Missing 'code' field in ${code}`);
    if (!def.meaning) errors.push(`Missing 'meaning' field in ${code}`);
    if (!def.clientHandling)
      errors.push(`Missing 'clientHandling' field in ${code}`);
    if (def.description === undefined || def.description === null) {
      errors.push(`Missing 'description' field in ${code}`);
    }
    if (typeof def.retriable !== "boolean") {
      errors.push(`Invalid 'retriable' field in ${code}`);
    }
    if (
      typeof def.statusCode !== "number" ||
      def.statusCode < 400 ||
      def.statusCode >= 600
    ) {
      errors.push(`Invalid 'statusCode' in ${code}`);
    }
  });

  return {
    valid: errors.length === 0,
    duplicates: [...new Set(duplicates)],
    errors,
  };
}
