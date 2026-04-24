import { describe, it, expect } from "vitest";
import { validateCommitmentDraft } from "@/lib/backend/validation";
import { POST } from "@/app/api/commitments/validate/route";
import { createMockRequest, parseResponse } from "./helpers";

const VALID_ADDRESS = "GB5BLJAK3JTMPFNFN57J6RGPKOHVDOS26QA5VRL22TCBS65VK4BAOXKK";
const VALID_DRAFT = {
  ownerAddress: VALID_ADDRESS,
  asset: "USDC",
  amount: 1000,
  durationDays: 30,
  maxLossBps: 1000,
};

describe("validateCommitmentDraft", () => {
  describe("valid inputs", () => {
    it("should return valid result with no warnings for normal values", () => {
      const result = validateCommitmentDraft(VALID_DRAFT);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.data).toEqual({
        ownerAddress: VALID_ADDRESS,
        asset: "USDC",
        amount: 1000,
        durationDays: 30,
        maxLossBps: 1000,
      });
    });

    it("should accept string values for numeric fields", () => {
      const result = validateCommitmentDraft({
        ownerAddress: VALID_ADDRESS,
        asset: "XLM",
        amount: "500.5",
        durationDays: "90",
        maxLossBps: "2500",
      });
      expect(result.valid).toBe(true);
      expect(result.data?.amount).toBe(500.5);
      expect(result.data?.durationDays).toBe(90);
      expect(result.data?.maxLossBps).toBe(2500);
    });

    it("should accept metadata field (ignored in validation)", () => {
      const result = validateCommitmentDraft({
        ...VALID_DRAFT,
        metadata: { description: "My commitment", tags: ["test"] },
      });
      expect(result.valid).toBe(true);
    });
  });

  describe("validation errors", () => {
    it("should return error for missing ownerAddress", () => {
      const result = validateCommitmentDraft({
        asset: "USDC",
        amount: 1000,
        durationDays: 30,
        maxLossBps: 1000,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: "ownerAddress" })
      );
    });

    it("should return error for missing asset", () => {
      const result = validateCommitmentDraft({
        ownerAddress: VALID_ADDRESS,
        amount: 1000,
        durationDays: 30,
        maxLossBps: 1000,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: "asset" })
      );
    });

    it("should return error for missing amount", () => {
      const result = validateCommitmentDraft({
        ownerAddress: VALID_ADDRESS,
        asset: "USDC",
        durationDays: 30,
        maxLossBps: 1000,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: "amount" })
      );
    });

    it("should return error for negative amount", () => {
      const result = validateCommitmentDraft({
        ...VALID_DRAFT,
        amount: -100,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: "amount" })
      );
    });

    it("should return error for zero amount", () => {
      const result = validateCommitmentDraft({
        ...VALID_DRAFT,
        amount: 0,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: "amount" })
      );
    });

    it("should return error for missing durationDays", () => {
      const result = validateCommitmentDraft({
        ownerAddress: VALID_ADDRESS,
        asset: "USDC",
        amount: 1000,
        maxLossBps: 1000,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: "durationDays" })
      );
    });

    it("should return error for zero durationDays", () => {
      const result = validateCommitmentDraft({
        ...VALID_DRAFT,
        durationDays: 0,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: "durationDays" })
      );
    });

    it("should return error for negative durationDays", () => {
      const result = validateCommitmentDraft({
        ...VALID_DRAFT,
        durationDays: -30,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: "durationDays" })
      );
    });

    it("should return error for missing maxLossBps", () => {
      const result = validateCommitmentDraft({
        ownerAddress: VALID_ADDRESS,
        asset: "USDC",
        amount: 1000,
        durationDays: 30,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: "maxLossBps" })
      );
    });

    it("should return error for invalid Stellar address", () => {
      const result = validateCommitmentDraft({
        ...VALID_DRAFT,
        ownerAddress: "INVALID_ADDRESS",
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: "ownerAddress", message: "Invalid Stellar address format" })
      );
    });

    it("should return error for empty string address", () => {
      const result = validateCommitmentDraft({
        ...VALID_DRAFT,
        ownerAddress: "",
      });
      expect(result.valid).toBe(false);
    });

    it("should return error for non-numeric amount string", () => {
      const result = validateCommitmentDraft({
        ...VALID_DRAFT,
        amount: "abc",
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: "amount" })
      );
    });
  });

  describe("warnings - high risk", () => {
    it("should warn when maxLossBps exceeds 5000 (50%)", () => {
      const result = validateCommitmentDraft({
        ...VALID_DRAFT,
        maxLossBps: 6000,
      });
      expect(result.valid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          code: "HIGH_RISK_LOSS_TOLERANCE",
          field: "maxLossBps",
        })
      );
    });

    it("should warn at exactly 5001 bps threshold", () => {
      const result = validateCommitmentDraft({
        ...VALID_DRAFT,
        maxLossBps: 5001,
      });
      expect(result.warnings).toContainEqual(
        expect.objectContaining({ code: "HIGH_RISK_LOSS_TOLERANCE" })
      );
    });

    it("should not warn at 5000 bps exactly", () => {
      const result = validateCommitmentDraft({
        ...VALID_DRAFT,
        maxLossBps: 5000,
      });
      expect(result.warnings).not.toContainEqual(
        expect.objectContaining({ code: "HIGH_RISK_LOSS_TOLERANCE" })
      );
    });

    it("should not warn for low maxLossBps", () => {
      const result = validateCommitmentDraft({
        ...VALID_DRAFT,
        maxLossBps: 100,
      });
      expect(result.warnings).not.toContainEqual(
        expect.objectContaining({ code: "HIGH_RISK_LOSS_TOLERANCE" })
      );
    });
  });

  describe("warnings - unusual duration", () => {
    it("should warn for duration less than 1 day", () => {
      const result = validateCommitmentDraft({
        ...VALID_DRAFT,
        durationDays: 0,
      });
      expect(result.valid).toBe(false);
    });

    it("should warn for duration exceeding 365 days", () => {
      const result = validateCommitmentDraft({
        ...VALID_DRAFT,
        durationDays: 400,
      });
      expect(result.valid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          code: "UNUSUAL_DURATION",
          field: "durationDays",
        })
      );
    });

    it("should not warn for duration at 365 days", () => {
      const result = validateCommitmentDraft({
        ...VALID_DRAFT,
        durationDays: 365,
      });
      expect(result.warnings).not.toContainEqual(
        expect.objectContaining({ code: "UNUSUAL_DURATION" })
      );
    });

    it("should not warn for normal duration", () => {
      const result = validateCommitmentDraft({
        ...VALID_DRAFT,
        durationDays: 90,
      });
      expect(result.warnings).not.toContainEqual(
        expect.objectContaining({ code: "UNUSUAL_DURATION" })
      );
    });
  });

  describe("warnings - unusual amount", () => {
    it("should warn for amount below 0.001", () => {
      const result = validateCommitmentDraft({
        ...VALID_DRAFT,
        amount: 0.0001,
      });
      expect(result.valid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          code: "UNUSUAL_AMOUNT",
          field: "amount",
        })
      );
    });

    it("should warn for amount above 1000000", () => {
      const result = validateCommitmentDraft({
        ...VALID_DRAFT,
        amount: 2000000,
      });
      expect(result.valid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          code: "UNUSUAL_AMOUNT",
          field: "amount",
        })
      );
    });

    it("should not warn for amount at min boundary (0.001)", () => {
      const result = validateCommitmentDraft({
        ...VALID_DRAFT,
        amount: 0.001,
      });
      expect(result.warnings).not.toContainEqual(
        expect.objectContaining({ code: "UNUSUAL_AMOUNT" })
      );
    });

    it("should not warn for amount at max boundary (1000000)", () => {
      const result = validateCommitmentDraft({
        ...VALID_DRAFT,
        amount: 1000000,
      });
      expect(result.warnings).not.toContainEqual(
        expect.objectContaining({ code: "UNUSUAL_AMOUNT" })
      );
    });

    it("should not warn for normal amount", () => {
      const result = validateCommitmentDraft({
        ...VALID_DRAFT,
        amount: 10000,
      });
      expect(result.warnings).not.toContainEqual(
        expect.objectContaining({ code: "UNUSUAL_AMOUNT" })
      );
    });
  });

  describe("multiple warnings", () => {
    it("should return multiple warnings when multiple conditions met", () => {
      const result = validateCommitmentDraft({
        ...VALID_DRAFT,
        maxLossBps: 6000,
        durationDays: 400,
        amount: 2000000,
      });
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(3);
      expect(result.warnings.map((w) => w.code)).toEqual([
        "HIGH_RISK_LOSS_TOLERANCE",
        "UNUSUAL_DURATION",
        "UNUSUAL_AMOUNT",
      ]);
    });

    it("should return no warnings when all values are normal", () => {
      const result = validateCommitmentDraft({
        ownerAddress: VALID_ADDRESS,
        asset: "USDC",
        amount: 1000,
        durationDays: 30,
        maxLossBps: 1000,
      });
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe("type coercion", () => {
    it("should coerce string amount to number", () => {
      const result = validateCommitmentDraft({
        ...VALID_DRAFT,
        amount: "999.99",
      });
      expect(result.data?.amount).toBe(999.99);
    });

    it("should coerce string duration to integer", () => {
      const result = validateCommitmentDraft({
        ...VALID_DRAFT,
        durationDays: "45",
      });
      expect(result.data?.durationDays).toBe(45);
    });
  });

  describe("null/undefined handling", () => {
    it("should return error for null input", () => {
      const result = validateCommitmentDraft(null);
      expect(result.valid).toBe(false);
    });

    it("should return error for undefined input", () => {
      const result = validateCommitmentDraft(undefined);
      expect(result.valid).toBe(false);
    });

    it("should return error for empty object", () => {
      const result = validateCommitmentDraft({});
      expect(result.valid).toBe(false);
    });
  });
});

describe("POST /api/commitments/validate", () => {
  const validRequest = {
    ownerAddress: VALID_ADDRESS,
    asset: "USDC",
    amount: 1000,
    durationDays: 30,
    maxLossBps: 1000,
  };

  it("should return valid response for valid draft", async () => {
    const request = createMockRequest(
      "http://localhost:3000/api/commitments/validate",
      {
        method: "POST",
        body: validRequest,
      }
    );
    const response = await POST(request);
    const result = await parseResponse(response);

    expect(result.status).toBe(200);
    expect(result.data.success).toBe(true);
    expect(result.data.data.valid).toBe(true);
    expect(result.data.data.errors).toHaveLength(0);
    expect(result.data.data.data).toBeDefined();
  });

  it("should return warnings in response for high risk draft", async () => {
    const request = createMockRequest(
      "http://localhost:3000/api/commitments/validate",
      {
        method: "POST",
        body: { ...validRequest, maxLossBps: 6000 },
      }
    );
    const response = await POST(request);
    const result = await parseResponse(response);

    expect(result.data.data.valid).toBe(true);
    expect(result.data.data.warnings.length).toBeGreaterThan(0);
    expect(result.data.data.warnings[0]).toHaveProperty("code");
    expect(result.data.data.warnings[0]).toHaveProperty("message");
  });

  it("should return errors for invalid draft", async () => {
    const request = createMockRequest(
      "http://localhost:3000/api/commitments/validate",
      {
        method: "POST",
        body: { asset: "USDC" },
      }
    );
    const response = await POST(request);
    const result = await parseResponse(response);

    expect(result.status).toBe(200);
    expect(result.data.success).toBe(true);
    expect(result.data.data.valid).toBe(false);
    expect(result.data.data.errors.length).toBeGreaterThan(0);
    expect(result.data.data.data).toBeUndefined();
  });

  it("should handle string numeric values", async () => {
    const request = createMockRequest(
      "http://localhost:3000/api/commitments/validate",
      {
        method: "POST",
        body: {
          ownerAddress: VALID_ADDRESS,
          asset: "XLM",
          amount: "500.5",
          durationDays: "90",
          maxLossBps: "2500",
        },
      }
    );
    const response = await POST(request);
    const result = await parseResponse(response);

    expect(result.data.data.valid).toBe(true);
    expect(result.data.data.data?.amount).toBe(500.5);
  });

  it("should handle empty body gracefully", async () => {
    const request = createMockRequest(
      "http://localhost:3000/api/commitments/validate",
      {
        method: "POST",
        body: {},
      }
    );
    const response = await POST(request);
    const result = await parseResponse(response);

    expect(result.data.data.valid).toBe(false);
    expect(result.data.data.errors.length).toBeGreaterThan(0);
  });
});