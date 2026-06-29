import { describe, it, expect, vi, afterEach } from "vitest";
import {
  mapCommitmentFromChain,
  mapAttestationFromChain,
  CommitmentTypeDto,
  CommitmentStatusDto,
  AttestationVerdictDto,
  ChainCommitmentModel,
  ChainAttestationModel,
} from "@/lib/backend/dto";

afterEach(() => {
  vi.restoreAllMocks();
});

function commitmentModel(
  overrides: Partial<ChainCommitmentModel> = {},
): ChainCommitmentModel {
  return {
    id: "cmt-001",
    ownerAddress: "GBVFTZL5HIPT4PFQVTZVIWR77V7LWYCXU4CLYWWHHOEXB64XPG5LDMTU",
    amount: "1000",
    assetCode: "XLM",
    assetIssuer: null,
    durationDays: 30,
    maxLossPercent: 10,
    commitmentType: "Safe",
    status: "Active",
    nftTokenId: null,
    ...overrides,
  };
}

function attestationModel(
  overrides: Partial<ChainAttestationModel> = {},
): ChainAttestationModel {
  return {
    id: "att-001",
    commitmentId: "cmt-001",
    ownerAddress: "GBVFTZL5HIPT4PFQVTZVIWR77V7LWYCXU4CLYWWHHOEXB64XPG5LDMTU",
    kind: "compliance",
    verdict: "pass",
    observedAt: "2025-06-01T12:00:00.000Z",
    details: { score: 95 },
    ...overrides,
  };
}

