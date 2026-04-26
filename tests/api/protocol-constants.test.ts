import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GET } from "@/app/api/protocol/constants/route";
import { createMockRequest, parseResponse } from "./helpers";
import {
  getProtocolConstants,
  invalidateProtocolConstantsCache,
} from "@/lib/backend/services/protocolConstants";
import type { ProtocolConstants } from "@/lib/backend/services/protocolConstants";

// Flush the in-memory cache before every test so env-var overrides take effect.
beforeEach(() => {
  invalidateProtocolConstantsCache();
});

afterEach(() => {
  invalidateProtocolConstantsCache();
  vi.unstubAllEnvs();
});

// ─── Response shape ──────────────────────────────────────────────────────────

describe("GET /api/protocol/constants — response shape", () => {
  it("should return HTTP 200 with success envelope", async () => {
    const req = createMockRequest("http://localhost:3000/api/protocol/constants");
    const res = await GET(req, { params: {} });
    const result = await parseResponse(res);

    expect(result.status).toBe(200);
    expect(result.data).toHaveProperty("success", true);
    expect(result.data).toHaveProperty("data");
  });

  it("should include all top-level keys in the constants payload", async () => {
    const req = createMockRequest("http://localhost:3000/api/protocol/constants");
    const res = await GET(req, { params: {} });
    const { data } = await parseResponse(res);
    const constants = data.data;

    expect(constants).toHaveProperty("protocolVersion");
    expect(constants).toHaveProperty("network");
    expect(constants).toHaveProperty("fees");
    expect(constants).toHaveProperty("penalties");
    expect(constants).toHaveProperty("commitmentLimits");
    expect(constants).toHaveProperty("cachedAt");
  });

  it("should return fees with expected fields and types", async () => {
    const req = createMockRequest("http://localhost:3000/api/protocol/constants");
    const res = await GET(req, { params: {} });
    const { data } = await parseResponse(res);
    const { fees } = data.data;

    expect(typeof fees.networkBaseFeeStroops).toBe("number");
    expect(typeof fees.platformFeePercent).toBe("number");
    expect(fees.networkBaseFeeStroops).toBeGreaterThanOrEqual(0);
    expect(fees.platformFeePercent).toBeGreaterThanOrEqual(0);
  });

  it("should return penalties as a non-empty array with correct shape", async () => {
    const req = createMockRequest("http://localhost:3000/api/protocol/constants");
    const res = await GET(req, { params: {} });
    const { data } = await parseResponse(res);
    const { penalties } = data.data;

    expect(Array.isArray(penalties)).toBe(true);
    expect(penalties.length).toBeGreaterThan(0);

    for (const tier of penalties) {
      expect(typeof tier.type).toBe("string");
      expect(typeof tier.earlyExitPenaltyPercent).toBe("number");
      expect(typeof tier.description).toBe("string");
      expect(tier.earlyExitPenaltyPercent).toBeGreaterThanOrEqual(0);
    }
  });

  it("should return commitment limits with correct fields and types", async () => {
    const req = createMockRequest("http://localhost:3000/api/protocol/constants");
    const res = await GET(req, { params: {} });
    const { data } = await parseResponse(res);
    const { commitmentLimits } = data.data;

    expect(typeof commitmentLimits.minAmountXlm).toBe("number");
    expect(typeof commitmentLimits.maxAmountXlm).toBe("number");
    expect(typeof commitmentLimits.minDurationDays).toBe("number");
    expect(typeof commitmentLimits.maxDurationDays).toBe("number");
    expect(typeof commitmentLimits.maxLossPercentCeiling).toBe("number");

    // Sanity: min < max
    expect(commitmentLimits.minAmountXlm).toBeLessThan(commitmentLimits.maxAmountXlm);
    expect(commitmentLimits.minDurationDays).toBeLessThan(commitmentLimits.maxDurationDays);
  });

  it("should return a valid ISO-8601 cachedAt timestamp", async () => {
    const req = createMockRequest("http://localhost:3000/api/protocol/constants");
    const res = await GET(req, { params: {} });
    const { data } = await parseResponse(res);

    const date = new Date(data.data.cachedAt);
    expect(date).toBeInstanceOf(Date);
    expect(date.toString()).not.toBe("Invalid Date");
  });
});

