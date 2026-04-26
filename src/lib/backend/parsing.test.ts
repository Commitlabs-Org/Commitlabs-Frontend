import { describe, it, expect } from "vitest";
import {
  parseDecimalString,
  parseBps,
  bpsToPercent,
  percentToBps,
  parsePositiveInt,
  parseAmount,
  parseAmountWithMin,
  parseAmountWithBounds,
} from "./parsing";
import { BadRequestError } from "./errors";

describe("parseDecimalString", () => {
  describe("valid inputs", () => {
    it("parses integer strings", () => {
      expect(parseDecimalString("123")).toBe(123);
      expect(parseDecimalString("0")).toBe(0);
      expect(parseDecimalString("-456", { allowNegative: true })).toBe(-456);
    });

    it("parses decimal strings", () => {
      expect(parseDecimalString("123.45")).toBe(123.45);
      expect(parseDecimalString("0.99")).toBe(0.99);
      expect(parseDecimalString("-123.45", { allowNegative: true })).toBe(-123.45);
    });

    it("parses numbers directly", () => {
      expect(parseDecimalString(123)).toBe(123);
      expect(parseDecimalString(0.99)).toBe(0.99);
      expect(parseDecimalString(-123.45, { allowNegative: true })).toBe(-123.45);
    });

    it("parses strings with leading/trailing whitespace", () => {
      expect(parseDecimalString("  123.45  ")).toBe(123.45);
    });

    it("handles very small decimals", () => {
      expect(parseDecimalString("0.0000001")).toBe(0.0000001);
    });

    it("respects scale option", () => {
      expect(parseDecimalString("123.456789", { scale: 2 })).toBe(123.46);
      expect(parseDecimalString("123.454", { scale: 2 })).toBe(123.45);
    });
  });

  describe("invalid inputs", () => {
    it("rejects null and undefined", () => {
      expect(() => parseDecimalString(null)).toThrow(BadRequestError);
      expect(() => parseDecimalString(undefined)).toThrow(BadRequestError);
    });

    it("rejects empty strings", () => {
      expect(() => parseDecimalString("")).toThrow(BadRequestError);
      expect(() => parseDecimalString("   ")).toThrow(BadRequestError);
    });

    it("rejects non-string/non-number types", () => {
      expect(() => parseDecimalString(true)).toThrow(BadRequestError);
      expect(() => parseDecimalString([])).toThrow(BadRequestError);
      expect(() => parseDecimalString({})).toThrow(BadRequestError);
    });

    it("rejects invalid formats", () => {
      expect(() => parseDecimalString("abc")).toThrow(BadRequestError);
      expect(() => parseDecimalString("12.34.56")).toThrow(BadRequestError);
      expect(() => parseDecimalString("12abc")).toThrow(BadRequestError);
      expect(() => parseDecimalString("1,234")).toThrow(BadRequestError);
      expect(() => parseDecimalString("$100")).toThrow(BadRequestError);
    });

    it("rejects too many decimal places", () => {
      expect(() =>
        parseDecimalString("123.12345678"),
      ).toThrow(BadRequestError);
    });

    it("rejects Infinity and NaN", () => {
      expect(() => parseDecimalString(Infinity)).toThrow(BadRequestError);
      expect(() => parseDecimalString(NaN)).toThrow(BadRequestError);
    });
  });

  describe("bounds validation", () => {
    it("respects min option", () => {
      expect(parseDecimalString("10", { min: 5 })).toBe(10);
      expect(() => parseDecimalString("3", { min: 5 })).toThrow(BadRequestError);
    });

    it("respects max option", () => {
      expect(parseDecimalString("10", { max: 100 })).toBe(10);
      expect(() =>
        parseDecimalString("150", { max: 100 }),
      ).toThrow(BadRequestError);
    });

    it("respects min and max together", () => {
      expect(parseDecimalString("50", { min: 0, max: 100 })).toBe(50);
      expect(() =>
        parseDecimalString("-10", { min: 0, max: 100 }),
      ).toThrow(BadRequestError);
    });

    it("respects allowNegative option", () => {
      expect(parseDecimalString("-10", { allowNegative: true })).toBe(-10);
      expect(() =>
        parseDecimalString("-10", { allowNegative: false }),
      ).toThrow(BadRequestError);
    });

    it("defaults to not allowing negative", () => {
      expect(() => parseDecimalString("-10")).toThrow(BadRequestError);
    });
  });

  describe("boundary limits", () => {
    it("handles MAX_SAFE_INTEGER", () => {
      const maxSafe = Number.MAX_SAFE_INTEGER;
      expect(parseDecimalString(String(maxSafe))).toBe(maxSafe);
    });

    it("handles values near MAX_SAFE_INTEGER", () => {
      const maxSafe = Number.MAX_SAFE_INTEGER;
      expect(parseDecimalString(String(maxSafe - 1))).toBe(maxSafe - 1);
    });
  });
});

