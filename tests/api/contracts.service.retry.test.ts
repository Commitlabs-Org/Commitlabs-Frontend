/**
 * Tests for the read-call retry/backoff feature in the contracts service.
 *
 * Written for Vitest. For Jest: replace `vi` with `jest` and the import below
 * with `@jest/globals` — the assertion and mock APIs used here are identical.
 *
 * Targets the three pure pieces of the feature:
 *   - retryWithBackoff         — the bounded exponential-backoff loop
 *   - isRetryableContractError — the transient-vs-deterministic classifier
 *   - assertRetrySafe          — the guard that forbids retrying writes
 *
 * `retryWithBackoff` accepts injectable `sleep` and `random`, so no real
 * timers are used and every test is deterministic.
 */


import { describe, it, expect, vi } from "vitest";



// The contracts service imports cache / counters / config / logger at module
// load. None of that is exercised by these unit tests, so the modules are
// stubbed to keep the test hermetic and free of I/O.
vi.mock("ioredis", () => ({ default: class {} }));
vi.mock("@/lib/backend/cache/factory", () => ({
  cache: {
    get: vi.fn(async () => null),
    set: vi.fn(async () => {}),
    delete: vi.fn(async () => {}),
  },
}));
vi.mock("@/lib/backend/counters/provider", () => ({
  getCountersAdapter: () => ({
    incrementSuccessfulActions: vi.fn(),
    incrementChainFailures: vi.fn(),
  }),
}));
vi.mock("@/lib/backend/config", () => ({
  getBackendConfig: () => ({
    sorobanRpcUrl: "https://example.invalid",
    networkPassphrase: "TEST",
    contractAddresses: { commitmentCore: "", attestationEngine: "" },
  }),
}));
vi.mock("@/lib/backend/logger", () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));
vi.mock("@/lib/backend/cache/index", () => ({
  CacheKey: {
    commitment: (id: string) => `commitment:${id}`,
    userCommitments: (a: string) => `user-commitments:${a}`,
  },
  CacheTTL: { COMMITMENT_DETAIL: 60, USER_COMMITMENTS: 60 },
}));

// NOTE: @/lib/backend/errors is intentionally NOT mocked — the classifier
// relies on `instanceof BackendError`, which requires the real class.
import { BackendError } from "@/lib/backend/errors";
import {
  retryWithBackoff,
  isRetryableContractError,
  assertRetrySafe,
  type RetryOptions,
} from "@/lib/backend/services/contracts";

/** Deterministic defaults: minimum jitter, instant sleep, everything retryable. */
function baseOptions(overrides: Partial<RetryOptions> = {}): RetryOptions {
  return {
    maxAttempts: 3,
    baseDelayMs: 200,
    maxDelayMs: 2_000,
    maxTotalBackoffMs: 10_000,
    backoffMultiplier: 2,
    isRetryable: () => true,
    random: () => 0, // minimum jitter -> delay === ceiling / 2
    sleep: async () => {},
    ...overrides,
  };
}

