import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getProtocolConstants,
  invalidateProtocolConstantsCache,
} from "../protocolConstants";

const ENV_KEYS = [
  "ACTIVE_CONTRACT_VERSION",
  "NEXT_PUBLIC_ACTIVE_CONTRACT_VERSION",
  "SOROBAN_NETWORK_PASSPHRASE",
  "NEXT_PUBLIC_NETWORK_PASSPHRASE",
  "COMMITLABS_NETWORK_BASE_FEE_STROOPS",
  "COMMITLABS_PLATFORM_FEE_PERCENT",
  "COMMITLABS_PENALTY_TIERS_JSON",
  "COMMITLABS_MIN_AMOUNT_XLM",
  "COMMITLABS_MAX_AMOUNT_XLM",
  "COMMITLABS_MIN_DURATION_DAYS",
  "COMMITLABS_MAX_DURATION_DAYS",
  "COMMITLABS_MAX_LOSS_PERCENT_CEILING",
] as const;

const ORIGINAL_ENV = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
) as Record<(typeof ENV_KEYS)[number], string | undefined>;

function clearProtocolEnv(): void {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
}

describe("protocolConstants service", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-27T12:00:00.000Z"));
    invalidateProtocolConstantsCache();
    clearProtocolEnv();
  });

  afterEach(() => {
    invalidateProtocolConstantsCache();
    clearProtocolEnv();
    for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    vi.useRealTimers();
  });

  it("derives protocol constants from configured environment inputs", () => {
    process.env.NEXT_PUBLIC_ACTIVE_CONTRACT_VERSION = "v3";
    process.env.SOROBAN_NETWORK_PASSPHRASE = "Public Global Stellar Network ; September 2015";
    process.env.COMMITLABS_NETWORK_BASE_FEE_STROOPS = "250";
    process.env.COMMITLABS_PLATFORM_FEE_PERCENT = "1.25";
    process.env.COMMITLABS_MIN_AMOUNT_XLM = "25";
    process.env.COMMITLABS_MAX_AMOUNT_XLM = "50000";
    process.env.COMMITLABS_MIN_DURATION_DAYS = "7";
    process.env.COMMITLABS_MAX_DURATION_DAYS = "730";
    process.env.COMMITLABS_MAX_LOSS_PERCENT_CEILING = "45";
    process.env.COMMITLABS_PENALTY_TIERS_JSON = JSON.stringify([
      {
        type: "strict",
        earlyExitPenaltyPercent: 8,
        description: "Strict commitment penalty.",
      },
      {
        type: "flex",
        earlyExitPenaltyPercent: 0.5,
      },
    ]);

    const constants = getProtocolConstants();

    expect(constants).toEqual({
      protocolVersion: "v3",
      network: "Public Global Stellar Network ; September 2015",
      fees: {
        networkBaseFeeStroops: 250,
        platformFeePercent: 1.25,
      },
      penalties: [
        {
          type: "strict",
          earlyExitPenaltyPercent: 8,
          description: "Strict commitment penalty.",
        },
        {
          type: "flex",
          earlyExitPenaltyPercent: 0.5,
          description: "flex commitment with a 0.5% early-exit penalty.",
        },
      ],
      commitmentLimits: {
        minAmountXlm: 25,
        maxAmountXlm: 50000,
        minDurationDays: 7,
        maxDurationDays: 730,
        maxLossPercentCeiling: 45,
      },
      cachedAt: "2026-06-27T12:00:00.000Z",
    });
  });

  it("falls back to public/default values when configured inputs are unavailable or unparsable", () => {
    process.env.ACTIVE_CONTRACT_VERSION = "v2-private";
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE = "Test Network From Public Env";
    process.env.COMMITLABS_NETWORK_BASE_FEE_STROOPS = "not-a-number";
    process.env.COMMITLABS_PLATFORM_FEE_PERCENT = "invalid";
    process.env.COMMITLABS_MIN_AMOUNT_XLM = "NaN";
    process.env.COMMITLABS_MAX_AMOUNT_XLM = "not-finite";
    process.env.COMMITLABS_MIN_DURATION_DAYS = "oops";
    process.env.COMMITLABS_MAX_DURATION_DAYS = "";
    process.env.COMMITLABS_MAX_LOSS_PERCENT_CEILING = "undefined";

    const constants = getProtocolConstants();

    expect(constants.protocolVersion).toBe("v2-private");
    expect(constants.network).toBe("Test Network From Public Env");
    expect(constants.fees).toEqual({
      networkBaseFeeStroops: 100,
      platformFeePercent: 0,
    });
    expect(constants.commitmentLimits).toEqual({
      minAmountXlm: 10,
      maxAmountXlm: 1_000_000,
      minDurationDays: 1,
      maxDurationDays: 365,
      maxLossPercentCeiling: 100,
    });
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
  });

  it("returns the same cached object until the cache is invalidated", () => {
    process.env.COMMITLABS_PLATFORM_FEE_PERCENT = "0.5";

    const first = getProtocolConstants();
    process.env.COMMITLABS_PLATFORM_FEE_PERCENT = "3.5";
    vi.setSystemTime(new Date("2026-06-27T13:00:00.000Z"));
    const second = getProtocolConstants();

    expect(second).toBe(first);
    expect(second.fees.platformFeePercent).toBe(0.5);
    expect(second.cachedAt).toBe("2026-06-27T12:00:00.000Z");

    invalidateProtocolConstantsCache();

    const refreshed = getProtocolConstants();
    expect(refreshed).not.toBe(first);
    expect(refreshed.fees.platformFeePercent).toBe(3.5);
    expect(refreshed.cachedAt).toBe("2026-06-27T13:00:00.000Z");
  });

  it("throws a targeted error for malformed penalty tier JSON", () => {
    process.env.COMMITLABS_PENALTY_TIERS_JSON = JSON.stringify([
      {
        type: "balanced",
        earlyExitPenaltyPercent: "three",
      },
    ]);

    expect(() => getProtocolConstants()).toThrow(
      'Failed to parse COMMITLABS_PENALTY_TIERS_JSON: Penalty tier "balanced" is missing a numeric "earlyExitPenaltyPercent".',
    );
  });

  it("throws a targeted error when penalty tiers are not an array", () => {
    process.env.COMMITLABS_PENALTY_TIERS_JSON = JSON.stringify({
      safe: 2,
    });

    expect(() => getProtocolConstants()).toThrow(
      "Failed to parse COMMITLABS_PENALTY_TIERS_JSON: COMMITLABS_PENALTY_TIERS_JSON must be a JSON array",
    );
  });

  it("throws a targeted error when a penalty tier type is missing", () => {
    process.env.COMMITLABS_PENALTY_TIERS_JSON = JSON.stringify([
      {
        earlyExitPenaltyPercent: 2,
      },
    ]);

    expect(() => getProtocolConstants()).toThrow(
      'Failed to parse COMMITLABS_PENALTY_TIERS_JSON: Penalty tier at index 0 is missing a valid "type".',
    );
  });
});
