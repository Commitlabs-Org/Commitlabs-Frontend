import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  validateCommitmentDraft,
  validateAddress,
  validateStellarAddress,
  validateSupportedAsset,
  validateAmount,
  validatePagination,
  validateFilters,
  handleValidationError,
  ValidationError,
  createCommitmentSchema,
  createMarketplaceListingSchema,
  createAttestationSchema,
  DisputeReasonSchema,
  ResolveDisputeSchema,
  stellarAddressSchema,
} from "@/lib/backend/validation";

// ─── Fixtures ───────────────────────────────────────────────────────────────────

const VALID_ADDRESS = "GBVFTZL5HIPT4PFQVTZVIWR77V7LWYCXU4CLYWWHHOEXB64XPG5LDMTU";
const INVALID_ADDRESS_SHORT = "GSHORT";
const INVALID_ADDRESS_BAD_PREFIX = "AXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
const INVALID_ADDRESS_BAD_CHARS = "G!@#$%^&*()_+{}|:<>?~";

const SUPPORTED_ASSET_XLM = "XLM";
const UNSUPPORTED_ASSET = "ETH";
const ASSET_LOWERCASE = "xlm";
const ASSET_PADDED = " usdc ";

function validDraft(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ownerAddress: VALID_ADDRESS,
    asset: SUPPORTED_ASSET_XLM,
    amount: 100,
    durationDays: 30,
    maxLossBps: 1000,
    ...overrides,
  };
}

// ─── validateCommitmentDraft ────────────────────────────────────────────────────

