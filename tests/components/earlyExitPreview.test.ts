import { describe, expect, it, vi } from "vitest";
import {
  fetchEarlyExitPreviewSummary,
  formatEarlyExitPreview,
} from "@/components/CommitmentEarlyExitModal/earlyExitPreview";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe("early exit preview helpers", () => {
  it("formats live preview numbers with the commitment asset", () => {
    expect(
      formatEarlyExitPreview(
        {
          principal: 50000,
          penaltyPercent: 2,
          penaltyAmount: 1000,
          netRefund: 49000,
        },
        "XLM",
      ),
    ).toEqual({
      penaltyPercent: "2%",
      penaltyAmount: "1,000 XLM",
      netReceiveAmount: "49,000 XLM",
    });
  });

  it("preserves a 0% grace-period preview", () => {
    expect(
      formatEarlyExitPreview(
        {
          principal: 50000,
          penaltyPercent: 0,
          penaltyAmount: 0,
          netRefund: 50000,
        },
        "XLM",
      ),
    ).toEqual({
      penaltyPercent: "0%",
      penaltyAmount: "0 XLM",
      netReceiveAmount: "50,000 XLM",
    });
  });

  it("fetches and unwraps the preview API envelope", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          principal: 100000,
          penaltyPercent: 3,
          penaltyAmount: 3000,
          netRefund: 97000,
        },
      }),
    );

    await expect(
      fetchEarlyExitPreviewSummary("CMT-XYZ789", "USDC", fetcher),
    ).resolves.toEqual({
      penaltyPercent: "3%",
      penaltyAmount: "3,000 USDC",
      netReceiveAmount: "97,000 USDC",
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/commitments/CMT-XYZ789/early-exit/preview",
    );
  });

  it("rejects failed preview envelopes with the server message", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({
        success: false,
        error: {
          message: "Commitment has already been settled",
        },
      }),
    );

    await expect(
      fetchEarlyExitPreviewSummary("CMT-XYZ789", "USDC", fetcher),
    ).rejects.toThrow("Commitment has already been settled");
  });

  it("rejects non-ok preview responses", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({}, false, 503));

    await expect(
      fetchEarlyExitPreviewSummary("CMT-XYZ789", "USDC", fetcher),
    ).rejects.toThrow("Live preview failed with status 503");
  });
});