// ─── Default values ──────────────────────────────────────────────────────────

describe("GET /api/protocol/constants — default values", () => {
  it("should use default penalty percentages (2/3/5) when env is unset", async () => {
    const req = createMockRequest("http://localhost:3000/api/protocol/constants");
    const res = await GET(req, { params: {} });
    const { data } = await parseResponse(res);
    const { penalties } = data.data;

    const byType = Object.fromEntries(
      penalties.map((p: { type: string; earlyExitPenaltyPercent: number }) => [p.type, p.earlyExitPenaltyPercent]),
    );

    expect(byType.safe).toBe(2);
    expect(byType.balanced).toBe(3);
    expect(byType.aggressive).toBe(5);
  });

  it("should default protocolVersion to 'v1'", async () => {
    const req = createMockRequest("http://localhost:3000/api/protocol/constants");
    const res = await GET(req, { params: {} });
    const { data } = await parseResponse(res);

    expect(data.data.protocolVersion).toBe("v1");
  });

  it("should default network base fee to 100 stroops", async () => {
    const req = createMockRequest("http://localhost:3000/api/protocol/constants");
    const res = await GET(req, { params: {} });
    const { data } = await parseResponse(res);

    expect(data.data.fees.networkBaseFeeStroops).toBe(100);
  });

  it("should default platform fee to 0%", async () => {
    const req = createMockRequest("http://localhost:3000/api/protocol/constants");
    const res = await GET(req, { params: {} });
    const { data } = await parseResponse(res);

    expect(data.data.fees.platformFeePercent).toBe(0);
  });
});

// ─── Environment variable overrides ──────────────────────────────────────────

describe("GET /api/protocol/constants — env overrides", () => {
  it("should respect COMMITLABS_PLATFORM_FEE_PERCENT override", async () => {
    vi.stubEnv("COMMITLABS_PLATFORM_FEE_PERCENT", "2.5");

    const req = createMockRequest("http://localhost:3000/api/protocol/constants");
    const res = await GET(req, { params: {} });
    const { data } = await parseResponse(res);

    expect(data.data.fees.platformFeePercent).toBe(2.5);
  });

  it("should respect COMMITLABS_MIN_AMOUNT_XLM override", async () => {
    vi.stubEnv("COMMITLABS_MIN_AMOUNT_XLM", "50");

    const req = createMockRequest("http://localhost:3000/api/protocol/constants");
    const res = await GET(req, { params: {} });
    const { data } = await parseResponse(res);

    expect(data.data.commitmentLimits.minAmountXlm).toBe(50);
  });

  it("should respect COMMITLABS_PENALTY_TIERS_JSON override", async () => {
    const customTiers = [
      { type: "conservative", earlyExitPenaltyPercent: 1, description: "Custom tier" },
      { type: "degen", earlyExitPenaltyPercent: 10, description: "Degen tier" },
    ];
    vi.stubEnv("COMMITLABS_PENALTY_TIERS_JSON", JSON.stringify(customTiers));

    const req = createMockRequest("http://localhost:3000/api/protocol/constants");
    const res = await GET(req, { params: {} });
    const { data } = await parseResponse(res);

    expect(data.data.penalties).toHaveLength(2);
    expect(data.data.penalties[0].type).toBe("conservative");
    expect(data.data.penalties[1].earlyExitPenaltyPercent).toBe(10);
  });
});

// ─── Caching ─────────────────────────────────────────────────────────────────