describe("validateCommitmentDraft", () => {
  describe("schema-level parse failures", () => {
    it("rejects when ownerAddress is empty string", () => {
      const result = validateCommitmentDraft(validDraft({ ownerAddress: "" }));
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe("ownerAddress");
    });

    it("rejects when asset is empty string", () => {
      const result = validateCommitmentDraft(validDraft({ asset: "" }));
      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe("asset");
    });

    it("rejects when ownerAddress is missing", () => {
      const { ownerAddress: _, ...rest } = validDraft();
      const result = validateCommitmentDraft(rest);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === "ownerAddress")).toBe(true);
    });

    it("rejects when asset is missing", () => {
      const { asset: _, ...rest } = validDraft();
      const result = validateCommitmentDraft(rest);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === "asset")).toBe(true);
    });

    it("collects multiple schema errors", () => {
      const result = validateCommitmentDraft({});
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("amount validation", () => {
    it("rejects string non-numeric amount", () => {
      const result = validateCommitmentDraft(validDraft({ amount: "abc" }));
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toMatch(/amount must be a positive number/i);
    });

    it("rejects null amount", () => {
      const result = validateCommitmentDraft(validDraft({ amount: null }));
      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe("amount");
    });

    it("rejects undefined amount", () => {
      const result = validateCommitmentDraft(validDraft({ amount: undefined }));
      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe("amount");
    });

    it("rejects zero amount", () => {
      const result = validateCommitmentDraft(validDraft({ amount: 0 }));
      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe("amount");
    });

    it("rejects negative amount", () => {
      const result = validateCommitmentDraft(validDraft({ amount: -50 }));
      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe("amount");
    });

    it("accepts string numeric amount", () => {
      const result = validateCommitmentDraft(validDraft({ amount: "200" }));
      expect(result.valid).toBe(true);
      expect(result.data?.amount).toBe(200);
    });

    it("accepts positive float amount", () => {
      const result = validateCommitmentDraft(validDraft({ amount: 0.5 }));
      expect(result.valid).toBe(true);
      expect(result.data?.amount).toBe(0.5);
    });
  });

  describe("durationDays validation", () => {
    it("rejects null duration", () => {
      const result = validateCommitmentDraft(validDraft({ durationDays: null }));
      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe("durationDays");
    });

    it("rejects undefined duration", () => {
      const result = validateCommitmentDraft(validDraft({ durationDays: undefined }));
      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe("durationDays");
    });

    it("rejects zero duration", () => {
      const result = validateCommitmentDraft(validDraft({ durationDays: 0 }));
      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe("durationDays");
    });

    it("rejects negative duration", () => {
      const result = validateCommitmentDraft(validDraft({ durationDays: -7 }));
      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe("durationDays");
    });

    it("rejects non-integer duration", () => {
      const result = validateCommitmentDraft(validDraft({ durationDays: 7.5 }));
      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe("durationDays");
    });

    it("rejects non-numeric string duration", () => {
      const result = validateCommitmentDraft(validDraft({ durationDays: "abc" }));
      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe("durationDays");
    });

    it("accepts string integer duration", () => {
      const result = validateCommitmentDraft(validDraft({ durationDays: "45" }));
      expect(result.valid).toBe(true);
      expect(result.data?.durationDays).toBe(45);
    });

    it("accepts valid positive integer", () => {
      const result = validateCommitmentDraft(validDraft({ durationDays: 30 }));
      expect(result.valid).toBe(true);
      expect(result.data?.durationDays).toBe(30);
    });
  });

  describe("maxLossBps validation", () => {
    it("rejects null maxLossBps", () => {
      const result = validateCommitmentDraft(validDraft({ maxLossBps: null }));
      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe("maxLossBps");
    });

    it("rejects negative maxLossBps", () => {
      const result = validateCommitmentDraft(validDraft({ maxLossBps: -1 }));
      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe("maxLossBps");
    });

    it("accepts zero maxLossBps", () => {
      const result = validateCommitmentDraft(validDraft({ maxLossBps: 0 }));
      expect(result.valid).toBe(true);
      expect(result.data?.maxLossBps).toBe(0);
    });

    it("accepts float maxLossBps (no integer check)", () => {
      const result = validateCommitmentDraft(validDraft({ maxLossBps: 500.5 }));
      expect(result.valid).toBe(true);
      expect(result.data?.maxLossBps).toBe(500.5);
    });

    it("accepts string numeric maxLossBps", () => {
      const result = validateCommitmentDraft(validDraft({ maxLossBps: "250" }));
      expect(result.valid).toBe(true);
      expect(result.data?.maxLossBps).toBe(250);
    });
  });

  describe("ownerAddress StrKey validation", () => {
    it("rejects invalid Stellar address", () => {
      const result = validateCommitmentDraft(validDraft({ ownerAddress: INVALID_ADDRESS_SHORT }));
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toMatch(/invalid stellar address/i);
      expect(result.errors[0].field).toBe("ownerAddress");
    });

    it("rejects address with bad prefix", () => {
      const result = validateCommitmentDraft(validDraft({ ownerAddress: INVALID_ADDRESS_BAD_PREFIX }));
      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe("ownerAddress");
    });

    it("accepts valid Stellar address", () => {
      const result = validateCommitmentDraft(validDraft({ ownerAddress: VALID_ADDRESS }));
      expect(result.valid).toBe(true);
      expect(result.data?.ownerAddress).toBe(VALID_ADDRESS);
    });
  });

  describe("successful validation", () => {
    it("returns valid result with data for comfortable values", () => {
      const input = validDraft();
      const result = validateCommitmentDraft(input);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.data).toMatchObject({
        ownerAddress: VALID_ADDRESS,
        asset: SUPPORTED_ASSET_XLM,
        amount: 100,
        durationDays: 30,
        maxLossBps: 1000,
      });
    });

    it("returns valid result with warnings for boundary-triggering values", () => {
      const result = validateCommitmentDraft(validDraft({ amount: 1000001, durationDays: 400, maxLossBps: 6000 }));
      expect(result.valid).toBe(true);
      expect(result.data).toBeDefined();
    });
  });
});

// ─── Warnings (tested through validateCommitmentDraft) ──────────────────────────

