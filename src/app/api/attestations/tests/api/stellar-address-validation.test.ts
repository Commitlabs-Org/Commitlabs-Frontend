import { describe, it, expect } from "vitest";
import { StrKey } from "@stellar/stellar-sdk";
import {
  validateStellarAddress,
  stellarAddressSchema,
  validateAddress,
} from "@/lib/backend/validation";

// ── Test fixtures ─────────────────────────────────────────────────────────────

// A real valid Stellar Ed25519 public key (G... format)
const VALID_ADDRESS = "GBVFTZL5HIPT4PFQVTZVIWR77V7LWYCXU4CLYWWHHOEXB64XPG5LDMTU";
const VALID_ADDRESS_2 = "GDQNY3PBOJOKYZSRMK2S7LHHGWZIUISD4QORETLMXEWXBI7KFZZMKTL3";

// Invalid addresses
const INVALID_SHORT = "GABC";
const INVALID_EMPTY = "";
const INVALID_RANDOM = "not-a-stellar-address";
const INVALID_WRONG_PREFIX = "SABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEF"; // S... is secret key
const INVALID_NUMBER = 12345;
const INVALID_NULL = null;
const INVALID_UNDEFINED = undefined;

// ── validateStellarAddress ────────────────────────────────────────────────────

describe("validateStellarAddress", () => {
  describe("valid addresses", () => {
    it("accepts a valid G... address", () => {
      expect(validateStellarAddress(VALID_ADDRESS)).toBe(VALID_ADDRESS);
    });

    it("accepts a second valid G... address", () => {
      expect(validateStellarAddress(VALID_ADDRESS_2)).toBe(VALID_ADDRESS_2);
    });

    it("trims whitespace from a valid address", () => {
      expect(validateStellarAddress(`  ${VALID_ADDRESS}  `)).toBe(VALID_ADDRESS);
    });

    it("uses custom field name in error messages", () => {
      expect(() =>
        validateStellarAddress(INVALID_RANDOM, "ownerAddress"),
      ).toThrow("ownerAddress");
    });
  });

  describe("invalid addresses", () => {
    it("rejects an empty string", () => {
      expect(() => validateStellarAddress(INVALID_EMPTY)).toThrow(
        "address is required",
      );
    });

    it("rejects a whitespace-only string", () => {
      expect(() => validateStellarAddress("   ")).toThrow(
        "address is required",
      );
    });

    it("rejects a too-short string", () => {
      expect(() => validateStellarAddress(INVALID_SHORT)).toThrow(
        "valid Stellar address",
      );
    });

    it("rejects a random string", () => {
      expect(() => validateStellarAddress(INVALID_RANDOM)).toThrow(
        "valid Stellar address",
      );
    });

    it("rejects a secret key (S... format)", () => {
      expect(() => validateStellarAddress(INVALID_WRONG_PREFIX)).toThrow(
        "valid Stellar address",
      );
    });

    it("rejects a number", () => {
      expect(() => validateStellarAddress(INVALID_NUMBER)).toThrow(
        "non-empty string",
      );
    });

    it("rejects null", () => {
      expect(() => validateStellarAddress(INVALID_NULL)).toThrow(
        "non-empty string",
      );
    });

    it("rejects undefined", () => {
      expect(() => validateStellarAddress(INVALID_UNDEFINED)).toThrow(
        "non-empty string",
      );
    });

    it("throws ValidationError with correct field context", () => {
      try {
        validateStellarAddress(INVALID_RANDOM, "sellerAddress");
        expect.fail("should have thrown");
      } catch (err: any) {
        expect(err.name).toBe("ValidationError");
        expect(err.field).toBe("sellerAddress");
        expect(err.message).toContain("sellerAddress");
      }
    });
  });
});

// ── stellarAddressSchema (Zod) ────────────────────────────────────────────────

describe("stellarAddressSchema", () => {
  it("parses a valid address", () => {
    expect(stellarAddressSchema.parse(VALID_ADDRESS)).toBe(VALID_ADDRESS);
  });

  it("trims whitespace before validating", () => {
    expect(stellarAddressSchema.parse(`  ${VALID_ADDRESS}  `)).toBe(VALID_ADDRESS);
  });

  it("fails for an invalid address", () => {
    expect(() => stellarAddressSchema.parse(INVALID_RANDOM)).toThrow();
  });

  it("fails for empty string", () => {
    expect(() => stellarAddressSchema.parse(INVALID_EMPTY)).toThrow();
  });

  it("fails for a secret key", () => {
    expect(() => stellarAddressSchema.parse(INVALID_WRONG_PREFIX)).toThrow();
  });

  it("error message mentions G... format", () => {
    try {
      stellarAddressSchema.parse(INVALID_RANDOM);
      expect.fail("should have thrown");
    } catch (err: any) {
      const message = err.issues?.[0]?.message ?? err.message;
      expect(message).toContain("G...");
    }
  });
});

// ── validateAddress (existing helper — regression) ───────────────────────────

describe("validateAddress (existing helper)", () => {
  it("still accepts a valid address", () => {
    expect(validateAddress(VALID_ADDRESS)).toBe(VALID_ADDRESS);
  });

  it("still rejects an invalid address", () => {
    expect(() => validateAddress(INVALID_RANDOM)).toThrow();
  });
});

// ── StrKey.isValidEd25519PublicKey (unit — documents expected behaviour) ──────

describe("StrKey.isValidEd25519PublicKey", () => {
  it("returns true for a valid G... key", () => {
    expect(StrKey.isValidEd25519PublicKey(VALID_ADDRESS)).toBe(true);
  });

  it("returns false for a secret key", () => {
    expect(StrKey.isValidEd25519PublicKey(INVALID_WRONG_PREFIX)).toBe(false);
  });

  it("returns false for a random string", () => {
    expect(StrKey.isValidEd25519PublicKey(INVALID_RANDOM)).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(StrKey.isValidEd25519PublicKey(INVALID_EMPTY)).toBe(false);
  });
});