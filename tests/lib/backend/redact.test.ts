import { afterEach, describe, expect, it } from "vitest";
import {
  addToDenylist,
  createRedacted,
  isSensitiveField,
  redact,
  removeFromDenylist,
} from "@/lib/backend/redact";

const DEFAULT_DENYLIST_KEYS = [
  "signature",
  "token",
  "nonce",
  "authorization",
  "password",
  "secret",
  "key",
  "privateKey",
  "publicKey",
  "mnemonic",
  "seed",
  "hash",
  "digest",
  "auth",
  "bearer",
  "apikey",
  "api_key",
  "session",
  "cookie",
  "csrf",
  "xss",
  "sql",
] as const;

describe("redact", () => {
  it.each(DEFAULT_DENYLIST_KEYS)("redacts the default denylist key %s", (key) => {
    expect(redact({ [key]: "sensitive" })).toEqual({ [key]: "[REDACTED]" });
  });

  it("matches denylisted keys case-insensitively by default", () => {
    expect(redact({ TOKEN: "one", PrivateKey: "two", Api_Key: "three" })).toEqual({
      TOKEN: "[REDACTED]",
      PrivateKey: "[REDACTED]",
      Api_Key: "[REDACTED]",
    });
  });

  it("honors case-sensitive matching when requested", () => {
    expect(
      redact(
        { token: "redact", TOKEN: "preserve" },
        { caseInsensitive: false },
      ),
    ).toEqual({ token: "[REDACTED]", TOKEN: "preserve" });
  });

  it("traverses nested objects and arrays", () => {
    const input = {
      id: "commitment-1",
      metadata: {
        token: "nested-token",
        participants: [
          { name: "Alice", password: "first-password" },
          { name: "Bob", profile: { mnemonic: "second-mnemonic" } },
        ],
      },
    };

    expect(redact(input)).toEqual({
      id: "commitment-1",
      metadata: {
        token: "[REDACTED]",
        participants: [
          { name: "Alice", password: "[REDACTED]" },
          { name: "Bob", profile: { mnemonic: "[REDACTED]" } },
        ],
      },
    });
  });

  it("preserves non-sensitive fields without mutating the input", () => {
    const input = {
      name: "Alice",
      nested: { enabled: true, token: "secret-token" },
      values: [1, null, "safe"],
    };
    const original = structuredClone(input);

    const result = redact(input);

    expect(result).toEqual({
      name: "Alice",
      nested: { enabled: true, token: "[REDACTED]" },
      values: [1, null, "safe"],
    });
    expect(input).toEqual(original);
    expect(result).not.toBe(input);
    expect(result.nested).not.toBe(input.nested);
    expect(result.values).not.toBe(input.values);
  });

  it("preserves null, undefined, and primitive values", () => {
    expect(redact(null)).toBeNull();
    expect(redact(undefined)).toBeUndefined();
    expect(redact("safe")).toBe("safe");
    expect(redact(42)).toBe(42);
    expect(redact(false)).toBe(false);
  });

  it("preserves Date instances", () => {
    const date = new Date("2026-06-27T00:00:00.000Z");

    expect(redact(date)).toBe(date);
  });

  it("copies Error instances while preserving their diagnostic fields", () => {
    const error = new TypeError("request failed");
    error.stack = "test stack";

    const result = redact(error);

    expect(result).toBeInstanceOf(Error);
    expect(result).not.toBe(error);
    expect(result.name).toBe("TypeError");
    expect(result.message).toBe("request failed");
    expect(result.stack).toBe("test stack");
  });

  it("supports custom denylist entries and replacement text", () => {
    expect(
      redact(
        { accountId: "GABC", label: "public" },
        { denylist: ["accountId"], replacement: "***" },
      ),
    ).toEqual({ accountId: "***", label: "public" });
  });
});

describe("redaction helpers", () => {
  const runtimeField = "temporaryCredential";

  afterEach(() => {
    removeFromDenylist(runtimeField);
  });

  it("creates a redacted object with caller-provided sensitive fields", () => {
    expect(
      createRedacted(
        { email: "alice@example.com", displayName: "Alice" },
        ["email"],
      ),
    ).toEqual({ email: "[REDACTED]", displayName: "Alice" });
  });

  it("identifies default sensitive fields case-insensitively", () => {
    expect(isSensitiveField("TOKEN")).toBe(true);
    expect(isSensitiveField("privateKey")).toBe(true);
    expect(isSensitiveField("PublicKey")).toBe(true);
    expect(isSensitiveField("displayName")).toBe(false);
  });

  it("adds and removes runtime denylist fields case-insensitively", () => {
    addToDenylist(runtimeField);

    expect(isSensitiveField("TEMPORARYCREDENTIAL")).toBe(true);
    expect(redact({ TemporaryCredential: "sensitive" })).toEqual({
      TemporaryCredential: "[REDACTED]",
    });

    removeFromDenylist(runtimeField.toUpperCase());

    expect(isSensitiveField(runtimeField)).toBe(false);
    expect(redact({ TemporaryCredential: "safe" })).toEqual({
      TemporaryCredential: "safe",
    });
  });
});