describe("validateCommitmentDraft warnings", () => {
  it("triggers HIGH_RISK_LOSS_TOLERANCE when maxLossBps > 5000", () => {
    const result = validateCommitmentDraft(validDraft({ maxLossBps: 5001 }));
    expect(result.valid).toBe(true);
    const warning = result.warnings.find((w) => w.code === "HIGH_RISK_LOSS_TOLERANCE");
    expect(warning).toBeDefined();
    expect(warning?.field).toBe("maxLossBps");
  });

  it("does NOT warn at exactly 5000 maxLossBps", () => {
    const result = validateCommitmentDraft(validDraft({ maxLossBps: 5000 }));
    expect(result.valid).toBe(true);
    expect(result.warnings.filter((w) => w.code === "HIGH_RISK_LOSS_TOLERANCE")).toHaveLength(0);
  });

  it("does NOT warn below 5000 maxLossBps", () => {
    const result = validateCommitmentDraft(validDraft({ maxLossBps: 4999 }));
    expect(result.valid).toBe(true);
    expect(result.warnings.filter((w) => w.code === "HIGH_RISK_LOSS_TOLERANCE")).toHaveLength(0);
  });

  it("triggers UNUSUAL_DURATION when durationDays > 365", () => {
    const result = validateCommitmentDraft(validDraft({ durationDays: 366 }));
    expect(result.valid).toBe(true);
    const warning = result.warnings.find((w) => w.code === "UNUSUAL_DURATION");
    expect(warning).toBeDefined();
    expect(warning?.field).toBe("durationDays");
  });

  it("does NOT warn at exactly 365 durationDays", () => {
    const result = validateCommitmentDraft(validDraft({ durationDays: 365 }));
    expect(result.valid).toBe(true);
    expect(result.warnings.filter((w) => w.code === "UNUSUAL_DURATION")).toHaveLength(0);
  });

  it("does NOT warn at exactly 1 durationDays", () => {
    const result = validateCommitmentDraft(validDraft({ durationDays: 1 }));
    expect(result.valid).toBe(true);
    expect(result.warnings.filter((w) => w.code === "UNUSUAL_DURATION")).toHaveLength(0);
  });

  it("triggers UNUSUAL_AMOUNT when amount > 1000000", () => {
    const result = validateCommitmentDraft(validDraft({ amount: 1000000.1 }));
    expect(result.valid).toBe(true);
    const warning = result.warnings.find((w) => w.code === "UNUSUAL_AMOUNT");
    expect(warning).toBeDefined();
    expect(warning?.field).toBe("amount");
  });

  it("does NOT warn at exactly 1000000 amount", () => {
    const result = validateCommitmentDraft(validDraft({ amount: 1000000 }));
    expect(result.valid).toBe(true);
    expect(result.warnings.filter((w) => w.code === "UNUSUAL_AMOUNT")).toHaveLength(0);
  });

  it("does NOT warn at exactly 0.001 amount", () => {
    const result = validateCommitmentDraft(validDraft({ amount: 0.001 }));
    expect(result.valid).toBe(true);
    expect(result.warnings.filter((w) => w.code === "UNUSUAL_AMOUNT")).toHaveLength(0);
  });

  it("fires all three warnings when all thresholds exceeded", () => {
    const result = validateCommitmentDraft(
      validDraft({ amount: 1000001, durationDays: 400, maxLossBps: 6000 })
    );
    expect(result.valid).toBe(true);
    const codes = result.warnings.map((w) => w.code);
    expect(codes).toContain("HIGH_RISK_LOSS_TOLERANCE");
    expect(codes).toContain("UNUSUAL_DURATION");
    expect(codes).toContain("UNUSUAL_AMOUNT");
  });
});

// ─── validateAddress ───────────────────────────────────────────────────────────

