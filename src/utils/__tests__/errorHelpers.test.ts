import { describe, it, expect, afterEach } from "vitest";
import {
  rateLimitError,
  internalServerError,
  badGatewayError,
  serviceUnavailableError,
  gatewayTimeoutError,
  resolveServerError,
  getErrorHeaders,
  normalizeApiError,
} from "@/utils/errorHelpers";
import { ERROR_CODE_REGISTRY } from "@/lib/backend/errorCodes";

const originalEnv = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = originalEnv;
});

// ── ERROR_CODE_REGISTRY Consistency ──────────────────────────────────────────

describe("ERROR_CODE_REGISTRY consistency", () => {
  it("sources default message and status code for rateLimitError from ERROR_CODE_REGISTRY.TOO_MANY_REQUESTS", () => {
    const result = rateLimitError();
    expect(result.error.code).toBe(ERROR_CODE_REGISTRY.TOO_MANY_REQUESTS.statusCode);
    expect(result.error.message).toBe(ERROR_CODE_REGISTRY.TOO_MANY_REQUESTS.meaning);
  });

  it("sources default message and status code for internalServerError from ERROR_CODE_REGISTRY.INTERNAL_ERROR", () => {
    const result = internalServerError();
    expect(result.error.code).toBe(ERROR_CODE_REGISTRY.INTERNAL_ERROR.statusCode);
    expect(result.error.message).toBe(ERROR_CODE_REGISTRY.INTERNAL_ERROR.meaning);
  });

  it("sources default message and status code for badGatewayError from ERROR_CODE_REGISTRY.BAD_GATEWAY", () => {
    const result = badGatewayError();
    expect(result.error.code).toBe(ERROR_CODE_REGISTRY.BAD_GATEWAY.statusCode);
    expect(result.error.message).toBe(ERROR_CODE_REGISTRY.BAD_GATEWAY.meaning);
  });

  it("sources default message and status code for serviceUnavailableError from ERROR_CODE_REGISTRY.SERVICE_UNAVAILABLE", () => {
    const result = serviceUnavailableError();
    expect(result.error.code).toBe(ERROR_CODE_REGISTRY.SERVICE_UNAVAILABLE.statusCode);
    expect(result.error.message).toBe(ERROR_CODE_REGISTRY.SERVICE_UNAVAILABLE.meaning);
  });

  it("sources default message and status code for gatewayTimeoutError from ERROR_CODE_REGISTRY.GATEWAY_TIMEOUT", () => {
    const result = gatewayTimeoutError();
    expect(result.error.code).toBe(ERROR_CODE_REGISTRY.GATEWAY_TIMEOUT.statusCode);
    expect(result.error.message).toBe(ERROR_CODE_REGISTRY.GATEWAY_TIMEOUT.meaning);
  });
});

// ── rateLimitError ────────────────────────────────────────────────────────────

describe("rateLimitError", () => {
  it("returns code 429 and correct type and message", () => {
    const result = rateLimitError();
    expect(result.success).toBe(false);
    expect(result.error.code).toBe(429);
    expect(result.error.type).toBe("RATE_LIMIT_EXCEEDED");
    expect(result.error.message).toBe(ERROR_CODE_REGISTRY.TOO_MANY_REQUESTS.meaning);
  });

  it("defaults retryAfter to 60", () => {
    const result = rateLimitError();
    expect(result.error.retryAfter).toBe(60);
  });

  it("accepts a custom retryAfter value", () => {
    const result = rateLimitError(120);
    expect(result.error.retryAfter).toBe(120);
  });

  it("includes details in development when provided", () => {
    process.env.NODE_ENV = "development";
    const result = rateLimitError(60, "too many calls");
    expect(result.error.details).toBe("too many calls");
  });

  it("omits details in production even when provided", () => {
    process.env.NODE_ENV = "production";
    const result = rateLimitError(60, "too many calls");
    expect(result.error.details).toBeUndefined();
  });

  it("omits details in development when not provided", () => {
    process.env.NODE_ENV = "development";
    const result = rateLimitError(60);
    expect(result.error.details).toBeUndefined();
  });
});

