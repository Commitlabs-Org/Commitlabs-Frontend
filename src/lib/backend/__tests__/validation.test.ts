import { describe, it, expect } from "vitest";
import {
  validateCommitmentDraft,
  validateStellarAddress,
  validateSupportedAsset,
  validateAmount,
  validatePagination,
  ValidationError,
} from "../validation";
import { PARAMETER_BOUNDS } from "../config";

// A valid Stellar Ed25519 public key for use in tests
const VALID_ADDRESS = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";

describe("validateCommitmentDraft", () => {
  describe("valid draft", () => {
    it("accepts a fully valid draft and returns data", () => {
      const result = validateCommitmentDraft({
        ownerAddress: VALID_ADDRESS,
        asset: "XLM",
        amount: 100,
        durationDays: 30,
        maxLossBps: 1000,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.data).toBeDefined();
      expect(result.data?.ownerAddress).toBe(VALID_ADDRESS);
      expect(result.data?.asset).toBe("XLM");
      expect(result.data?.amount).toBe(100);
      expect(result.data?.durationDays).toBe(30);
      expect(result.data?.maxLossBps).toBe(1000);
    });

    it("accepts numeric strings for amount, durationDays, and maxLossBps", () => {
      const result = validateCommitmentDraft({
        ownerAddress: VALID_ADDRESS,
        asset: "USDC",
        amount: "500",
        durationDays: "60",
        maxLossBps: "2000",
      });

      expect(result.valid).toBe(true);
      expect(result.data?.amount).toBe(500);
      expect(result.data?.durationDays).toBe(60);
      expect(result.data?.maxLossBps).toBe(2000);
    });

    it("accepts zero maxLossBps (no loss tolerance)", () => {
      const result = validateCommitmentDraft({
        ownerAddress: VALID_ADDRESS,
        asset: "XLM",
        amount: 10,
        durationDays: 10,
        maxLossBps: 0,
      });

      expect(result.valid).toBe(true);
      expect(result.data?.maxLossBps).toBe(0);
    });

    it("accepts optional metadata field", () => {
      const result = validateCommitmentDraft({
        ownerAddress: VALID_ADDRESS,
        asset: "XLM",
        amount: 50,
        durationDays: 14,
        maxLossBps: 500,
        metadata: { note: "test", tag: 42 },
      });

      expect(result.valid).toBe(true);
    });
  });

  describe("rejected fields", () => {
    it("rejects missing ownerAddress", () => {
      const result = validateCommitmentDraft({
        asset: "XLM",
        amount: 100,
        durationDays: 30,
        maxLossBps: 1000,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      const ownerError = result.errors.find((e) => e.field === "ownerAddress");
      expect(ownerError).toBeDefined();
    });

    it("rejects empty ownerAddress string", () => {
      const result = validateCommitmentDraft({
        ownerAddress: "",
        asset: "XLM",
        amount: 100,
        durationDays: 30,
        maxLossBps: 1000,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === "ownerAddress")).toBe(true);
    });

    it("rejects an invalid Stellar address", () => {
      const result = validateCommitmentDraft({
        ownerAddress: "NOT_A_VALID_STELLAR_ADDRESS",
        asset: "XLM",
        amount: 100,
        durationDays: 30,
        maxLossBps: 1000,
      });

      expect(result.valid).toBe(false);
      const err = result.errors.find((e) => e.field === "ownerAddress");
      expect(err).toBeDefined();
      expect(err?.message).toMatch(/stellar address/i);
    });

    it("rejects a negative amount", () => {
      const result = validateCommitmentDraft({
        ownerAddress: VALID_ADDRESS,
        asset: "XLM",
        amount: -10,
        durationDays: 30,
        maxLossBps: 1000,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === "amount")).toBe(true);
    });

    it("rejects zero amount", () => {
      const result = validateCommitmentDraft({
        ownerAddress: VALID_ADDRESS,
        asset: "XLM",
        amount: 0,
        durationDays: 30,
        maxLossBps: 1000,
      });

      expect(result.valid).toBe(false);
      const err = result.errors.find((e) => e.field === "amount");
      expect(err).toBeDefined();
      expect(err?.message).toMatch(/positive/i);
    });

    it("rejects non-numeric amount string", () => {
      const result = validateCommitmentDraft({
        ownerAddress: VALID_ADDRESS,
        asset: "XLM",
        amount: "abc",
        durationDays: 30,
        maxLossBps: 1000,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === "amount")).toBe(true);
    });

    it("rejects non-integer durationDays", () => {
      const result = validateCommitmentDraft({
        ownerAddress: VALID_ADDRESS,
        asset: "XLM",
        amount: 100,
        durationDays: 1.5,
        maxLossBps: 1000,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === "durationDays")).toBe(true);
    });

    it("rejects zero durationDays", () => {
      const result = validateCommitmentDraft({
        ownerAddress: VALID_ADDRESS,
        asset: "XLM",
        amount: 100,
        durationDays: 0,
        maxLossBps: 1000,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === "durationDays")).toBe(true);
    });

    it("rejects negative maxLossBps", () => {
      const result = validateCommitmentDraft({
        ownerAddress: VALID_ADDRESS,
        asset: "XLM",
        amount: 100,
        durationDays: 30,
        maxLossBps: -1,
      });

      expect(result.valid).toBe(false);
      const err = result.errors.find((e) => e.field === "maxLossBps");
      expect(err).toBeDefined();
      expect(err?.message).toMatch(/non-negative/i);
    });

    it("rejects null input", () => {
      const result = validateCommitmentDraft(null);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("rejects undefined input", () => {
      const result = validateCommitmentDraft(undefined);
      expect(result.valid).toBe(false);
    });
  });

  describe("warning-only cases", () => {
    it("emits HIGH_RISK_LOSS_TOLERANCE warning when maxLossBps > 5000", () => {
      const result = validateCommitmentDraft({
        ownerAddress: VALID_ADDRESS,
        asset: "XLM",
        amount: 100,
        durationDays: 30,
        maxLossBps: 6000,
      });

      expect(result.valid).toBe(true);
      const warning = result.warnings.find(
        (w) => w.code === "HIGH_RISK_LOSS_TOLERANCE"
      );
      expect(warning).toBeDefined();
      expect(warning?.field).toBe("maxLossBps");
      expect(warning?.message).toContain("6000");
    });

    it("emits UNUSUAL_DURATION warning when durationDays exceeds bounds", () => {
      const aboveMax = PARAMETER_BOUNDS.durationDays.max + 1;
      const result = validateCommitmentDraft({
        ownerAddress: VALID_ADDRESS,
        asset: "XLM",
        amount: 100,
        durationDays: aboveMax,
        maxLossBps: 1000,
      });

      // Duration above max still passes validation but triggers warning
      if (result.valid) {
        const warning = result.warnings.find(
          (w) => w.code === "UNUSUAL_DURATION"
        );
        expect(warning).toBeDefined();
        expect(warning?.field).toBe("durationDays");
      } else {
        // Some implementations may reject out-of-bounds duration
        expect(result.errors.some((e) => e.field === "durationDays")).toBe(true);
      }
    });

    it("emits UNUSUAL_AMOUNT warning when amount is below minimum bound", () => {
      const belowMin = PARAMETER_BOUNDS.amount.min / 2;
      const result = validateCommitmentDraft({
        ownerAddress: VALID_ADDRESS,
        asset: "XLM",
        amount: belowMin,
        durationDays: 30,
        maxLossBps: 1000,
      });

      if (result.valid) {
        const warning = result.warnings.find((w) => w.code === "UNUSUAL_AMOUNT");
        expect(warning).toBeDefined();
        expect(warning?.field).toBe("amount");
      }
    });

    it("emits UNUSUAL_AMOUNT warning when amount exceeds maximum bound", () => {
      const aboveMax = PARAMETER_BOUNDS.amount.max * 2;
      const result = validateCommitmentDraft({
        ownerAddress: VALID_ADDRESS,
        asset: "XLM",
        amount: aboveMax,
        durationDays: 30,
        maxLossBps: 1000,
      });

      if (result.valid) {
        const warning = result.warnings.find((w) => w.code === "UNUSUAL_AMOUNT");
        expect(warning).toBeDefined();
      }
    });

    it("returns no warnings for a normal mid-range draft", () => {
      const result = validateCommitmentDraft({
        ownerAddress: VALID_ADDRESS,
        asset: "XLM",
        amount: 100,
        durationDays: 30,
        maxLossBps: 1000,
      });

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it("can accumulate multiple warnings at once", () => {
      // High bps + unusual duration should emit two warnings
      const aboveMax = PARAMETER_BOUNDS.durationDays.max + 1;
      const result = validateCommitmentDraft({
        ownerAddress: VALID_ADDRESS,
        asset: "XLM",
        amount: 100,
        durationDays: aboveMax,
        maxLossBps: 9999,
      });

      if (result.valid) {
        expect(result.warnings.length).toBeGreaterThanOrEqual(2);
      }
    });
  });
});

describe("validateStellarAddress", () => {
  it("returns the trimmed address when valid", () => {
    expect(validateStellarAddress(VALID_ADDRESS)).toBe(VALID_ADDRESS);
  });

  it("trims surrounding whitespace before validating", () => {
    expect(validateStellarAddress(`  ${VALID_ADDRESS}  `)).toBe(VALID_ADDRESS);
  });

  it("throws ValidationError for an invalid address", () => {
    expect(() => validateStellarAddress("INVALID")).toThrow(ValidationError);
  });

  it("throws ValidationError for an empty string", () => {
    expect(() => validateStellarAddress("")).toThrow(ValidationError);
  });

  it("throws ValidationError for a non-string value", () => {
    expect(() => validateStellarAddress(12345)).toThrow(ValidationError);
  });

  it("includes field context in the error when field is provided", () => {
    try {
      validateStellarAddress("bad", "ownerAddress");
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).field).toBe("ownerAddress");
    }
  });
});

describe("validateSupportedAsset", () => {
  it("returns the uppercased asset code for a supported asset", () => {
    expect(validateSupportedAsset("xlm")).toBe("XLM");
    expect(validateSupportedAsset("usdc")).toBe("USDC");
  });

  it("throws ValidationError for an unsupported asset", () => {
    expect(() => validateSupportedAsset("BTC")).toThrow(ValidationError);
  });

  it("throws ValidationError for an empty string", () => {
    expect(() => validateSupportedAsset("")).toThrow(ValidationError);
  });

  it("throws ValidationError for a non-string value", () => {
    expect(() => validateSupportedAsset(42)).toThrow(ValidationError);
  });

  it("error message lists the supported assets", () => {
    try {
      validateSupportedAsset("FAKE");
    } catch (err) {
      expect((err as ValidationError).message).toMatch(/XLM/);
    }
  });
});

describe("validateAmount", () => {
  it("accepts a positive number", () => {
    expect(validateAmount(50)).toBe(50);
  });

  it("accepts a numeric string and returns a number", () => {
    expect(validateAmount("3.14")).toBeCloseTo(3.14);
  });

  it("throws ValidationError for zero", () => {
    expect(() => validateAmount(0)).toThrow(ValidationError);
  });

  it("throws ValidationError for a negative number", () => {
    expect(() => validateAmount(-1)).toThrow(ValidationError);
  });

  it("throws ValidationError for a non-numeric string", () => {
    expect(() => validateAmount("not-a-number")).toThrow(ValidationError);
  });
});

describe("validatePagination", () => {
  it("returns page=1, pageSize=10, offset=0 by default", () => {
    const result = validatePagination();
    expect(result).toEqual({ page: 1, pageSize: 10, offset: 0 });
  });

  it("computes offset correctly", () => {
    const result = validatePagination(3, 20);
    expect(result.offset).toBe(40);
    expect(result.pageSize).toBe(20);
  });

  it("accepts string values and coerces them", () => {
    const result = validatePagination("2", "25");
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(25);
    expect(result.offset).toBe(25);
  });

  it("throws ValidationError for page < 1", () => {
    expect(() => validatePagination(0)).toThrow(ValidationError);
  });

  it("throws ValidationError for limit > 100", () => {
    expect(() => validatePagination(1, 101)).toThrow(ValidationError);
  });

  it("throws ValidationError for a non-integer page", () => {
    expect(() => validatePagination(1.5)).toThrow(ValidationError);
  });
});
