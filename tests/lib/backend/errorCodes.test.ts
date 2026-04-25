import { describe, it, expect } from "vitest";
import {
  ERROR_CODE_REGISTRY,
  validateErrorCodeRegistry,
  getErrorCodesByStatus,
  getErrorCodeDefinition,
} from "@/lib/backend/errorCodes";

describe("ERROR_CODE_REGISTRY", () => {
  describe("Registry Structure", () => {
    it("should contain all required 4xx error codes", () => {
      const requiredCodes = [
        "BAD_REQUEST",
        "VALIDATION_ERROR",
        "UNAUTHORIZED",
        "FORBIDDEN",
        "NOT_FOUND",
        "CONFLICT",
        "UNPROCESSABLE_ENTITY",
        "TOO_MANY_REQUESTS",
      ];

      requiredCodes.forEach((code) => {
        expect(ERROR_CODE_REGISTRY[code]).toBeDefined();
        expect(ERROR_CODE_REGISTRY[code].code).toBe(code);
      });
    });

    it("should contain all required 5xx error codes", () => {
      const requiredCodes = [
        "INTERNAL_ERROR",
        "BAD_GATEWAY",
        "SERVICE_UNAVAILABLE",
        "GATEWAY_TIMEOUT",
      ];

      requiredCodes.forEach((code) => {
        expect(ERROR_CODE_REGISTRY[code]).toBeDefined();
        expect(ERROR_CODE_REGISTRY[code].code).toBe(code);
      });
    });

    it("should contain domain-specific error codes", () => {
      const domainCodes = ["BLOCKCHAIN_UNAVAILABLE", "BLOCKCHAIN_CALL_FAILED"];

      domainCodes.forEach((code) => {
        expect(ERROR_CODE_REGISTRY[code]).toBeDefined();
        expect(ERROR_CODE_REGISTRY[code].code).toBe(code);
      });
    });

    it("should not have duplicate error codes", () => {
      const codes = Object.keys(ERROR_CODE_REGISTRY);
      const uniqueCodes = new Set(codes);
      expect(codes.length).toBe(uniqueCodes.size);
    });
  });

  describe("Error Definition Validation", () => {
    it("should have valid structure for each error code", () => {
      Object.entries(ERROR_CODE_REGISTRY).forEach(([key, definition]) => {
        // Code matches key
        expect(definition.code).toBe(key);

        // Has required string fields
        expect(typeof definition.code).toBe("string");
        expect(definition.code).not.toBe("");
        expect(typeof definition.meaning).toBe("string");
        expect(definition.meaning).not.toBe("");
        expect(typeof definition.clientHandling).toBe("string");
        expect(definition.clientHandling).not.toBe("");
        expect(typeof definition.description).toBe("string");
        expect(definition.description).not.toBe("");

        // Has valid status code
        expect(typeof definition.statusCode).toBe("number");
        expect(definition.statusCode).toBeGreaterThanOrEqual(400);
        expect(definition.statusCode).toBeLessThan(600);

        // Has retriable flag
        expect(typeof definition.retriable).toBe("boolean");
      });
    });

    it("should have meaningful descriptions for each code", () => {
      Object.entries(ERROR_CODE_REGISTRY).forEach(([key, definition]) => {
        // Description should be substantial (at least 20 characters)
        expect(definition.description.length).toBeGreaterThan(20);

        // Client handling should be actionable (at least 30 characters)
        expect(definition.clientHandling.length).toBeGreaterThan(30);
      });
    });
  });

  describe("HTTP Status Code Mapping", () => {
    it("should map 400 codes correctly", () => {
      const fourHundredCodes = Object.values(ERROR_CODE_REGISTRY).filter(
        (def) => def.statusCode === 400,
      );

      expect(fourHundredCodes).toContainEqual(
        expect.objectContaining({ code: "BAD_REQUEST", statusCode: 400 }),
      );
      expect(fourHundredCodes).toContainEqual(
        expect.objectContaining({ code: "VALIDATION_ERROR", statusCode: 400 }),
      );
    });

    it("should map 401 codes correctly", () => {
      const fourOhOneCodes = Object.values(ERROR_CODE_REGISTRY).filter(
        (def) => def.statusCode === 401,
      );

      expect(fourOhOneCodes).toContainEqual(
        expect.objectContaining({ code: "UNAUTHORIZED", statusCode: 401 }),
      );
    });

    it("should map 403 codes correctly", () => {
      const fourOhThreeCodes = Object.values(ERROR_CODE_REGISTRY).filter(
        (def) => def.statusCode === 403,
      );

      expect(fourOhThreeCodes).toContainEqual(
        expect.objectContaining({ code: "FORBIDDEN", statusCode: 403 }),
      );
    });

    it("should map 404 codes correctly", () => {
      const fourOhFourCodes = Object.values(ERROR_CODE_REGISTRY).filter(
        (def) => def.statusCode === 404,
      );

      expect(fourOhFourCodes).toContainEqual(
        expect.objectContaining({ code: "NOT_FOUND", statusCode: 404 }),
      );
    });

    it("should map 409 codes correctly", () => {
      const fourOhNineCodes = Object.values(ERROR_CODE_REGISTRY).filter(
        (def) => def.statusCode === 409,
      );

      expect(fourOhNineCodes).toContainEqual(
        expect.objectContaining({ code: "CONFLICT", statusCode: 409 }),
      );
    });

    it("should map 429 codes correctly", () => {
      const fourTwentySwitchNineCodes = Object.values(
        ERROR_CODE_REGISTRY,
      ).filter((def) => def.statusCode === 429);

      expect(fourTwentySwitchNineCodes).toContainEqual(
        expect.objectContaining({ code: "TOO_MANY_REQUESTS", statusCode: 429 }),
      );
    });

    it("should map 5xx codes correctly", () => {
      const fiveHundredCodes = Object.values(ERROR_CODE_REGISTRY).filter(
        (def) => def.statusCode >= 500,
      );

      expect(fiveHundredCodes.length).toBeGreaterThan(0);
      expect(fiveHundredCodes).toContainEqual(
        expect.objectContaining({ code: "INTERNAL_ERROR", statusCode: 500 }),
      );
    });
  });

  describe("Retriable Status", () => {
    it("should mark 4xx errors as non-retriable by default", () => {
      const fourHundredCodes = Object.values(ERROR_CODE_REGISTRY).filter(
        (def) => def.statusCode >= 400 && def.statusCode < 500,
      );

      // Most 4xx should not be retriable (except specific cases)
      const nonRetriable = fourHundredCodes.filter((def) => !def.retriable);
      expect(nonRetriable.length).toBeGreaterThan(0);
    });

    it('should mark most 5xx errors as retriable', () => {
      const fiveHundredCodes = Object.values(ERROR_CODE_REGISTRY).filter(
        (def) => def.statusCode >= 500 && def.statusCode < 600
      );

      // Most 5xx should be retriable (except those that clearly fail and won't recover)
      const retriableCodes = fiveHundredCodes.filter((def) => def.retriable);
      expect(retriableCodes.length).toBeGreaterThan(0);
    });

    it("should mark UNAUTHORIZED as retriable (token refresh case)", () => {
      expect(ERROR_CODE_REGISTRY.UNAUTHORIZED.retriable).toBe(true);
    });

    it("should mark CONFLICT as retriable (state refresh case)", () => {
      expect(ERROR_CODE_REGISTRY.CONFLICT.retriable).toBe(true);
    });

    it("should mark BAD_REQUEST as non-retriable", () => {
      expect(ERROR_CODE_REGISTRY.BAD_REQUEST.retriable).toBe(false);
    });

    it("should mark VALIDATION_ERROR as non-retriable", () => {
      expect(ERROR_CODE_REGISTRY.VALIDATION_ERROR.retriable).toBe(false);
    });

    it("should mark BLOCKCHAIN_CALL_FAILED as non-retriable", () => {
      expect(ERROR_CODE_REGISTRY.BLOCKCHAIN_CALL_FAILED.retriable).toBe(false);
    });
  });

  describe("validateErrorCodeRegistry()", () => {
    it("should return valid=true when registry is clean", () => {
      const validation = validateErrorCodeRegistry();
      expect(validation.valid).toBe(true);
    });

    it("should report no duplicates", () => {
      const validation = validateErrorCodeRegistry();
      expect(validation.duplicates).toHaveLength(0);
    });

    it("should report no errors", () => {
      const validation = validateErrorCodeRegistry();
      expect(validation.errors).toHaveLength(0);
    });

    it("should validate structure in detail", () => {
      const validation = validateErrorCodeRegistry();

      // Ensure the validation checks for all required fields
      expect(
        validation.errors.filter((e) => e.includes("'code'")),
      ).toHaveLength(0);
      expect(
        validation.errors.filter((e) => e.includes("'meaning'")),
      ).toHaveLength(0);
      expect(
        validation.errors.filter((e) => e.includes("'clientHandling'")),
      ).toHaveLength(0);
      expect(
        validation.errors.filter((e) => e.includes("'description'")),
      ).toHaveLength(0);
    });
  });

  describe("getErrorCodesByStatus()", () => {
    it("should group codes by HTTP status", () => {
      const grouped = getErrorCodesByStatus();

      expect(grouped[400]).toBeDefined();
      expect(grouped[401]).toBeDefined();
      expect(grouped[403]).toBeDefined();
      expect(grouped[404]).toBeDefined();
      expect(grouped[409]).toBeDefined();
      expect(grouped[429]).toBeDefined();
      expect(grouped[500]).toBeDefined();
    });

    it("should group 400 codes together", () => {
      const grouped = getErrorCodesByStatus();
      const fourHundredCodes = grouped[400];

      expect(fourHundredCodes).toContainEqual(
        expect.objectContaining({ code: "BAD_REQUEST" }),
      );
      expect(fourHundredCodes).toContainEqual(
        expect.objectContaining({ code: "VALIDATION_ERROR" }),
      );
    });

    it("should have correct count of 5xx codes", () => {
      const grouped = getErrorCodesByStatus();
      const allFiveHundredCodes = [
        ...(grouped[500] || []),
        ...(grouped[502] || []),
        ...(grouped[503] || []),
        ...(grouped[504] || []),
      ];

      expect(allFiveHundredCodes.length).toBeGreaterThan(0);
    });
  });

  describe("getErrorCodeDefinition()", () => {
    it("should return definition for valid code", () => {
      const definition = getErrorCodeDefinition("VALIDATION_ERROR");
      expect(definition.code).toBe("VALIDATION_ERROR");
      expect(definition.statusCode).toBe(400);
      expect(definition.meaning).toBeDefined();
    });

    it("should throw for unregistered code", () => {
      expect(() => {
        getErrorCodeDefinition("NONEXISTENT_ERROR");
      }).toThrow(/Unregistered error code/);
    });

    it("should throw with helpful message", () => {
      expect(() => {
        getErrorCodeDefinition("MADE_UP_CODE");
      }).toThrow(/All error codes must be defined in ERROR_CODE_REGISTRY/);
    });
  });

  describe("Cross-Registry Consistency", () => {
    it("should have entries for all error classes", () => {
      const expectedCodes = [
        "BAD_REQUEST",
        "VALIDATION_ERROR",
        "UNAUTHORIZED",
        "FORBIDDEN",
        "NOT_FOUND",
        "CONFLICT",
        "TOO_MANY_REQUESTS",
        "INTERNAL_ERROR",
      ];

      expectedCodes.forEach((code) => {
        expect(ERROR_CODE_REGISTRY[code]).toBeDefined(
          `Missing registry entry for error class: ${code}`,
        );
      });
    });

    it("should have consistent code format (UPPER_SNAKE_CASE)", () => {
      Object.keys(ERROR_CODE_REGISTRY).forEach((code) => {
        expect(code).toMatch(/^[A-Z_]+$/);
        expect(code).not.toMatch(/\s/); // No whitespace
      });
    });
  });

  describe("Documentation Completeness", () => {
    it("should have meaningful meanings for all codes", () => {
      Object.entries(ERROR_CODE_REGISTRY).forEach(([code, def]) => {
        expect(def.meaning.length).toBeGreaterThan(10);
        expect(def.meaning).not.toMatch(/^[a-z]/); // Should start with capital letter
      });
    });

    it("should have actionable client handling guidance", () => {
      Object.entries(ERROR_CODE_REGISTRY).forEach(([code, def]) => {
        // Should include verbs or actionable words
        const actionableWords = [
          "display",
          "redirect",
          "implement",
          "retry",
          "refresh",
          "do not",
          "offer",
          "log",
          "check",
          "fetch",
          "prompt",
          "show",
          "respect",
        ];

        const hasAction = actionableWords.some((word) =>
          def.clientHandling.toLowerCase().includes(word),
        );

        expect(hasAction).toBe(
          true,
          `${code} client handling should be actionable: ${def.clientHandling}`,
        );
      });
    });

    it("should have description that starts with trigger condition", () => {
      Object.entries(ERROR_CODE_REGISTRY).forEach(([code, def]) => {
        expect(def.description.toLowerCase()).toMatch(
          /triggered|thrown|returned/,
        );
      });
    });
  });

  describe("Common Error Code Scenarios", () => {
    it("should have proper configuration for form validation errors", () => {
      const def = getErrorCodeDefinition("VALIDATION_ERROR");
      expect(def.statusCode).toBe(400);
      expect(def.retriable).toBe(false);
      expect(def.clientHandling).toContain("validation");
    });

    it("should have proper configuration for authentication errors", () => {
      const def = getErrorCodeDefinition("UNAUTHORIZED");
      expect(def.statusCode).toBe(401);
      expect(def.retriable).toBe(true);
      expect(def.clientHandling.toLowerCase()).toMatch(/token|login|redirect/);
    });

    it("should have proper configuration for rate limit errors", () => {
      const def = getErrorCodeDefinition("TOO_MANY_REQUESTS");
      expect(def.statusCode).toBe(429);
      expect(def.retriable).toBe(true);
      expect(def.clientHandling.toLowerCase()).toMatch(/backoff|retry/);
    });

    it("should have proper configuration for not found errors", () => {
      const def = getErrorCodeDefinition("NOT_FOUND");
      expect(def.statusCode).toBe(404);
      expect(def.retriable).toBe(false);
      expect(def.clientHandling.toLowerCase()).toContain('do not retry');
    });

    it("should have proper configuration for conflict errors", () => {
      const def = getErrorCodeDefinition("CONFLICT");
      expect(def.statusCode).toBe(409);
      expect(def.retriable).toBe(true);
      expect(def.clientHandling.toLowerCase()).toMatch(/refresh|retry/);
    });
  });
});