describe("GET /api/protocol/constants — caching", () => {
  it("should set Cache-Control header for browser/CDN caching", async () => {
    const req = createMockRequest("http://localhost:3000/api/protocol/constants");
    const res = await GET(req, { params: {} });

    const cacheControl = res.headers.get("Cache-Control");
    expect(cacheControl).toBeTruthy();
    expect(cacheControl).toContain("public");
    expect(cacheControl).toContain("max-age=300");
    expect(cacheControl).toContain("stale-while-revalidate=60");
  });

  it("should return the same cachedAt on consecutive calls (in-memory cache)", async () => {
    const c1 = getProtocolConstants();
    const c2 = getProtocolConstants();

    expect(c1.cachedAt).toBe(c2.cachedAt);
    expect(c1).toBe(c2); // reference equality — same cached object
  });

  it("should return a fresh cachedAt after cache invalidation", async () => {
    const c1 = getProtocolConstants();
    const firstCachedAt = c1.cachedAt;

    // Wait a tiny bit so the timestamp differs
    await new Promise((r) => setTimeout(r, 5));
    invalidateProtocolConstantsCache();

    const c2 = getProtocolConstants();
    expect(c2.cachedAt).not.toBe(firstCachedAt);
  });
});

// ─── Security headers ────────────────────────────────────────────────────────

describe("GET /api/protocol/constants — security headers", () => {
  it("should include X-Content-Type-Options nosniff header", async () => {
    const req = createMockRequest("http://localhost:3000/api/protocol/constants");
    const res = await GET(req, { params: {} });

    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("should include X-Frame-Options DENY header", async () => {
    const req = createMockRequest("http://localhost:3000/api/protocol/constants");
    const res = await GET(req, { params: {} });

    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("should include Content-Security-Policy header", async () => {
    const req = createMockRequest("http://localhost:3000/api/protocol/constants");
    const res = await GET(req, { params: {} });

    expect(res.headers.get("Content-Security-Policy")).toBeTruthy();
  });
});

// ─── Service unit tests ──────────────────────────────────────────────────────

describe("getProtocolConstants() — direct service tests", () => {
  it("should return a valid ProtocolConstants object", () => {
    const constants: ProtocolConstants = getProtocolConstants();

    expect(constants.protocolVersion).toBeDefined();
    expect(constants.network).toBeDefined();
    expect(constants.fees).toBeDefined();
    expect(constants.penalties).toBeDefined();
    expect(constants.commitmentLimits).toBeDefined();
    expect(constants.cachedAt).toBeDefined();
  });

  it("should contain exactly 3 default penalty tiers", () => {
    const constants = getProtocolConstants();
    expect(constants.penalties).toHaveLength(3);
  });

  it("should throw if COMMITLABS_PENALTY_TIERS_JSON is invalid JSON", () => {
    vi.stubEnv("COMMITLABS_PENALTY_TIERS_JSON", "not-json{");

    expect(() => getProtocolConstants()).toThrow(
      /Failed to parse COMMITLABS_PENALTY_TIERS_JSON/,
    );
  });

  it("should throw if COMMITLABS_PENALTY_TIERS_JSON is not an array", () => {
    vi.stubEnv("COMMITLABS_PENALTY_TIERS_JSON", '{"foo":"bar"}');

    expect(() => getProtocolConstants()).toThrow(
      /must be a JSON array/,
    );
  });

  it("should throw if a penalty tier is missing a type", () => {
    vi.stubEnv(
      "COMMITLABS_PENALTY_TIERS_JSON",
      JSON.stringify([{ earlyExitPenaltyPercent: 5 }]),
    );

    expect(() => getProtocolConstants()).toThrow(/missing a valid "type"/);
  });

  it("should throw if a penalty tier is missing earlyExitPenaltyPercent", () => {
    vi.stubEnv(
      "COMMITLABS_PENALTY_TIERS_JSON",
      JSON.stringify([{ type: "test" }]),
    );

    expect(() => getProtocolConstants()).toThrow(
      /missing a numeric "earlyExitPenaltyPercent"/,
    );
  });

  it("should fall back to defaults for malformed env int values", () => {
    vi.stubEnv("COMMITLABS_MIN_AMOUNT_XLM", "not-a-number");

    const constants = getProtocolConstants();
    expect(constants.commitmentLimits.minAmountXlm).toBe(10); // default
  });

  it("should fall back to defaults for malformed env float values", () => {
    vi.stubEnv("COMMITLABS_PLATFORM_FEE_PERCENT", "abc");

    const constants = getProtocolConstants();
    expect(constants.fees.platformFeePercent).toBe(0); // default
  });
});