describe("validateAddress", () => {
  it("returns the address string for a valid Stellar address", () => {
    expect(validateAddress(VALID_ADDRESS)).toBe(VALID_ADDRESS);
  });

  it("throws ValidationError for an invalid address", () => {
    expect(() => validateAddress(INVALID_ADDRESS_BAD_CHARS)).toThrow(ValidationError);
  });

  it("sets field to 'address' in thrown ValidationError", () => {
    let thrown: unknown;
    try {
      validateAddress(INVALID_ADDRESS_SHORT);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(ValidationError);
    expect((thrown as ValidationError).field).toBe("address");
  });
});

// ─── validateStellarAddress ────────────────────────────────────────────────────

describe("validateStellarAddress", () => {
  it("throws when address is not a string", () => {
    expect(() => validateStellarAddress(123)).toThrow(ValidationError);
  });

  it("throws when address is empty string", () => {
    expect(() => validateStellarAddress("")).toThrow(ValidationError);
  });

  it("throws when address is whitespace", () => {
    expect(() => validateStellarAddress("   ")).toThrow(ValidationError);
  });

  it("throws when address fails StrKey check", () => {
    expect(() => validateStellarAddress(INVALID_ADDRESS_SHORT)).toThrow(ValidationError);
  });

  it("returns trimmed address", () => {
    const result = validateStellarAddress(`  ${VALID_ADDRESS}  `);
    expect(result).toBe(VALID_ADDRESS);
  });

  it("uses custom field name in error message", () => {
    let thrown: unknown;
    try {
      validateStellarAddress("bad", "wallet");
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(ValidationError);
    expect((thrown as ValidationError).field).toBe("wallet");
    expect((thrown as ValidationError).message).toContain("wallet");
  });

  it("returns the address for a valid input", () => {
    expect(validateStellarAddress(VALID_ADDRESS)).toBe(VALID_ADDRESS);
  });
});

// ─── validateSupportedAsset ─────────────────────────────────────────────────────

describe("validateSupportedAsset", () => {
  it("throws when asset is not a string", () => {
    expect(() => validateSupportedAsset(123)).toThrow(ValidationError);
  });

  it("throws when asset is empty string", () => {
    expect(() => validateSupportedAsset("")).toThrow(ValidationError);
  });

  it("returns uppercase XLM for lowercase input", () => {
    expect(validateSupportedAsset(ASSET_LOWERCASE)).toBe("XLM");
  });

  it("returns USDC for whitespace-padded input", () => {
    expect(validateSupportedAsset(ASSET_PADDED)).toBe("USDC");
  });

  it("throws for unsupported asset ETH", () => {
    expect(() => validateSupportedAsset(UNSUPPORTED_ASSET)).toThrow(ValidationError);
  });

  it("error message includes XLM and USDC for unsupported asset", () => {
    let thrown: unknown;
    try {
      validateSupportedAsset(UNSUPPORTED_ASSET);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(ValidationError);
    expect((thrown as ValidationError).message).toContain("XLM");
    expect((thrown as ValidationError).message).toContain("USDC");
  });

  it("returns XLM for exactly 'XLM'", () => {
    expect(validateSupportedAsset("XLM")).toBe("XLM");
  });

  it("uses custom field name in error message", () => {
    let thrown: unknown;
    try {
      validateSupportedAsset(UNSUPPORTED_ASSET, "token");
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(ValidationError);
    expect((thrown as ValidationError).field).toBe("token");
  });
});

// ─── validateAmount ────────────────────────────────────────────────────────────

describe("validateAmount", () => {
  it("returns number for valid number input", () => {
    expect(validateAmount(42)).toBe(42);
  });

  it("returns number for valid string input", () => {
    expect(validateAmount("42")).toBe(42);
  });

  it("throws for zero", () => {
    expect(() => validateAmount(0)).toThrow(ValidationError);
  });

  it("throws for negative number", () => {
    expect(() => validateAmount(-5)).toThrow(ValidationError);
  });

  it("throws for non-numeric string", () => {
    expect(() => validateAmount("abc")).toThrow(ValidationError);
  });

  it("throws for empty string", () => {
    expect(() => validateAmount("")).toThrow(ValidationError);
  });

  it("throws with field 'amount'", () => {
    let thrown: unknown;
    try {
      validateAmount(0);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(ValidationError);
    expect((thrown as ValidationError).field).toBe("amount");
  });
});

// ─── validatePagination ────────────────────────────────────────────────────────

describe("validatePagination", () => {
  it("returns defaults when no arguments provided", () => {
    const result = validatePagination();
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
    expect(result.offset).toBe(0);
  });

  it("accepts string page value", () => {
    const result = validatePagination("2");
    expect(result.page).toBe(2);
    expect(result.offset).toBe(10);
  });

  it("throws when page is zero", () => {
    expect(() => validatePagination(0)).toThrow(ValidationError);
  });

  it("throws when page is negative", () => {
    expect(() => validatePagination(-1)).toThrow(ValidationError);
  });

  it("throws when page is a float", () => {
    expect(() => validatePagination(1.5)).toThrow(ValidationError);
  });

  it("throws when page is non-numeric string", () => {
    expect(() => validatePagination("abc")).toThrow(ValidationError);
  });

  it("throws when limit is zero", () => {
    expect(() => validatePagination(1, 0)).toThrow(ValidationError);
  });

  it("throws when limit exceeds 100", () => {
    expect(() => validatePagination(1, 101)).toThrow(ValidationError);
  });

  it("throws when limit is a float", () => {
    expect(() => validatePagination(1, 50.5)).toThrow(ValidationError);
  });

  it("throws when limit is non-numeric string", () => {
    expect(() => validatePagination(1, "abc")).toThrow(ValidationError);
  });

  it("accepts limit of exactly 100", () => {
    const result = validatePagination(1, 100);
    expect(result.pageSize).toBe(100);
  });

  it("accepts limit of exactly 1", () => {
    const result = validatePagination(1, 1);
    expect(result.pageSize).toBe(1);
  });

  it("computes offset correctly", () => {
    const result = validatePagination(3, 20);
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(20);
    expect(result.offset).toBe(40);
  });

  it("throws with field 'page' for page errors", () => {
    let thrown: unknown;
    try {
      validatePagination(0);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(ValidationError);
    expect((thrown as ValidationError).field).toBe("page");
  });

  it("throws with field 'limit' for limit errors", () => {
    let thrown: unknown;
    try {
      validatePagination(1, 0);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(ValidationError);
    expect((thrown as ValidationError).field).toBe("limit");
  });
});

// ─── validateFilters ───────────────────────────────────────────────────────────

describe("validateFilters", () => {
  it("passes through string values", () => {
    expect(validateFilters({ category: "impact" })).toEqual({ category: "impact" });
  });

  it("passes through number values", () => {
    expect(validateFilters({ minPrice: 50 })).toEqual({ minPrice: 50 });
  });

  it("passes through boolean values", () => {
    expect(validateFilters({ active: true })).toEqual({ active: true });
  });

  it("skips undefined values", () => {
    expect(validateFilters({ maxPrice: undefined, category: "test" })).toEqual({ category: "test" });
  });

  it("skips null values", () => {
    expect(validateFilters({ extra: null })).toEqual({});
  });

  it("throws for array values", () => {
    expect(() => validateFilters({ bad: [1, 2, 3] })).toThrow(ValidationError);
  });

  it("throws for object values", () => {
    expect(() => validateFilters({ bad: {} })).toThrow(ValidationError);
  });

  it("error message includes the field name for invalid types", () => {
    let thrown: unknown;
    try {
      validateFilters({ bad: [1, 2, 3] });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(ValidationError);
    expect((thrown as ValidationError).message).toContain("bad");
    expect((thrown as ValidationError).field).toBe("bad");
  });

  it("returns empty object for empty input", () => {
    expect(validateFilters({})).toEqual({});
  });

  it("handles mixed valid and invalid inputs — throws on first invalid", () => {
    expect(() => validateFilters({ good: "ok", bad: [1] })).toThrow(ValidationError);
  });
});

// ─── handleValidationError ─────────────────────────────────────────────────────

describe("handleValidationError", () => {
  it("returns 400 Response for ValidationError", () => {
    const err = new ValidationError("bad field", "name");
    const response = handleValidationError(err);
    expect(response.status).toBe(400);
  });

  it("returns error and field in body for ValidationError", async () => {
    const err = new ValidationError("bad field", "name");
    const response = handleValidationError(err);
    const body = await response.json();
    expect(body).toMatchObject({ error: "bad field", field: "name" });
  });

  it("returns 400 Response for ZodError", () => {
    const schema = z.object({ email: z.string().min(1) });
    const parseResult = schema.safeParse({ email: "" });
    expect(parseResult.success).toBe(false);
    if (parseResult.success) return;
    const response = handleValidationError(parseResult.error);
    expect(response.status).toBe(400);
  });

  it("returns first issue message and path for ZodError", async () => {
    const schema = z.object({ email: z.string().min(1, "Email is required") });
    const parseResult = schema.safeParse({ email: "" });
    expect(parseResult.success).toBe(false);
    if (parseResult.success) return;
    const response = handleValidationError(parseResult.error);
    const body = await response.json();
    expect(body).toMatchObject({ error: "Email is required", field: "email" });
  });

  it("re-throws non-validation errors", () => {
    const genericError = new Error("server error");
    expect(() => handleValidationError(genericError)).toThrow("server error");
  });

  it("re-throws non-error values", () => {
    expect(() => handleValidationError("string error")).toThrow();
  });

  it("throws on ZodError with empty issues array (accessing issues[0])", () => {
    const emptyZodError = new z.ZodError([]);
    expect(() => handleValidationError(emptyZodError)).toThrow();
  });

  it("re-throws null", () => {
    expect(() => handleValidationError(null)).toThrow();
  });
});

// ─── stellarAddressSchema (exported Zod schema) ────────────────────────────────

describe("stellarAddressSchema", () => {
  it("parses a valid Stellar address", () => {
    expect(stellarAddressSchema.parse(VALID_ADDRESS)).toBe(VALID_ADDRESS);
  });

  it("trims whitespace and parses", () => {
    expect(stellarAddressSchema.parse(`  ${VALID_ADDRESS}  `)).toBe(VALID_ADDRESS);
  });

  it("rejects an invalid address", () => {
    expect(() => stellarAddressSchema.parse(INVALID_ADDRESS_SHORT)).toThrow(z.ZodError);
  });
});

// ─── createCommitmentSchema ────────────────────────────────────────────────────

describe("createCommitmentSchema", () => {
  const validInput = {
    ownerAddress: VALID_ADDRESS,
    asset: SUPPORTED_ASSET_XLM,
    amount: 100,
    durationDays: 30,
    maxLossBps: 1000,
  };

  it("parses valid input", () => {
    const result = createCommitmentSchema.parse(validInput);
    expect(result.ownerAddress).toBe(VALID_ADDRESS);
    expect(result.asset).toBe("XLM");
    expect(result.amount).toBe(100);
    expect(result.durationDays).toBe(30);
    expect(result.maxLossBps).toBe(1000);
  });

  it("coerces string amount to number", () => {
    const result = createCommitmentSchema.parse({ ...validInput, amount: "200" });
    expect(result.amount).toBe(200);
  });

  it("rejects invalid Stellar address", () => {
    expect(() =>
      createCommitmentSchema.parse({ ...validInput, ownerAddress: INVALID_ADDRESS_SHORT })
    ).toThrow(z.ZodError);
  });

  it("rejects unsupported asset", () => {
    expect(() =>
      createCommitmentSchema.parse({ ...validInput, asset: UNSUPPORTED_ASSET })
    ).toThrow(z.ZodError);
  });

  it("accepts whitespace-padded ownerAddress (trim)", () => {
    const result = createCommitmentSchema.parse({ ...validInput, ownerAddress: `  ${VALID_ADDRESS}  ` });
    expect(result.ownerAddress).toBe(VALID_ADDRESS);
  });

  it("accepts lowercase asset", () => {
    const result = createCommitmentSchema.parse({ ...validInput, asset: ASSET_LOWERCASE });
    expect(result.asset).toBe("XLM");
  });

  it("accepts whitespace-padded asset (trim + uppercase)", () => {
    const result = createCommitmentSchema.parse({ ...validInput, asset: "  xlm  " });
    expect(result.asset).toBe("XLM");
  });

  it("rejects zero amount", () => {
    expect(() =>
      createCommitmentSchema.parse({ ...validInput, amount: 0 })
    ).toThrow(z.ZodError);
  });

  it("rejects negative amount", () => {
    expect(() =>
      createCommitmentSchema.parse({ ...validInput, amount: -1 })
    ).toThrow(z.ZodError);
  });

  it("rejects durationDays below 1", () => {
    expect(() =>
      createCommitmentSchema.parse({ ...validInput, durationDays: 0 })
    ).toThrow(z.ZodError);
  });

  it("rejects durationDays above 365", () => {
    expect(() =>
      createCommitmentSchema.parse({ ...validInput, durationDays: 366 })
    ).toThrow(z.ZodError);
  });

  it("rejects negative maxLossBps", () => {
    expect(() =>
      createCommitmentSchema.parse({ ...validInput, maxLossBps: -1 })
    ).toThrow(z.ZodError);
  });

  it("accepts metadata as optional record", () => {
    const result = createCommitmentSchema.parse({
      ...validInput,
      metadata: { key: "value", num: 42 },
    });
    expect(result.metadata).toEqual({ key: "value", num: 42 });
  });

  it("accepts missing metadata", () => {
    const { metadata: _, ...withoutMetadata } = validInput;
    const result = createCommitmentSchema.parse(withoutMetadata);
    expect(result.metadata).toBeUndefined();
  });
});

// ─── createMarketplaceListingSchema ────────────────────────────────────────────

describe("createMarketplaceListingSchema", () => {
  const validInput = {
    title: "Test Listing",
    price: 50,
    category: "impact",
    sellerAddress: VALID_ADDRESS,
  };

  it("parses valid input", () => {
    const result = createMarketplaceListingSchema.parse(validInput);
    expect(result.title).toBe("Test Listing");
    expect(result.price).toBe(50);
    expect(result.category).toBe("impact");
    expect(result.sellerAddress).toBe(VALID_ADDRESS);
  });

  it("accepts optional description", () => {
    const result = createMarketplaceListingSchema.parse({
      ...validInput,
      description: "A great listing",
    });
    expect(result.description).toBe("A great listing");
  });

  it("allows missing description", () => {
    const result = createMarketplaceListingSchema.parse(validInput);
    expect(result.description).toBeUndefined();
  });

  it("trims whitespace from title", () => {
    const result = createMarketplaceListingSchema.parse({ ...validInput, title: "  Title  " });
    expect(result.title).toBe("Title");
  });

  it("trims whitespace from sellerAddress", () => {
    const result = createMarketplaceListingSchema.parse({ ...validInput, sellerAddress: `  ${VALID_ADDRESS}  ` });
    expect(result.sellerAddress).toBe(VALID_ADDRESS);
  });

  it("rejects empty title", () => {
    expect(() =>
      createMarketplaceListingSchema.parse({ ...validInput, title: "" })
    ).toThrow(z.ZodError);
  });

  it("rejects empty category", () => {
    expect(() =>
      createMarketplaceListingSchema.parse({ ...validInput, category: "" })
    ).toThrow(z.ZodError);
  });

  it("rejects zero price", () => {
    expect(() =>
      createMarketplaceListingSchema.parse({ ...validInput, price: 0 })
    ).toThrow(z.ZodError);
  });

  it("rejects negative price", () => {
    expect(() =>
      createMarketplaceListingSchema.parse({ ...validInput, price: -10 })
    ).toThrow(z.ZodError);
  });

  it("rejects invalid seller address", () => {
    expect(() =>
      createMarketplaceListingSchema.parse({ ...validInput, sellerAddress: INVALID_ADDRESS_SHORT })
    ).toThrow(z.ZodError);
  });
});

// ─── createAttestationSchema ───────────────────────────────────────────────────

describe("createAttestationSchema", () => {
  const validInput = {
    commitmentId: "cmt-123",
    attesterAddress: VALID_ADDRESS,
    rating: 3,
  };

  it("parses valid input", () => {
    const result = createAttestationSchema.parse(validInput);
    expect(result.commitmentId).toBe("cmt-123");
    expect(result.attesterAddress).toBe(VALID_ADDRESS);
    expect(result.rating).toBe(3);
  });

  it("accepts optional comment", () => {
    const result = createAttestationSchema.parse({
      ...validInput,
      comment: "Good job",
    });
    expect(result.comment).toBe("Good job");
  });

  it("rejects empty commitmentId", () => {
    expect(() =>
      createAttestationSchema.parse({ ...validInput, commitmentId: "" })
    ).toThrow(z.ZodError);
  });

  it("rejects invalid attester address", () => {
    expect(() =>
      createAttestationSchema.parse({ ...validInput, attesterAddress: INVALID_ADDRESS_SHORT })
    ).toThrow(z.ZodError);
  });

  it("trims whitespace from attesterAddress", () => {
    const result = createAttestationSchema.parse({ ...validInput, attesterAddress: `  ${VALID_ADDRESS}  ` });
    expect(result.attesterAddress).toBe(VALID_ADDRESS);
  });

  it("rejects rating below 1", () => {
    expect(() =>
      createAttestationSchema.parse({ ...validInput, rating: 0 })
    ).toThrow(z.ZodError);
  });

  it("rejects rating above 5", () => {
    expect(() =>
      createAttestationSchema.parse({ ...validInput, rating: 6 })
    ).toThrow(z.ZodError);
  });

  it("rejects non-integer rating", () => {
    expect(() =>
      createAttestationSchema.parse({ ...validInput, rating: 3.5 })
    ).toThrow(z.ZodError);
  });
});

// ─── DisputeReasonSchema ───────────────────────────────────────────────────────

describe("DisputeReasonSchema", () => {
  const longString = "x".repeat(501);

  it("parses valid input", () => {
    const result = DisputeReasonSchema.parse({ reason: "Dispute reason" });
    expect(result.reason).toBe("Dispute reason");
  });

  it("accepts optional evidence", () => {
    const result = DisputeReasonSchema.parse({
      reason: "Reason",
      evidence: "Evidence text",
    });
    expect(result.evidence).toBe("Evidence text");
  });

  it("rejects empty reason", () => {
    expect(() => DisputeReasonSchema.parse({ reason: "" })).toThrow(z.ZodError);
  });

  it("rejects reason exceeding 500 characters", () => {
    expect(() => DisputeReasonSchema.parse({ reason: longString })).toThrow(z.ZodError);
  });
});

// ─── ResolveDisputeSchema ──────────────────────────────────────────────────────

describe("ResolveDisputeSchema", () => {
  it("parses 'resolved_in_favor_of_owner'", () => {
    const result = ResolveDisputeSchema.parse({
      resolution: "resolved_in_favor_of_owner",
    });
    expect(result.resolution).toBe("resolved_in_favor_of_owner");
  });

  it("parses 'resolved_in_favor_of_counterparty'", () => {
    const result = ResolveDisputeSchema.parse({
      resolution: "resolved_in_favor_of_counterparty",
    });
    expect(result.resolution).toBe("resolved_in_favor_of_counterparty");
  });

  it("parses 'dismissed'", () => {
    const result = ResolveDisputeSchema.parse({ resolution: "dismissed" });
    expect(result.resolution).toBe("dismissed");
  });

  it("rejects invalid resolution value", () => {
    expect(() =>
      ResolveDisputeSchema.parse({ resolution: "invalid_value" })
    ).toThrow(z.ZodError);
  });

  it("accepts optional notes", () => {
    const result = ResolveDisputeSchema.parse({
      resolution: "dismissed",
      notes: "Some notes",
    });
    expect(result.notes).toBe("Some notes");
  });

  it("rejects notes exceeding 1000 characters", () => {
    expect(() =>
      ResolveDisputeSchema.parse({
        resolution: "dismissed",
        notes: "x".repeat(1001),
      })
    ).toThrow(z.ZodError);
  });
});