describe("mapCommitmentFromChain", () => {
  describe("type coercion", () => {
    it("coerces string id to string", () => {
      const result = mapCommitmentFromChain(commitmentModel({ id: "42" }));
      expect(result.commitmentId).toBe("42");
    });

    it("coerces number id to string", () => {
      const result = mapCommitmentFromChain(commitmentModel({ id: 42 }));
      expect(result.commitmentId).toBe("42");
    });

    it("coerces string amount to string", () => {
      const result = mapCommitmentFromChain(commitmentModel({ amount: "5000" }));
      expect(result.amount).toBe("5000");
    });

    it("coerces number amount to string", () => {
      const result = mapCommitmentFromChain(commitmentModel({ amount: 5000 }));
      expect(result.amount).toBe("5000");
    });

    it("coerces string durationDays to number", () => {
      const result = mapCommitmentFromChain(commitmentModel({ durationDays: "90" }));
      expect(result.durationDays).toBe(90);
    });

    it("coerces number durationDays to number", () => {
      const result = mapCommitmentFromChain(commitmentModel({ durationDays: 90 }));
      expect(result.durationDays).toBe(90);
    });

    it("coerces string maxLossPercent to number", () => {
      const result = mapCommitmentFromChain(commitmentModel({ maxLossPercent: "15" }));
      expect(result.maxLossPercent).toBe(15);
    });

    it("coerces number maxLossPercent to number", () => {
      const result = mapCommitmentFromChain(commitmentModel({ maxLossPercent: 15 }));
      expect(result.maxLossPercent).toBe(15);
    });

    it("coerces fractional maxLossPercent string to number", () => {
      const result = mapCommitmentFromChain(commitmentModel({ maxLossPercent: "12.5" }));
      expect(result.maxLossPercent).toBe(12.5);
    });

    it("coerces fractional maxLossPercent number to number", () => {
      const result = mapCommitmentFromChain(commitmentModel({ maxLossPercent: 12.5 }));
      expect(result.maxLossPercent).toBe(12.5);
    });
  });

  describe("null / undefined handling", () => {
    it("defaults assetCode to XLM when null", () => {
      const result = mapCommitmentFromChain(commitmentModel({ assetCode: null }));
      expect(result.assetCode).toBe("XLM");
    });

    it("defaults assetCode to XLM when undefined", () => {
      const result = mapCommitmentFromChain(commitmentModel({ assetCode: undefined }));
      expect(result.assetCode).toBe("XLM");
    });

    it("sets assetIssuer to null when assetCode is XLM", () => {
      const result = mapCommitmentFromChain(commitmentModel({ assetCode: "XLM", assetIssuer: "GB123..." }));
      expect(result.assetIssuer).toBeNull();
    });

    it("uses assetIssuer when assetCode is not XLM", () => {
      const result = mapCommitmentFromChain(commitmentModel({
        assetCode: "USDC",
        assetIssuer: "GB123...",
      }));
      expect(result.assetIssuer).toBe("GB123...");
    });

    it("sets assetIssuer to null when non-XLM asset has null issuer", () => {
      const result = mapCommitmentFromChain(commitmentModel({
        assetCode: "USDC",
        assetIssuer: null,
      }));
      expect(result.assetIssuer).toBeNull();
    });

    it("sets assetIssuer to null when non-XLM asset has undefined issuer", () => {
      const result = mapCommitmentFromChain(commitmentModel({
        assetCode: "USDC",
        assetIssuer: undefined,
      }));
      expect(result.assetIssuer).toBeNull();
    });

    it("sets nftTokenId to null when undefined", () => {
      const result = mapCommitmentFromChain(commitmentModel({ nftTokenId: undefined }));
      expect(result.nftTokenId).toBeNull();
    });

    it("sets nftTokenId to null when null", () => {
      const result = mapCommitmentFromChain(commitmentModel({ nftTokenId: null }));
      expect(result.nftTokenId).toBeNull();
    });

    it("coerces number nftTokenId to string", () => {
      const result = mapCommitmentFromChain(commitmentModel({ nftTokenId: 123 }));
      expect(result.nftTokenId).toBe("123");
    });

    it("coerces string nftTokenId to string", () => {
      const result = mapCommitmentFromChain(commitmentModel({ nftTokenId: "nft-abc" }));
      expect(result.nftTokenId).toBe("nft-abc");
    });

    it("defaults status to active when undefined", () => {
      const result = mapCommitmentFromChain(commitmentModel({ status: undefined }));
      expect(result.status).toBe("active");
    });
  });

  describe("CommitmentType mapping", () => {
    const cases: [string, CommitmentTypeDto][] = [
      ["Safe", "safe"],
      ["safe", "safe"],
      [" SAFE ", "safe"],
      ["Balanced", "balanced"],
      ["balanced", "balanced"],
      ["BALANCED", "balanced"],
      ["Aggressive", "aggressive"],
      ["aggressive", "aggressive"],
      ["AGGRESSIVE", "aggressive"],
    ];

    it.each(cases)("maps '%s' to '%s'", (input, expected) => {
      const result = mapCommitmentFromChain(commitmentModel({ commitmentType: input }));
      expect(result.commitmentType).toBe(expected);
    });

    it("falls back to 'balanced' for unknown commitment type", () => {
      const result = mapCommitmentFromChain(commitmentModel({ commitmentType: "Ultra" }));
      expect(result.commitmentType).toBe("balanced");
    });

    it("falls back to 'balanced' for empty commitment type", () => {
      const result = mapCommitmentFromChain(commitmentModel({ commitmentType: "" }));
      expect(result.commitmentType).toBe("balanced");
    });
  });

  describe("CommitmentStatus mapping", () => {
    const cases: [string, CommitmentStatusDto][] = [
      ["Active", "active"],
      ["active", "active"],
      [" ACTIVE ", "active"],
      ["Settled", "settled"],
      ["settled", "settled"],
      ["Violated", "violated"],
      ["violated", "violated"],
      ["Early Exit", "early_exit"],
      ["early_exit", "early_exit"],
      ["early-exit", "early_exit"],
      ["EARLY EXIT", "early_exit"],
    ];

    it.each(cases)("maps '%s' to '%s'", (input, expected) => {
      const result = mapCommitmentFromChain(commitmentModel({ status: input }));
      expect(result.status).toBe(expected);
    });

    it("falls back to 'active' for unknown status", () => {
      const result = mapCommitmentFromChain(commitmentModel({ status: "expired" }));
      expect(result.status).toBe("active");
    });

    it("falls back to 'active' for empty status", () => {
      const result = mapCommitmentFromChain(commitmentModel({ status: "" }));
      expect(result.status).toBe("active");
    });

    it("falls back to 'active' when status is undefined", () => {
      const result = mapCommitmentFromChain(commitmentModel({ status: undefined }));
      expect(result.status).toBe("active");
    });
  });

  describe("full output shape", () => {
    it("returns a complete CommitmentDto for typical input", () => {
      const result = mapCommitmentFromChain(commitmentModel());
      expect(result).toEqual({
        commitmentId: "cmt-001",
        ownerAddress: "GBVFTZL5HIPT4PFQVTZVIWR77V7LWYCXU4CLYWWHHOEXB64XPG5LDMTU",
        amount: "1000",
        assetCode: "XLM",
        assetIssuer: null,
        durationDays: 30,
        maxLossPercent: 10,
        commitmentType: "safe",
        status: "active",
        nftTokenId: null,
      });
    });

    it("passes through ownerAddress unchanged", () => {
      const addr = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
      const result = mapCommitmentFromChain(commitmentModel({ ownerAddress: addr }));
      expect(result.ownerAddress).toBe(addr);
    });
  });
});

