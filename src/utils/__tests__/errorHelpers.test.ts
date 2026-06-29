import { describe, it, expect, afterEach } from "vitest";
import {
  rateLimitError,
  internalServerError,
  badGatewayError,
  serviceUnavailableError,
  gatewayTimeoutError,
  resolveServerError,
  getErrorHeaders,
} from "@/utils/errorHelpers";

const originalEnv = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = originalEnv;
});

// ── rateLimitError ────────────────────────────────────────────────────────────

describe("rateLimitError", () => {
  it("returns code 429 and correct type and message", () => {
    const result = rateLimitError();
    expect(result.success).toBe(false);
    expect(result.error.code).toBe(429);
    expect(result.error.type).toBe("RATE_LIMIT_EXCEEDED");
    expect(result.error.message).toBe(
      "Too many requests. Please wait before trying again."
    );
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
    expect(result.error.message).toBe(
      "An unexpected error occurred. Please try again later."
    );
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
    expect(result.error.message).toBe(
      "A upstream service returned an invalid response. Please try again later."
    );
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
    expect(result.error.message).toBe(
      "The service is temporarily unavailable. Please try again later."
    );
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
    expect(result.error.message).toBe(
      "The request timed out. Please try again."
    );
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