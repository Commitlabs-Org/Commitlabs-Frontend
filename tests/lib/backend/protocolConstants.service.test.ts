import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getProtocolConstants,
  invalidateProtocolConstantsCache,
} from "@/lib/backend/services/protocolConstants";

beforeEach(() => {
  invalidateProtocolConstantsCache();
});

afterEach(() => {
  invalidateProtocolConstantsCache();
  vi.unstubAllEnvs();
});

// ─── Defaults ────────────────────────────────────────────────────────────────

describe("getProtocolConstants() — defaults", () => {
  it("returns protocolVersion v1 when no env var is set", () => {
    expect(getProtocolConstants().protocolVersion).toBe("v1");
  });

  it("returns networkBaseFeeStroops 100 by default", () => {
    expect(getProtocolConstants().fees.networkBaseFeeStroops).toBe(100);
  });

  it("returns platformFeePercent 0 by default", () => {
    expect(getProtocolConstants().fees.platformFeePercent).toBe(0);
  });

  it("returns default commitment limits", () => {
    const { commitmentLimits } = getProtocolConstants();
    expect(commitmentLimits.minAmountXlm).toBe(10);
    expect(commitmentLimits.maxAmountXlm).toBe(1_000_000);
    expect(commitmentLimits.minDurationDays).toBe(1);
    expect(commitmentLimits.maxDurationDays).toBe(365);
    expect(commitmentLimits.maxLossPercentCeiling).toBe(100);
    expect(commitmentLimits.earlyExitGracePeriodDays).toBe(7);
  });

  it("returns the 3 default penalty tiers with correct percents", () => {
    const { penalties } = getProtocolConstants();
    expect(penalties).toHaveLength(3);
    const byType = Object.fromEntries(penalties.map((p) => [p.type, p.earlyExitPenaltyPercent]));
    expect(byType.safe).toBe(2);
    expect(byType.balanced).toBe(3);
    expect(byType.aggressive).toBe(5);
  });

  it("returns a valid ISO-8601 cachedAt", () => {
    const { cachedAt } = getProtocolConstants();
    expect(new Date(cachedAt).toString()).not.toBe("Invalid Date");
  });
});

// ─── Env overrides ───────────────────────────────────────────────────────────