describe("mapAttestationFromChain", () => {
  describe("type coercion", () => {
    it("coerces string id to string", () => {
      const result = mapAttestationFromChain(attestationModel({ id: "att-999" }));
      expect(result.attestationId).toBe("att-999");
    });

    it("coerces number id to string", () => {
      const result = mapAttestationFromChain(attestationModel({ id: 999 }));
      expect(result.attestationId).toBe("999");
    });

    it("coerces string commitmentId to string", () => {
      const result = mapAttestationFromChain(attestationModel({ commitmentId: "cmt-007" }));
      expect(result.commitmentId).toBe("cmt-007");
    });

    it("coerces number commitmentId to string", () => {
      const result = mapAttestationFromChain(attestationModel({ commitmentId: 7 }));
      expect(result.commitmentId).toBe("7");
    });
  });

  describe("AttestationVerdict mapping", () => {
    it("maps 'pass' to 'pass'", () => {
      const result = mapAttestationFromChain(attestationModel({ verdict: "pass" }));
      expect(result.verdict).toBe("pass");
    });

    it("maps 'fail' to 'fail'", () => {
      const result = mapAttestationFromChain(attestationModel({ verdict: "fail" }));
      expect(result.verdict).toBe("fail");
    });

    it("maps 'PASS' (case-insensitive) to 'pass'", () => {
      const result = mapAttestationFromChain(attestationModel({ verdict: "PASS" }));
      expect(result.verdict).toBe("pass");
    });

    it("maps ' FAIL ' (whitespace) to 'fail'", () => {
      const result = mapAttestationFromChain(attestationModel({ verdict: " FAIL " }));
      expect(result.verdict).toBe("fail");
    });

    it("falls back to 'unknown' for unrecognized verdict", () => {
      const result = mapAttestationFromChain(attestationModel({ verdict: "pending" }));
      expect(result.verdict).toBe("unknown");
    });

    it("falls back to 'unknown' for undefined verdict", () => {
      const result = mapAttestationFromChain(attestationModel({ verdict: undefined }));
      expect(result.verdict).toBe("unknown");
    });

    it("falls back to 'unknown' for empty verdict", () => {
      const result = mapAttestationFromChain(attestationModel({ verdict: "" }));
      expect(result.verdict).toBe("unknown");
    });
  });

  describe("observedAt (toIsoDate) handling", () => {
    it("uses provided ISO string", () => {
      const result = mapAttestationFromChain(attestationModel({ observedAt: "2025-01-15T08:30:00.000Z" }));
      expect(result.observedAt).toBe("2025-01-15T08:30:00.000Z");
    });

    it("converts Date object to ISO string", () => {
      const date = new Date("2025-06-01T00:00:00.000Z");
      const result = mapAttestationFromChain(attestationModel({ observedAt: date }));
      expect(result.observedAt).toBe(date.toISOString());
    });

    it("converts number timestamp to ISO string", () => {
      const ts = 1717200000000;
      const result = mapAttestationFromChain(attestationModel({ observedAt: ts }));
      expect(result.observedAt).toBe(new Date(ts).toISOString());
    });

    it("uses current date when observedAt is undefined", () => {
      const before = Date.now();
      const result = mapAttestationFromChain(attestationModel({ observedAt: undefined }));
      const parsed = Date.parse(result.observedAt);
      expect(parsed).toBeGreaterThanOrEqual(before);
      expect(parsed).toBeLessThanOrEqual(Date.now());
    });

    it("uses current date for invalid date string", () => {
      const before = Date.now();
      const result = mapAttestationFromChain(attestationModel({ observedAt: "not-a-date" }));
      const parsed = Date.parse(result.observedAt);
      expect(parsed).toBeGreaterThanOrEqual(before);
      expect(parsed).toBeLessThanOrEqual(Date.now());
    });
  });

  describe("details passthrough", () => {
    it("includes details when present", () => {
      const details = { score: 95, threshold: 80 };
      const result = mapAttestationFromChain(attestationModel({ details }));
      expect(result.details).toEqual(details);
    });

    it("omits details key when undefined", () => {
      const result = mapAttestationFromChain(attestationModel({ details: undefined }));
      expect(result).not.toHaveProperty("details");
    });

    it("includes details when explicitly null", () => {
      const result = mapAttestationFromChain(attestationModel({ details: null }));
      expect(result).toHaveProperty("details");
      expect(result.details).toBeNull();
    });

    it("passes through primitive details", () => {
      const result = mapAttestationFromChain(attestationModel({ details: "raw" }));
      expect(result.details).toBe("raw");
    });
  });

  describe("full output shape", () => {
    it("returns a complete AttestationDto for typical input", () => {
      const result = mapAttestationFromChain(attestationModel());
      expect(result).toEqual({
        attestationId: "att-001",
        commitmentId: "cmt-001",
        ownerAddress: "GBVFTZL5HIPT4PFQVTZVIWR77V7LWYCXU4CLYWWHHOEXB64XPG5LDMTU",
        kind: "compliance",
        verdict: "pass",
        observedAt: "2025-06-01T12:00:00.000Z",
        details: { score: 95 },
      });
    });

    it("passes through ownerAddress unchanged", () => {
      const addr = "GBVFTZL5HIPT4PFQVTZVIWR77V7LWYCXU4CLYWWHHOEXB64XPG5LDMTU";
      const result = mapAttestationFromChain(attestationModel({ ownerAddress: addr }));
      expect(result.ownerAddress).toBe(addr);
    });
  });
});