// ── internalServerError ───────────────────────────────────────────────────────

describe("internalServerError", () => {
  it("returns code 500 and correct type and message", () => {
    const result = internalServerError();
    expect(result.success).toBe(false);
    expect(result.error.code).toBe(500);
    expect(result.error.type).toBe("INTERNAL_SERVER_ERROR");
    expect(result.error.message).toBe(ERROR_CODE_REGISTRY.INTERNAL_ERROR.meaning);
  });

  it("includes details in development when provided", () => {
    process.env.NODE_ENV = "development";
    const result = internalServerError("db connection failed");
    expect(result.error.details).toBe("db connection failed");
  });

  it("omits details in production", () => {
    process.env.NODE_ENV = "production";
    const result = internalServerError("db connection failed");
    expect(result.error.details).toBeUndefined();
  });

  it("omits details when not provided", () => {
    process.env.NODE_ENV = "development";
    const result = internalServerError();
    expect(result.error.details).toBeUndefined();
  });
});

// ── badGatewayError ───────────────────────────────────────────────────────────

describe("badGatewayError", () => {
  it("returns code 502 and correct type and message", () => {
    const result = badGatewayError();
    expect(result.success).toBe(false);
    expect(result.error.code).toBe(502);
    expect(result.error.type).toBe("BAD_GATEWAY");
    expect(result.error.message).toBe(ERROR_CODE_REGISTRY.BAD_GATEWAY.meaning);
  });

  it("includes details in development when provided", () => {
    process.env.NODE_ENV = "development";
    const result = badGatewayError("upstream timeout");
    expect(result.error.details).toBe("upstream timeout");
  });

  it("omits details in production", () => {
    process.env.NODE_ENV = "production";
    const result = badGatewayError("upstream timeout");
    expect(result.error.details).toBeUndefined();
  });
});

// ── serviceUnavailableError ───────────────────────────────────────────────────

describe("serviceUnavailableError", () => {
  it("returns code 503 and correct type and message", () => {
    const result = serviceUnavailableError();
    expect(result.success).toBe(false);
    expect(result.error.code).toBe(503);
    expect(result.error.type).toBe("SERVICE_UNAVAILABLE");
    expect(result.error.message).toBe(ERROR_CODE_REGISTRY.SERVICE_UNAVAILABLE.meaning);
  });

  it("defaults retryAfter to 30", () => {
    const result = serviceUnavailableError();
    expect(result.error.retryAfter).toBe(30);
  });

  it("accepts a custom retryAfter value", () => {
    const result = serviceUnavailableError(90);
    expect(result.error.retryAfter).toBe(90);
  });

  it("includes details in development when provided", () => {
    process.env.NODE_ENV = "development";
    const result = serviceUnavailableError(30, "maintenance window");
    expect(result.error.details).toBe("maintenance window");
  });

  it("omits details in production", () => {
    process.env.NODE_ENV = "production";
    const result = serviceUnavailableError(30, "maintenance window");
    expect(result.error.details).toBeUndefined();
  });
});

// ── gatewayTimeoutError ───────────────────────────────────────────────────────

describe("gatewayTimeoutError", () => {
  it("returns code 504 and correct type and message", () => {
    const result = gatewayTimeoutError();
    expect(result.success).toBe(false);
    expect(result.error.code).toBe(504);
    expect(result.error.type).toBe("GATEWAY_TIMEOUT");
    expect(result.error.message).toBe(ERROR_CODE_REGISTRY.GATEWAY_TIMEOUT.meaning);
  });

  it("includes details in development when provided", () => {
    process.env.NODE_ENV = "development";
    const result = gatewayTimeoutError("read timeout after 30s");
    expect(result.error.details).toBe("read timeout after 30s");
  });

  it("omits details in production", () => {
    process.env.NODE_ENV = "production";
    const result = gatewayTimeoutError("read timeout after 30s");
    expect(result.error.details).toBeUndefined();
  });
});

// ── resolveServerError ────────────────────────────────────────────────────────