describe("getProtocolConstants() — env overrides", () => {
  it("respects COMMITLABS_NETWORK_BASE_FEE_STROOPS", () => {
    vi.stubEnv("COMMITLABS_NETWORK_BASE_FEE_STROOPS", "200");
    expect(getProtocolConstants().fees.networkBaseFeeStroops).toBe(200);
  });

  it("respects COMMITLABS_PLATFORM_FEE_PERCENT (float)", () => {
    vi.stubEnv("COMMITLABS_PLATFORM_FEE_PERCENT", "1.5");
    expect(getProtocolConstants().fees.platformFeePercent).toBe(1.5);
  });

  it("respects COMMITLABS_MIN_AMOUNT_XLM", () => {
    vi.stubEnv("COMMITLABS_MIN_AMOUNT_XLM", "50");
    expect(getProtocolConstants().commitmentLimits.minAmountXlm).toBe(50);
  });

  it("respects COMMITLABS_MAX_AMOUNT_XLM", () => {
    vi.stubEnv("COMMITLABS_MAX_AMOUNT_XLM", "500000");
    expect(getProtocolConstants().commitmentLimits.maxAmountXlm).toBe(500000);
  });

  it("respects COMMITLABS_MIN_DURATION_DAYS", () => {
    vi.stubEnv("COMMITLABS_MIN_DURATION_DAYS", "7");
    expect(getProtocolConstants().commitmentLimits.minDurationDays).toBe(7);
  });

  it("respects COMMITLABS_MAX_DURATION_DAYS", () => {
    vi.stubEnv("COMMITLABS_MAX_DURATION_DAYS", "730");
    expect(getProtocolConstants().commitmentLimits.maxDurationDays).toBe(730);
  });

  it("respects COMMITLABS_MAX_LOSS_PERCENT_CEILING", () => {
    vi.stubEnv("COMMITLABS_MAX_LOSS_PERCENT_CEILING", "50");
    expect(getProtocolConstants().commitmentLimits.maxLossPercentCeiling).toBe(50);
  });

  it("respects COMMITLABS_EARLY_EXIT_GRACE_PERIOD_DAYS", () => {
    vi.stubEnv("COMMITLABS_EARLY_EXIT_GRACE_PERIOD_DAYS", "5");
    expect(getProtocolConstants().commitmentLimits.earlyExitGracePeriodDays).toBe(5);
  });

  it("respects NEXT_PUBLIC_ACTIVE_CONTRACT_VERSION for protocolVersion", () => {
    vi.stubEnv("NEXT_PUBLIC_ACTIVE_CONTRACT_VERSION", "v2");
    expect(getProtocolConstants().protocolVersion).toBe("v2");
  });

  it("respects ACTIVE_CONTRACT_VERSION as fallback for protocolVersion", () => {
    vi.stubEnv("ACTIVE_CONTRACT_VERSION", "v3");
    expect(getProtocolConstants().protocolVersion).toBe("v3");
  });

  it("NEXT_PUBLIC_ACTIVE_CONTRACT_VERSION takes precedence over ACTIVE_CONTRACT_VERSION", () => {
    vi.stubEnv("NEXT_PUBLIC_ACTIVE_CONTRACT_VERSION", "v2");
    vi.stubEnv("ACTIVE_CONTRACT_VERSION", "v3");
    expect(getProtocolConstants().protocolVersion).toBe("v2");
  });

  it("respects SOROBAN_NETWORK_PASSPHRASE for network", () => {
    vi.stubEnv("SOROBAN_NETWORK_PASSPHRASE", "Public Global Stellar Network ; September 2015");
    expect(getProtocolConstants().network).toBe("Public Global Stellar Network ; September 2015");
  });

  it("respects valid COMMITLABS_PENALTY_TIERS_JSON", () => {
    const tiers = [
      { type: "low", earlyExitPenaltyPercent: 1, description: "Low tier" },
      { type: "high", earlyExitPenaltyPercent: 8, description: "High tier" },
    ];
    vi.stubEnv("COMMITLABS_PENALTY_TIERS_JSON", JSON.stringify(tiers));
    const { penalties } = getProtocolConstants();
    expect(penalties).toHaveLength(2);
    expect(penalties[0].type).toBe("low");
    expect(penalties[1].earlyExitPenaltyPercent).toBe(8);
  });

  it("fills description when omitted in COMMITLABS_PENALTY_TIERS_JSON", () => {
    vi.stubEnv(
      "COMMITLABS_PENALTY_TIERS_JSON",
      JSON.stringify([{ type: "custom", earlyExitPenaltyPercent: 4 }]),
    );
    const { penalties } = getProtocolConstants();
    expect(typeof penalties[0].description).toBe("string");
    expect(penalties[0].description).toBeTruthy();
  });
});

// ─── Invalid env values fall back to defaults ─────────────────────────────────

