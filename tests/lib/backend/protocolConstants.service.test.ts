import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getProtocolConstants,
  invalidateProtocolConstantsCache,
} from "@/lib/backend/services/protocolConstants";

const DEFAULT_CONSTANTS = {
  protocolVersion: "v1",
  network: "Test SDF Network ; September 2015",
  fees: {
    networkBaseFeeStroops: 100,
    platformFeePercent: 0,
  },
  commitmentLimits: {
    minAmountXlm: 10,
    maxAmountXlm: 1_000_000,
    minDurationDays: 1,
    maxDurationDays: 365,
    maxLossPercentCeiling: 100,
  },
};

let envSnapshot: NodeJS.ProcessEnv;

function restoreEnv(snapshot: NodeJS.ProcessEnv): void {
  for (const key of Object.keys(process.env)) {
    if (!(key in snapshot)) {
      delete process.env[key];
    }
  }

  Object.assign(process.env, snapshot);
}

beforeEach(() => {
  envSnapshot = { ...process.env };
  invalidateProtocolConstantsCache();
});

afterEach(() => {
  invalidateProtocolConstantsCache();
  vi.unstubAllEnvs();
  restoreEnv(envSnapshot);
});

describe("protocolConstants service", () => {
  it("returns defaults when env vars are unset", () => {
    const constants = getProtocolConstants();

    expect(constants.protocolVersion).toBe(DEFAULT_CONSTANTS.protocolVersion);
    expect(constants.network).toBe(DEFAULT_CONSTANTS.network);
    expect(constants.fees).toEqual(DEFAULT_CONSTANTS.fees);
    expect(constants.commitmentLimits).toEqual(
      DEFAULT_CONSTANTS.commitmentLimits,
    );
    expect(constants.penalties).toEqual([
      {
        type: "safe",
        earlyExitPenaltyPercent: 2,
        description: "Low-risk commitment with a 2% early-exit penalty.",
      },
      {
        type: "balanced",
        earlyExitPenaltyPercent: 3,
        description: "Moderate-risk commitment with a 3% early-exit penalty.",
      },
      {
        type: "aggressive",
        earlyExitPenaltyPercent: 5,
        description: "High-risk commitment with a 5% early-exit penalty.",
      },
    ]);
    expect(constants.cachedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });

  it("applies env overrides for version, network, fees, limits, and penalty tiers", () => {
    vi.stubEnv("NEXT_PUBLIC_ACTIVE_CONTRACT_VERSION", "v2");
    vi.stubEnv("SOROBAN_NETWORK_PASSPHRASE", "Custom Test Network");
    vi.stubEnv("COMMITLABS_NETWORK_BASE_FEE_STROOPS", "250");
    vi.stubEnv("COMMITLABS_PLATFORM_FEE_PERCENT", "1.75");
    vi.stubEnv("COMMITLABS_MIN_AMOUNT_XLM", "42");
    vi.stubEnv("COMMITLABS_MAX_AMOUNT_XLM", "500000");
    vi.stubEnv("COMMITLABS_MIN_DURATION_DAYS", "7");
    vi.stubEnv("COMMITLABS_MAX_DURATION_DAYS", "180");
    vi.stubEnv("COMMITLABS_MAX_LOSS_PERCENT_CEILING", "80");
    vi.stubEnv(
      "COMMITLABS_PENALTY_TIERS_JSON",
      JSON.stringify([
        {
          type: "conservative",
          earlyExitPenaltyPercent: 1,
          description: "Conservative tier",
        },
        {
          type: "growth",
          earlyExitPenaltyPercent: 4,
        },
      ]),
    );

    const constants = getProtocolConstants();

    expect(constants.protocolVersion).toBe("v2");
    expect(constants.network).toBe("Custom Test Network");
    expect(constants.fees).toEqual({
      networkBaseFeeStroops: 250,
      platformFeePercent: 1.75,
    });
    expect(constants.commitmentLimits).toEqual({
      minAmountXlm: 42,
      maxAmountXlm: 500000,
      minDurationDays: 7,
      maxDurationDays: 180,
      maxLossPercentCeiling: 80,
    });
    expect(constants.penalties).toEqual([
      {
        type: "conservative",
        earlyExitPenaltyPercent: 1,
        description: "Conservative tier",
      },
      {
        type: "growth",
        earlyExitPenaltyPercent: 4,
        description: "growth commitment with a 4% early-exit penalty.",
      },
    ]);
  });

  it("returns the cached object until invalidated even if env changes", () => {
    vi.stubEnv("NEXT_PUBLIC_ACTIVE_CONTRACT_VERSION", "v1");

    const first = getProtocolConstants();

    vi.stubEnv("NEXT_PUBLIC_ACTIVE_CONTRACT_VERSION", "v9");

    const second = getProtocolConstants();

    expect(second).toBe(first);
    expect(second.protocolVersion).toBe("v1");
  });

  it("re-reads env after invalidateProtocolConstantsCache()", () => {
    vi.stubEnv("COMMITLABS_MIN_AMOUNT_XLM", "15");

    const first = getProtocolConstants();
    expect(first.commitmentLimits.minAmountXlm).toBe(15);

    vi.stubEnv("COMMITLABS_MIN_AMOUNT_XLM", "99");
    invalidateProtocolConstantsCache();

    const second = getProtocolConstants();

    expect(second).not.toBe(first);
    expect(second.commitmentLimits.minAmountXlm).toBe(99);
  });

  it("falls back to defaults for malformed numeric env values", () => {
    vi.stubEnv("COMMITLABS_NETWORK_BASE_FEE_STROOPS", "not-a-number");
    vi.stubEnv("COMMITLABS_PLATFORM_FEE_PERCENT", "broken");
    vi.stubEnv("COMMITLABS_MIN_AMOUNT_XLM", "NaN");
    vi.stubEnv("COMMITLABS_MAX_AMOUNT_XLM", "oops");
    vi.stubEnv("COMMITLABS_MIN_DURATION_DAYS", "bad");
    vi.stubEnv("COMMITLABS_MAX_DURATION_DAYS", "bad");
    vi.stubEnv("COMMITLABS_MAX_LOSS_PERCENT_CEILING", "bad");

    const constants = getProtocolConstants();

    expect(constants.fees.networkBaseFeeStroops).toBe(100);
    expect(constants.fees.platformFeePercent).toBe(0);
    expect(constants.commitmentLimits).toEqual(
      DEFAULT_CONSTANTS.commitmentLimits,
    );
  });

  it("throws for malformed penalty tier JSON", () => {
    vi.stubEnv("COMMITLABS_PENALTY_TIERS_JSON", "{not-json");

    expect(() => getProtocolConstants()).toThrow(
      /Failed to parse COMMITLABS_PENALTY_TIERS_JSON/,
    );
  });

  it("throws when penalty tiers are not an array", () => {
    vi.stubEnv("COMMITLABS_PENALTY_TIERS_JSON", JSON.stringify({ foo: "bar" }));

    expect(() => getProtocolConstants()).toThrow(/must be a JSON array/);
  });

  it("throws when a penalty tier is missing required fields", () => {
    vi.stubEnv(
      "COMMITLABS_PENALTY_TIERS_JSON",
      JSON.stringify([{ type: "safe" }]),
    );

    expect(() => getProtocolConstants()).toThrow(
      /missing a numeric "earlyExitPenaltyPercent"/,
    );
  });
});