describe("resolveServerError", () => {
  it("resolves 502 to badGatewayError", () => {
    const result = resolveServerError(502);
    expect(result.error.code).toBe(502);
    expect(result.error.type).toBe("BAD_GATEWAY");
  });

  it("resolves 503 to serviceUnavailableError with retryAfter 30", () => {
    const result = resolveServerError(503);
    expect(result.error.code).toBe(503);
    expect(result.error.retryAfter).toBe(30);
  });

  it("resolves 504 to gatewayTimeoutError", () => {
    const result = resolveServerError(504);
    expect(result.error.code).toBe(504);
    expect(result.error.type).toBe("GATEWAY_TIMEOUT");
  });

  it("resolves unknown codes to internalServerError", () => {
    const result = resolveServerError(500);
    expect(result.error.code).toBe(500);
    expect(result.error.type).toBe("INTERNAL_SERVER_ERROR");
  });

  it("passes details through to the resolved error in development", () => {
    process.env.NODE_ENV = "development";
    const result = resolveServerError(502, "bad upstream");
    expect(result.error.details).toBe("bad upstream");
  });

  it.each([
    [
      502,
      "BAD_GATEWAY",
      ERROR_CODE_REGISTRY.BAD_GATEWAY.meaning,
    ],
    [
      503,
      "SERVICE_UNAVAILABLE",
      ERROR_CODE_REGISTRY.SERVICE_UNAVAILABLE.meaning,
    ],
    [504, "GATEWAY_TIMEOUT", ERROR_CODE_REGISTRY.GATEWAY_TIMEOUT.meaning],
    [
      599,
      "INTERNAL_SERVER_ERROR",
      ERROR_CODE_REGISTRY.INTERNAL_ERROR.meaning,
    ],
  ])(
    "maps status %i to the expected user-facing %s message",
    (statusCode, errorType, message) => {
      const result = resolveServerError(statusCode);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe(
        statusCode === 599 ? 500 : statusCode
      );
      expect(result.error.type).toBe(errorType);
      expect(result.error.message).toBe(message);
    }
  );

  it.each([502, 503, 504, 599])(
    "does not leak sensitive internals in production for status %i",
    (statusCode) => {
      process.env.NODE_ENV = "production";
      const internalDetails =
        "postgres://admin:secret@db.internal stacktrace token=abc123";
      const result = resolveServerError(statusCode, internalDetails);
      const serializedResponse = JSON.stringify(result);

      expect(result.error.details).toBeUndefined();
      expect(serializedResponse).not.toContain("postgres://");
      expect(serializedResponse).not.toContain("secret");
      expect(serializedResponse).not.toContain("stacktrace");
      expect(serializedResponse).not.toContain("abc123");
    }
  );
});

// ── getErrorHeaders ───────────────────────────────────────────────────────────

describe("getErrorHeaders", () => {
  it("always includes Content-Type application/json", () => {
    const result = getErrorHeaders(internalServerError());
    expect(result["Content-Type"]).toBe("application/json");
  });

  it("includes Retry-After when retryAfter is set", () => {
    const result = getErrorHeaders(rateLimitError(120));
    expect(result["Retry-After"]).toBe("120");
  });

  it("omits Retry-After when retryAfter is not set", () => {
    const result = getErrorHeaders(internalServerError());
    expect(result["Retry-After"]).toBeUndefined();
  });
});

// ── normalizeApiError ────────────────────────────────────────────────────────

describe("normalizeApiError", () => {
  it("maps known backend error codes to friendly UI messages", () => {
    const result = normalizeApiError({ code: "NOT_FOUND", message: "The thing was not found." }, 404);

    expect(result.code).toBe("NOT_FOUND");
    expect(result.message).toBe("The requested resource was not found.");
    expect(result.status).toBe(404);
  });

  it("maps network failures to a friendly message", () => {
    const result = normalizeApiError(new TypeError("Failed to fetch"), 0);

    expect(result.code).toBe("NETWORK_ERROR");
    expect(result.message).toBe("We could not reach the server. Please try again.");
  });
});