describe("parseBps", () => {
  describe("valid inputs", () => {
    it("parses valid bps values", () => {
      expect(parseBps(0)).toBe(0);
      expect(parseBps("100")).toBe(100);
      expect(parseBps(10000)).toBe(10000);
      expect(parseBps("5000")).toBe(5000);
    });

    it("accepts decimal strings that resolve to valid integers", () => {
      expect(parseBps("100.00")).toBe(100);
      expect(parseBps("100.50")).toBe(100.5);
    });
  });

  describe("invalid inputs", () => {
    it("rejects bps below minimum", () => {
      expect(() => parseBps(-1)).toThrow(BadRequestError);
      expect(() => parseBps(0, { allowZero: false })).toThrow(BadRequestError);
    });

    it("rejects bps above maximum", () => {
      expect(() => parseBps(10001)).toThrow(BadRequestError);
      expect(() => parseBps("99999")).toThrow(BadRequestError);
    });

    it("rejects invalid formats", () => {
      expect(() => parseBps("abc")).toThrow(BadRequestError);
      expect(() => parseBps("")).toThrow(BadRequestError);
    });
  });

  describe("options", () => {
    it("respects custom min option", () => {
      expect(parseBps(500, { min: 100 })).toBe(500);
      expect(() =>
        parseBps(50, { min: 100 }),
      ).toThrow(BadRequestError);
    });

    it("respects custom max option", () => {
      expect(parseBps(5000, { max: 10000 })).toBe(5000);
      expect(() =>
        parseBps(15000, { max: 10000 }),
      ).toThrow(BadRequestError);
    });

    it("allows zero when specified", () => {
      expect(parseBps(0, { allowZero: true })).toBe(0);
    });
  });
});

describe("bpsToPercent", () => {
  it("converts bps to percent", () => {
    expect(bpsToPercent(0)).toBe(0);
    expect(bpsToPercent(100)).toBe(1);
    expect(bpsToPercent(1000)).toBe(10);
    expect(bpsToPercent(10000)).toBe(100);
  });

  it("handles fractional percentages", () => {
    expect(bpsToPercent(50)).toBe(0.5);
    expect(bpsToPercent(250)).toBe(2.5);
  });

  it("rejects non-finite values", () => {
    expect(() => bpsToPercent(Infinity)).toThrow(BadRequestError);
    expect(() => bpsToPercent(NaN)).toThrow(BadRequestError);
  });
});

describe("percentToBps", () => {
  it("converts percent to bps", () => {
    expect(percentToBps(0)).toBe(0);
    expect(percentToBps(1)).toBe(100);
    expect(percentToBps(10)).toBe(1000);
    expect(percentToBps(100)).toBe(10000);
  });

  it("handles fractional percentages", () => {
    expect(percentToBps(0.5)).toBe(50);
    expect(percentToBps(2.5)).toBe(250);
  });

  it("rejects non-finite values", () => {
    expect(() => percentToBps(Infinity)).toThrow(BadRequestError);
    expect(() => percentToBps(NaN)).toThrow(BadRequestError);
  });
});

