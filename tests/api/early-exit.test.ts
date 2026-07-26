import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMockRequest,
  parseResponse,
  createMockRouteContext,
} from "./helpers";

// Mock dependencies BEFORE importing the route
vi.mock("@/lib/backend/requireAuth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/backend/rateLimit", () => ({
  checkRateLimit: vi.fn(),
  getRateLimitWindowSeconds: vi.fn(() => 60),
}));

vi.mock("@/lib/backend/services/contracts", () => ({
  earlyExitCommitmentOnChain: vi.fn(),
  getCommitmentFromChain: vi.fn(),
}));

// NOW import the route and dependencies
import { POST as postHandler } from "@/app/api/commitments/[id]/early-exit/route";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/backend/requireAuth";
import { checkRateLimit } from "@/lib/backend/rateLimit";
import { BackendError } from "@/lib/backend/errors";
import {
  earlyExitCommitmentOnChain,
  getCommitmentFromChain,
} from "@/lib/backend/services/contracts";

// Get mocked versions
const mockedRequireAuth = vi.mocked(requireAuth);
const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedEarlyExitCommitmentOnChain = vi.mocked(earlyExitCommitmentOnChain);
const mockedGetCommitmentFromChain = vi.mocked(getCommitmentFromChain);

// Cast handler to correct signature
const POST = postHandler as (
  req: NextRequest,
  context: { params: Record<string, string> },
) => Promise<Response>;

const VALID_ADDRESS = `G${"A".repeat(55)}`;
const DIFFERENT_ADDRESS = `G${"B".repeat(55)}`;
const COMMITMENT_ID = "cm_123456";

