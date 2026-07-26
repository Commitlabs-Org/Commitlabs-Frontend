import { BadRequestError } from "./errors";

const MAX_SAFE_INTEGER = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_SAFE_INTEGER = BigInt(-Number.MAX_SAFE_INTEGER);

export interface ParseDecimalOptions {
  min?: number;
  max?: number;
  allowNegative?: boolean;
  scale?: number;
}

export function parseDecimalString(
  value: unknown,
  options: ParseDecimalOptions = {},
): number {
  if (value === null || value === undefined) {
    throw new BadRequestError("Value is required");
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return applyBounds(value, options);
  }

  if (typeof value !== "string") {
    throw new BadRequestError("Value must be a string or number");
  }

  const trimmed = value.trim();

  if (trimmed === "") {
    throw new BadRequestError("Value cannot be empty");
  }

  const decimalRegex = /^-?\d+(\.\d+)?$/;
  if (!decimalRegex.test(trimmed)) {
    throw new BadRequestError(
      "Invalid decimal format. Expected a numeric string.",
    );
  }

  if (trimmed.includes(".")) {
    const decimals = trimmed.split(".")[1]!.length;
    if (decimals > 7) {
      throw new BadRequestError(
        "Value has too many decimal places. Maximum 7 allowed.",
      );
    }
  }

  const bigNum = BigInt(trimmed.replace(".", ""));
  const decimals = trimmed.includes(".")
    ? trimmed.split(".")[1]!.length
    : 0;
  const divisor = BigInt(10 ** decimals);
  const isNegative = trimmed.startsWith("-");

  let result: number;
  if (bigNum > MAX_SAFE_INTEGER || bigNum < MIN_SAFE_INTEGER) {
    result = parseFloat(trimmed);
  } else {
    const integerPart = bigNum < 0 ? -bigNum : bigNum;
    const divided = integerPart / divisor;
    const remainder = integerPart % divisor;
    const decimalStr = `${divided}.${remainder
      .toString()
      .padStart(decimals, "0")
      .replace(/0+$/, "")}`;
    result = parseFloat(`${isNegative ? "-" : ""}${decimalStr || "0"}`);
  }

  if (Number.isNaN(result) || !Number.isFinite(result)) {
    throw new BadRequestError("Value is not a valid number");
  }

  if (!options.allowNegative && result < 0) {
    throw new BadRequestError("Value cannot be negative");
  }

  if (options.scale !== undefined) {
    const factor = 10 ** options.scale;
    const scaled = Math.round(result * factor);
    result = scaled / factor;
  }

  return applyBounds(result, options);
}

function applyBounds(value: number, options: ParseDecimalOptions): number {
  if (options.min !== undefined && value < options.min) {
    throw new BadRequestError(
      `Value must be at least ${options.min}`,
    );
  }
  if (options.max !== undefined && value > options.max) {
    throw new BadRequestError(
      `Value must be at most ${options.max}`,
    );
  }
  return value;
}

export interface ParseBpsOptions {
  min?: number;
  max?: number;
  allowZero?: boolean;
}

export function parseBps(value: unknown, options: ParseBpsOptions = {}): number {
  const parsed = parseDecimalString(value, {
    min: options.allowZero !== false ? 0 : 1,
    max: 10000,
    allowNegative: false,
  });

  if (options.min !== undefined && parsed < options.min) {
    throw new BadRequestError(`bps value must be at least ${options.min}`);
  }
  if (options.max !== undefined && parsed > options.max) {
    throw new BadRequestError(`bps value must be at most ${options.max}`);
  }

  return parsed;
}

export function bpsToPercent(bps: number): number {
  if (!Number.isFinite(bps)) {
    throw new BadRequestError("bps must be a finite number");
  }
  return Math.round((bps / 100) * 10000) / 10000;
}

export function percentToBps(percent: number): number {
  if (!Number.isFinite(percent)) {
    throw new BadRequestError("percent must be a finite number");
  }
  return Math.round(percent * 100);
}

export interface ParsePositiveIntOptions {
  max?: number;
}

export function parsePositiveInt(
  value: unknown,
  options: ParsePositiveIntOptions = {},
): number {
  if (value === null || value === undefined) {
    throw new BadRequestError("Value is required");
  }

  let strValue: string;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new BadRequestError("Value must be a finite number");
    }
    if (!Number.isInteger(value)) {
      throw new BadRequestError("Value must be an integer");
    }
    strValue = String(value);
  } else if (typeof value === "string") {
    strValue = value.trim();
    if (strValue === "") {
      throw new BadRequestError("Value cannot be empty");
    }
  } else {
    throw new BadRequestError("Value must be a string or number");
  }

  const integerRegex = /^-?\d+$/;
  if (!integerRegex.test(strValue)) {
    throw new BadRequestError("Value must be a valid integer string");
  }

  const num = parseInt(strValue, 10);

  if (num <= 0) {
    throw new BadRequestError("Value must be a positive integer");
  }

  if (!Number.isSafeInteger(num)) {
    throw new BadRequestError("Value is too large to be safely processed");
  }

  if (options.max !== undefined && num > options.max) {
    throw new BadRequestError(`Value must be at most ${options.max}`);
  }

  return num;
}

export function parseAmount(value: unknown): number {
  return parseDecimalString(value, {
    min: 0,
    allowNegative: false,
  });
}

export function parseAmountWithMin(value: unknown, min: number): number {
  return parseDecimalString(value, {
    min,
    allowNegative: false,
  });
}

export function parseAmountWithBounds(
  value: unknown,
  min: number,
  max: number,
): number {
  return parseDecimalString(value, {
    min,
    max,
    allowNegative: false,
  });
}