describe("parsePositiveInt", () => {
  describe("valid inputs", () => {
    it("parses valid positive integers", () => {
      expect(parsePositiveInt(1)).toBe(1);
      expect(parsePositiveInt("42")).toBe(42);
      expect(parsePositiveInt(999)).toBe(999);
    });

    it("parses strings with whitespace", () => {
      expect(parsePositiveInt("  42  ")).toBe(42);
    });
  });

  describe("invalid inputs", () => {
    it("rejects null and undefined", () => {
      expect(() => parsePositiveInt(null)).toThrow(BadRequestError);
      expect(() => parsePositiveInt(undefined)).toThrow(BadRequestError);
    });

    it("rejects zero", () => {
      expect(() => parsePositiveInt(0)).toThrow(BadRequestError);
      expect(() => parsePositiveInt("0")).toThrow(BadRequestError);
    });

    it("rejects negative numbers", () => {
      expect(() => parsePositiveInt(-1)).toThrow(BadRequestError);
      expect(() => parsePositiveInt("-5")).toThrow(BadRequestError);
    });

    it("rejects non-integer numbers", () => {
      expect(() => parsePositiveInt(1.5)).toThrow(BadRequestError);
      expect(() => parsePositiveInt(0.1)).toThrow(BadRequestError);
    });

    it("rejects non-integer strings", () => {
      expect(() => parsePositiveInt("1.5")).toThrow(BadRequestError);
      expect(() => parsePositiveInt("abc")).toThrow(BadRequestError);
    });

    it("rejects empty strings", () => {
      expect(() => parsePositiveInt("")).toThrow(BadRequestError);
      expect(() => parsePositiveInt("   ")).toThrow(BadRequestError);
    });

    it("rejects non-finite numbers", () => {
      expect(() => parsePositiveInt(Infinity)).toThrow(BadRequestError);
      expect(() => parsePositiveInt(-Infinity)).toThrow(BadRequestError);
    });

    it("rejects unsafe integers", () => {
      const unsafe = Number.MAX_SAFE_INTEGER + 1;
      expect(() => parsePositiveInt(unsafe)).toThrow(BadRequestError);
      expect(() =>
        parsePositiveInt(String(unsafe)),
      ).toThrow(BadRequestError);
    });

    it("rejects non-string/non-number types", () => {
      expect(() => parsePositiveInt(true)).toThrow(BadRequestError);
      expect(() => parsePositiveInt([])).toThrow(BadRequestError);
    });
  });

  describe("options", () => {
    it("respects max option", () => {
      expect(parsePositiveInt(50, { max: 100 })).toBe(50);
      expect(() =>
        parsePositiveInt(150, { max: 100 }),
      ).toThrow(BadRequestError);
    });

    it("respects boundary max", () => {
      expect(parsePositiveInt(100, { max: 100 })).toBe(100);
    });
  });
});

describe("parseAmount", () => {
  it("parses valid amounts", () => {
    expect(parseAmount("100")).toBe(100);
    expect(parseAmount("100.50")).toBe(100.5);
    expect(parseAmount(50)).toBe(50);
  });

  it("allows zero", () => {
    expect(parseAmount("0")).toBe(0);
    expect(parseAmount(0)).toBe(0);
  });

  it("rejects negative amounts", () => {
    expect(() => parseAmount("-100")).toThrow(BadRequestError);
  });
});

describe("parseAmountWithMin", () => {
  it("parses amounts with minimum", () => {
    expect(parseAmountWithMin("100", 50)).toBe(100);
  });

  it("rejects amounts below minimum", () => {
    expect(() => parseAmountWithMin("10", 50)).toThrow(BadRequestError);
  });
});

describe("parseAmountWithBounds", () => {
  it("parses amounts within bounds", () => {
    expect(parseAmountWithBounds("100", 50, 200)).toBe(100);
  });

  it("rejects amounts below minimum", () => {
    expect(() => parseAmountWithBounds("10", 50, 200)).toThrow(BadRequestError);
  });

  it("rejects amounts above maximum", () => {
    expect(() => parseAmountWithBounds("300", 50, 200)).toThrow(BadRequestError);
  });
});

describe("huge values", () => {
  it("handles very large strings via BigInt parsing", () => {
    const hugeValue = "999999999999999999999.99";
    const result = parseDecimalString(hugeValue);
    expect(result).toBeCloseTo(1e21, 2);
  });

  it("rejects exponential notation", () => {
    expect(() => parseDecimalString("1e10")).toThrow(BadRequestError);
  });
});

describe("edge cases", () => {
  it("handles trailing zeros in decimals", () => {
    expect(parseDecimalString("100.00")).toBe(100);
    expect(parseDecimalString("0.10")).toBe(0.1);
  });

  it("handles just decimal point", () => {
    expect(() => parseDecimalString(".")).toThrow(BadRequestError);
  });

  it("handles negative with just minus", () => {
    expect(() => parseDecimalString("-")).toThrow(BadRequestError);
  });
});