describe("retryWithBackoff", () => {
  it("returns immediately on success without sleeping", async () => {
    const op = vi.fn().mockResolvedValue("ok");
    const sleep = vi.fn(async () => {});

    const result = await retryWithBackoff(op, baseOptions({ sleep }));

    expect(result).toBe("ok");
    expect(op).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("retries a retryable failure and then succeeds", async () => {
    const op = vi
      .fn()
      .mockRejectedValueOnce(new Error("503 service unavailable"))
      .mockResolvedValue("ok");
    const sleep = vi.fn(async () => {});

    const result = await retryWithBackoff(op, baseOptions({ sleep }));

    expect(result).toBe("ok");
    expect(op).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it("does not retry a non-retryable failure", async () => {
    const err = new Error("deterministic failure");
    const op = vi.fn().mockRejectedValue(err);
    const sleep = vi.fn(async () => {});

    await expect(
      retryWithBackoff(op, baseOptions({ isRetryable: () => false, sleep })),
    ).rejects.toBe(err);
    expect(op).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("stops after maxAttempts and rethrows the final error unchanged", async () => {
    const last = new Error("attempt 3 failed");
    const op = vi
      .fn()
      .mockRejectedValueOnce(new Error("attempt 1"))
      .mockRejectedValueOnce(new Error("attempt 2"))
      .mockRejectedValueOnce(last);
    const sleep = vi.fn(async () => {});

    await expect(
      retryWithBackoff(op, baseOptions({ maxAttempts: 3, sleep })),
    ).rejects.toBe(last);
    expect(op).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("never retries when maxAttempts is 1", async () => {
    const err = new Error("503 retryable but capped");
    const op = vi.fn().mockRejectedValue(err);
    const sleep = vi.fn(async () => {});

    await expect(
      retryWithBackoff(op, baseOptions({ maxAttempts: 1, sleep })),
    ).rejects.toBe(err);
    expect(op).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("stops early when the total backoff budget would be exceeded", async () => {
    const op = vi.fn().mockRejectedValue(new Error("flaky"));
    const sleep = vi.fn(async () => {});

    // base 200, mult 2, random()=>0 -> delays are 100, 200, 400, ...
    // budget 250 allows the first sleep (100, total 100) but not the
    // second (200 -> total 300 > 250), so it stops after attempt 2.
    await expect(
      retryWithBackoff(
        op,
        baseOptions({
          maxAttempts: 10,
          baseDelayMs: 200,
          maxDelayMs: 10_000,
          maxTotalBackoffMs: 250,
          sleep,
        }),
      ),
    ).rejects.toThrow("flaky");
    expect(op).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it("does not retry at all when the backoff budget is zero", async () => {
    const op = vi.fn().mockRejectedValue(new Error("flaky"));
    const sleep = vi.fn(async () => {});

    await expect(
      retryWithBackoff(
        op,
        baseOptions({ maxAttempts: 5, maxTotalBackoffMs: 0, sleep }),
      ),
    ).rejects.toThrow("flaky");
    expect(op).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("applies exponential backoff with the configured multiplier", async () => {
    const op = vi.fn().mockRejectedValue(new Error("flaky"));
    const delays: number[] = [];
    const sleep = vi.fn(async (ms: number) => {
      delays.push(ms);
    });

    await expect(
      retryWithBackoff(
        op,
        baseOptions({
          maxAttempts: 4,
          baseDelayMs: 100,
          maxDelayMs: 10_000,
          backoffMultiplier: 2,
          random: () => 0, // delay === ceiling / 2
          sleep,
        }),
      ),
    ).rejects.toThrow();

    // ceilings 100, 200, 400 -> delays (ceiling / 2): 50, 100, 200
    expect(delays).toEqual([50, 100, 200]);
  });

  it("caps an individual backoff delay at maxDelayMs", async () => {
    const op = vi.fn().mockRejectedValue(new Error("flaky"));
    const delays: number[] = [];
    const sleep = vi.fn(async (ms: number) => {
      delays.push(ms);
    });

    await expect(
      retryWithBackoff(
        op,
        baseOptions({
          maxAttempts: 5,
          baseDelayMs: 1_000,
          maxDelayMs: 1_500, // ceiling clamped here
          maxTotalBackoffMs: 100_000,
          backoffMultiplier: 10,
          random: () => 1, // maximum jitter -> delay === ceiling
          sleep,
        }),
      ),
    ).rejects.toThrow();

    // raw ceilings 1000, 10000, 100000, 1000000 -> clamped to 1000, 1500, 1500, 1500
    expect(delays).toEqual([1_000, 1_500, 1_500, 1_500]);
  });

  it("adds jitter between ceiling/2 and ceiling", async () => {
    const op = vi.fn().mockRejectedValue(new Error("flaky"));
    const delays: number[] = [];
    const sleep = vi.fn(async (ms: number) => {
      delays.push(ms);
    });

    await expect(
      retryWithBackoff(
        op,
        baseOptions({
          maxAttempts: 2,
          baseDelayMs: 400,
          backoffMultiplier: 2,
          random: () => 0.5, // mid jitter -> delay = 200 + 0.5 * 200
          sleep,
        }),
      ),
    ).rejects.toThrow();

    expect(delays).toEqual([300]);
  });

  it("re-evaluates retryability on every attempt", async () => {
    // First failure is retryable, second is not -> stop on the second.
    const op = vi
      .fn()
      .mockRejectedValueOnce(new Error("RETRYABLE blip"))
      .mockRejectedValueOnce(new Error("permanent failure"));
    const sleep = vi.fn(async () => {});

    await expect(
      retryWithBackoff(
        op,
        baseOptions({
          maxAttempts: 5,
          isRetryable: (e) => String((e as Error).message).includes("RETRYABLE"),
          sleep,
        }),
      ),
    ).rejects.toThrow("permanent failure");
    expect(op).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it("passes the 1-based attempt number to the operation", async () => {
    const seen: number[] = [];
    const op = vi.fn(async (attempt: number) => {
      seen.push(attempt);
      throw new Error("flaky");
    });

    await expect(
      retryWithBackoff(op, baseOptions({ maxAttempts: 3 })),
    ).rejects.toThrow();
    expect(seen).toEqual([1, 2, 3]);
  });

  it("invokes the onRetry hook before each backoff sleep", async () => {
    const op = vi
      .fn()
      .mockRejectedValueOnce(new Error("first"))
      .mockResolvedValue("ok");
    const onRetry = vi.fn();

    await retryWithBackoff(op, baseOptions({ onRetry, sleep: async () => {} }));

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry.mock.calls[0][0]).toMatchObject({ attempt: 1 });
  });
});

describe("isRetryableContractError", () => {
  it("treats timeouts as retryable", () => {
    expect(isRetryableContractError(new Error("request timed out"))).toBe(true);
    expect(
      isRetryableContractError(new Error("operation deadline exceeded")),
    ).toBe(true);
  });

  it("treats rate-limit / 429 errors as retryable", () => {
    expect(isRetryableContractError(new Error("429 Too Many Requests"))).toBe(
      true,
    );
    expect(isRetryableContractError(new Error("rate limit reached"))).toBe(
      true,
    );
  });

  it("treats a generic gateway failure as retryable for idempotent reads", () => {
    // No specific pattern match -> falls through to the 5xx default.
    expect(isRetryableContractError(new Error("socket hang up"))).toBe(true);
  });

  it("does NOT retry not-found errors", () => {
    expect(isRetryableContractError(new Error("commitment not found"))).toBe(
      false,
    );
  });

  it("does NOT retry validation errors", () => {
    expect(isRetryableContractError(new Error("invalid parameters"))).toBe(
      false,
    );
    expect(isRetryableContractError(new Error("malformed request"))).toBe(
      false,
    );
  });

  it("retries BackendErrors with retryable HTTP statuses", () => {
    for (const status of [429, 503, 504]) {
      const err = new BackendError({
        code: "BLOCKCHAIN_CALL_FAILED",
        message: "transient",
        status,
      });
      expect(isRetryableContractError(err)).toBe(true);
    }
  });

  it("does NOT retry configuration BackendErrors (e.g. missing config, 500)", () => {
    const err = new BackendError({
      code: "BLOCKCHAIN_UNAVAILABLE",
      message: "Missing Soroban contract configuration.",
      status: 500,
    });
    expect(isRetryableContractError(err)).toBe(false);
  });
});

describe("assertRetrySafe (write-retry guard)", () => {
  it("allows read calls on any attempt", () => {
    expect(() => assertRetrySafe("read", 1)).not.toThrow();
    expect(() => assertRetrySafe("read", 2)).not.toThrow();
    expect(() => assertRetrySafe("read", 10)).not.toThrow();
  });

  it("allows a write call on the first (and only) attempt", () => {
    expect(() => assertRetrySafe("write", 1)).not.toThrow();
  });

  it("rejects a write call on any retry attempt", () => {
    expect(() => assertRetrySafe("write", 2)).toThrow(BackendError);
    expect(() => assertRetrySafe("write", 3)).toThrow(BackendError);
  });

  it("rejects write retries with a non-retryable 500 so the loop stops", () => {
    let thrown: unknown;
    try {
      assertRetrySafe("write", 2);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(BackendError);
    expect((thrown as BackendError).status).toBe(500);
    // A 500 BackendError is classified non-retryable, so retryWithBackoff
    // would surface it immediately instead of looping.
    expect(isRetryableContractError(thrown)).toBe(false);
  });

  it("blocks a write accidentally wrapped in retryWithBackoff after one submit", async () => {
    const submissions: number[] = [];
    // Simulates invokeContractMethod for a write: it records each submission,
    // runs the guard, and then 'fails transiently' on the first attempt.
    const writeOp = async (attempt: number) => {
      assertRetrySafe("write", attempt); // guard throws on attempt 2
      submissions.push(attempt);
      throw new Error("503 transient after submit");
    };

    await expect(
      retryWithBackoff(
        writeOp,
        baseOptions({ maxAttempts: 5, isRetryable: isRetryableContractError }),
      ),
    ).rejects.toThrow(/must never be retried/);

    // The transaction is submitted exactly once; the guard blocks attempt 2.
    expect(submissions).toEqual([1]);
  });
});