describe("getProtocolConstants() — invalid env values", () => {
  it("falls back to default networkBaseFeeStroops when env is non-numeric", () => {
    vi.stubEnv("COMMITLABS_NETWORK_BASE_FEE_STROOPS", "NaN");
    expect(getProtocolConstants().fees.networkBaseFeeStroops).toBe(100);
  });

  it("falls back to default platformFeePercent when env is non-numeric", () => {
    vi.stubEnv("COMMITLABS_PLATFORM_FEE_PERCENT", "abc");
    expect(getProtocolConstants().fees.platformFeePercent).toBe(0);
  });

  it("falls back to default minAmountXlm when env is non-numeric", () => {
    vi.stubEnv("COMMITLABS_MIN_AMOUNT_XLM", "not-a-number");
    expect(getProtocolConstants().commitmentLimits.minAmountXlm).toBe(10);
  });

  it("falls back to default maxAmountXlm when env is empty string", () => {
    vi.stubEnv("COMMITLABS_MAX_AMOUNT_XLM", "");
    // parseInt("") is NaN → falls back to default
    expect(getProtocolConstants().commitmentLimits.maxAmountXlm).toBe(1_000_000);
  });

  it("falls back to default early exit grace period when env is non-numeric", () => {
    vi.stubEnv("COMMITLABS_EARLY_EXIT_GRACE_PERIOD_DAYS", "soon");
    expect(getProtocolConstants().commitmentLimits.earlyExitGracePeriodDays).toBe(7);
  });

  it("throws on malformed COMMITLABS_PENALTY_TIERS_JSON (bad JSON)", () => {
    vi.stubEnv("COMMITLABS_PENALTY_TIERS_JSON", "{bad json");
    expect(() => getProtocolConstants()).toThrow(/Failed to parse COMMITLABS_PENALTY_TIERS_JSON/);
  });

  it("throws when COMMITLABS_PENALTY_TIERS_JSON is not an array", () => {
    vi.stubEnv("COMMITLABS_PENALTY_TIERS_JSON", '{"foo":1}');
    expect(() => getProtocolConstants()).toThrow(/must be a JSON array/);
  });

  it("throws when a penalty tier is missing type", () => {
    vi.stubEnv("COMMITLABS_PENALTY_TIERS_JSON", JSON.stringify([{ earlyExitPenaltyPercent: 5 }]));
    expect(() => getProtocolConstants()).toThrow(/missing a valid "type"/);
  });

  it("throws when a penalty tier has an empty type string", () => {
    vi.stubEnv("COMMITLABS_PENALTY_TIERS_JSON", JSON.stringify([{ type: "", earlyExitPenaltyPercent: 5 }]));
    expect(() => getProtocolConstants()).toThrow(/missing a valid "type"/);
  });

  it("throws when a penalty tier is missing earlyExitPenaltyPercent", () => {
    vi.stubEnv("COMMITLABS_PENALTY_TIERS_JSON", JSON.stringify([{ type: "test" }]));
    expect(() => getProtocolConstants()).toThrow(/missing a numeric "earlyExitPenaltyPercent"/);
  });
});

// ─── In-memory cache ─────────────────────────────────────────────────────────

describe("getProtocolConstants() — caching", () => {
  it("returns the same object reference on consecutive calls", () => {
    const c1 = getProtocolConstants();
    const c2 = getProtocolConstants();
    expect(c1).toBe(c2);
  });

  it("ignores env changes after the first call (cache hit)", () => {
    const firstFee = getProtocolConstants().fees.networkBaseFeeStroops; // 100
    vi.stubEnv("COMMITLABS_NETWORK_BASE_FEE_STROOPS", "999");
    expect(getProtocolConstants().fees.networkBaseFeeStroops).toBe(firstFee);
  });

  it("re-reads env after invalidateProtocolConstantsCache()", () => {
    getProtocolConstants(); // prime cache
    vi.stubEnv("COMMITLABS_NETWORK_BASE_FEE_STROOPS", "999");
    invalidateProtocolConstantsCache();
    expect(getProtocolConstants().fees.networkBaseFeeStroops).toBe(999);
  });

  it("produces a new cachedAt timestamp after invalidation", async () => {
    const first = getProtocolConstants().cachedAt;
    await new Promise((r) => setTimeout(r, 5));
    invalidateProtocolConstantsCache();
    expect(getProtocolConstants().cachedAt).not.toBe(first);
  });

  it("returns a fresh object (not reference-equal) after invalidation", () => {
    const c1 = getProtocolConstants();
    invalidateProtocolConstantsCache();
    const c2 = getProtocolConstants();
    expect(c1).not.toBe(c2);
  });
});