describe("POST /api/commitments/[id]/early-exit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCheckRateLimit.mockResolvedValue(true);
    mockedRequireAuth.mockReturnValue({
      user: { address: VALID_ADDRESS, csrfToken: "csrf-token" },
    } as any);
    mockedGetCommitmentFromChain.mockResolvedValue({
      id: COMMITMENT_ID,
      ownerAddress: VALID_ADDRESS,
      asset: "USDC",
      amount: "1000",
      status: "ACTIVE",
      complianceScore: 85,
      currentValue: "1000",
      feeEarned: "0",
      violationCount: 0,
    });
    mockedEarlyExitCommitmentOnChain.mockResolvedValue({
      exitAmount: "950",
      penaltyAmount: "50",
      finalStatus: "EARLY_EXIT",
      txHash: "abc123",
      reference: undefined,
    });
  });

  it("validates request body - missing reason", async () => {
    const response = await POST(
      createMockRequest(
        `http://localhost:3000/api/commitments/${COMMITMENT_ID}/early-exit`,
        {
          method: "POST",
          body: { callerAddress: VALID_ADDRESS },
        },
      ),
      createMockRouteContext({ id: COMMITMENT_ID }),
    );
    const result = await parseResponse(response);
    expect(result.status).toBe(400);
    expect(result.data.error.code).toBe("VALIDATION_ERROR");
  });

  it("validates request body - missing callerAddress", async () => {
    const response = await POST(
      createMockRequest(
        `http://localhost:3000/api/commitments/${COMMITMENT_ID}/early-exit`,
        {
          method: "POST",
          body: { reason: "Need liquidity" },
        },
      ),
      createMockRouteContext({ id: COMMITMENT_ID }),
    );
    const result = await parseResponse(response);
    expect(result.status).toBe(400);
    expect(result.data.error.code).toBe("VALIDATION_ERROR");
  });

  it("validates request body - invalid Stellar address", async () => {
    const response = await POST(
      createMockRequest(
        `http://localhost:3000/api/commitments/${COMMITMENT_ID}/early-exit`,
        {
          method: "POST",
          body: { reason: "Need liquidity", callerAddress: "invalid-address" },
        },
      ),
      createMockRouteContext({ id: COMMITMENT_ID }),
    );
    const result = await parseResponse(response);
    expect(result.status).toBe(400);
    expect(result.data.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 401 when not authenticated", async () => {
    const { UnauthorizedError } = await import("@/lib/backend/errors");
    mockedRequireAuth.mockImplementation(() => {
      throw new UnauthorizedError("No session token");
    });

    const response = await POST(
      createMockRequest(
        `http://localhost:3000/api/commitments/${COMMITMENT_ID}/early-exit`,
        {
          method: "POST",
          body: { reason: "Need liquidity", callerAddress: VALID_ADDRESS },
        },
      ),
      createMockRouteContext({ id: COMMITMENT_ID }),
    );
    const result = await parseResponse(response);
    expect(result.status).toBe(401);
  });

  it("returns 403 when session address does not match callerAddress", async () => {
    mockedRequireAuth.mockReturnValue({
      user: { address: DIFFERENT_ADDRESS, csrfToken: "csrf-token" },
    } as unknown as ReturnType<typeof requireAuth>);

    const response = await POST(
      createMockRequest(
        `http://localhost:3000/api/commitments/${COMMITMENT_ID}/early-exit`,
        {
          method: "POST",
          body: { reason: "Need liquidity", callerAddress: VALID_ADDRESS },
        },
      ),
      createMockRouteContext({ id: COMMITMENT_ID }),
    );
    const result = await parseResponse(response);
    expect(result.status).toBe(403);
    expect(result.data.error.code).toBe("FORBIDDEN");
  });

  it("returns 403 when caller does not own commitment", async () => {
    mockedGetCommitmentFromChain.mockResolvedValue({
      id: COMMITMENT_ID,
      ownerAddress: DIFFERENT_ADDRESS,
      asset: "USDC",
      amount: "1000",
      status: "ACTIVE",
      complianceScore: 85,
      currentValue: "1000",
      feeEarned: "0",
      violationCount: 0,
    });

    const response = await POST(
      createMockRequest(
        `http://localhost:3000/api/commitments/${COMMITMENT_ID}/early-exit`,
        {
          method: "POST",
          body: { reason: "Need liquidity", callerAddress: VALID_ADDRESS },
        },
      ),
      createMockRouteContext({ id: COMMITMENT_ID }),
    );
    const result = await parseResponse(response);
    expect(result.status).toBe(403);
    expect(result.data.error.code).toBe("FORBIDDEN");
  });

  it("maps normalized contract errors into the standard error envelope", async () => {
    mockedEarlyExitCommitmentOnChain.mockRejectedValue(
      new BackendError({
        code: "GATEWAY_TIMEOUT",
        message:
          "The blockchain operation timed out. It may still be processed later.",
        status: 504,
        details: {
          method: "early_exit_commitment",
          commitmentId: COMMITMENT_ID,
          retryable: true,
        },
      }),
    );

    const response = await POST(
      createMockRequest(
        `http://localhost:3000/api/commitments/${COMMITMENT_ID}/early-exit`,
        {
          method: "POST",
          body: { reason: "Need liquidity", callerAddress: VALID_ADDRESS },
        },
      ),
      createMockRouteContext({ id: COMMITMENT_ID }),
    );
    const result = await parseResponse(response);

    expect(result.status).toBe(504);
    expect(result.data).toMatchObject({
      success: false,
      error: {
        code: "GATEWAY_TIMEOUT",
        message:
          "The blockchain operation timed out. It may still be processed later.",
      },
    });
  });

  it("returns 429 when rate limited", async () => {
    mockedCheckRateLimit.mockResolvedValue(false);

    const response = await POST(
      createMockRequest(
        `http://localhost:3000/api/commitments/${COMMITMENT_ID}/early-exit`,
        {
          method: "POST",
          body: { reason: "Need liquidity", callerAddress: VALID_ADDRESS },
        },
      ),
      createMockRouteContext({ id: COMMITMENT_ID }),
    );
    const result = await parseResponse(response);
    expect(result.status).toBe(429);
    expect(result.data.error.code).toBe("TOO_MANY_REQUESTS");
  });

  it("returns 200 on successful early exit", async () => {
    const response = await POST(
      createMockRequest(
        `http://localhost:3000/api/commitments/${COMMITMENT_ID}/early-exit`,
        {
          method: "POST",
          body: { reason: "Need liquidity", callerAddress: VALID_ADDRESS },
        },
      ),
      createMockRouteContext({ id: COMMITMENT_ID }),
    );
    const result = await parseResponse(response);

    expect(result.status).toBe(200);
    expect(result.data.success).toBe(true);
    expect(result.data.data.exitAmount).toBe("950");
    expect(result.data.data.penaltyAmount).toBe("50");
  });

  it("calls earlyExitCommitmentOnChain with correct parameters", async () => {
    await POST(
      createMockRequest(
        `http://localhost:3000/api/commitments/${COMMITMENT_ID}/early-exit`,
        {
          method: "POST",
          body: { reason: "Need liquidity", callerAddress: VALID_ADDRESS },
        },
      ),
      createMockRouteContext({ id: COMMITMENT_ID }),
    );

    expect(mockedEarlyExitCommitmentOnChain).toHaveBeenCalledWith({
      commitmentId: COMMITMENT_ID,
      callerAddress: VALID_ADDRESS,
    });
  });

  it("includes correlation ID in response headers", async () => {
    const response = await POST(
      createMockRequest(
        `http://localhost:3000/api/commitments/${COMMITMENT_ID}/early-exit`,
        {
          method: "POST",
          body: { reason: "Need liquidity", callerAddress: VALID_ADDRESS },
        },
      ),
      createMockRouteContext({ id: COMMITMENT_ID }),
    );

    expect(response.headers.get("x-correlation-id")).toBeDefined();
  });
});
